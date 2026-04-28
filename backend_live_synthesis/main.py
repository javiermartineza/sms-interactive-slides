"""
backend_live_synthesis/main.py
==============================
Servidor FastAPI que ejecuta el pipeline SMS (Spectral Modeling Synthesis)
en vivo sobre un buffer de audio enviado desde el frontend.

Salidas por sesión (en sessions/<id>/):
    original.wav
    parcial_01.wav .. parcial_NN.wav   (síntesis acumulativa: top-n tracks)
    sintesis_total.wav                 (todos los tracks deterministas)
    residuo.wav                        (componente estocástico)
    stft.png                           (espectrograma)
    peaks.png                          (espectro de un frame con picos)
    parabola.png                       (zoom + parábola sub-bin)
    tracks.png                         (mapa MQ de trayectorias)

Reusa las funciones puras de  ../generacionsenales/demo_sms_cello.py.

Ejecutar:
    cd backend_live_synthesis
    pip install -r requirements.txt
    uvicorn main:app --reload --port 8765
"""

import io
import os
import sys
import uuid
import time
import shutil
import threading
from typing import Dict, List

import numpy as np
import soundfile as sf
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Importar pipeline DSP del módulo generacionsenales/
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
sys.path.insert(0, os.path.join(ROOT, "generacionsenales"))

from demo_sms_cello import (  # noqa: E402
    compute_stft,
    detect_peaks,
    mq_tracking,
    synthesize_tracks,
    modelar_ruido_estocastico,
    plot_tracks_figure,
    Track,
    N_FFT,
    HOP,
    FREQ_TOL_HZ,
    MIN_TRACK_LEN,
    PEAK_THRESH,
)

MAX_PARCIALES = 30   # tope máximo de parciales que sintetizamos por sesión

# ─────────────────────────────────────────────────────────────────────────────
# Carpeta temporal de sesiones
# ─────────────────────────────────────────────────────────────────────────────
SESSIONS_DIR = os.path.join(HERE, "sessions")
os.makedirs(SESSIONS_DIR, exist_ok=True)
for _name in os.listdir(SESSIONS_DIR):
    _p = os.path.join(SESSIONS_DIR, _name)
    if os.path.isdir(_p):
        shutil.rmtree(_p, ignore_errors=True)

SESSION_TTL_SEC = 60 * 30
_lock = threading.Lock()


def _cleanup_old_sessions():
    now = time.time()
    with _lock:
        for name in os.listdir(SESSIONS_DIR):
            p = os.path.join(SESSIONS_DIR, name)
            if not os.path.isdir(p):
                continue
            try:
                if now - os.path.getmtime(p) > SESSION_TTL_SEC:
                    shutil.rmtree(p, ignore_errors=True)
            except OSError:
                pass


# ─────────────────────────────────────────────────────────────────────────────
# App + CORS
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="SMS Live Synthesis", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/sessions", StaticFiles(directory=SESSIONS_DIR), name="sessions")


@app.get("/health")
def health():
    return {"status": "ok"}


# ─────────────────────────────────────────────────────────────────────────────
# Helpers de visualización (paleta de la presentación)
# ─────────────────────────────────────────────────────────────────────────────
COL_BLUE   = "#2563eb"
COL_RED    = "#c0392b"
COL_GREEN  = "#16a34a"
COL_AMBER  = "#d97706"
COL_INK    = "#1a1a2e"
COL_FAINT  = "#9ca3af"
BG_CREAM   = "#faf8f3"


def _set_clean_axes(ax):
    ax.set_facecolor(BG_CREAM)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color("#d1cfc4")
    ax.spines["bottom"].set_color("#d1cfc4")
    ax.tick_params(colors=COL_INK)


def plot_stft(mag_db: np.ndarray, hop: int, sr: int, n_fft: int, out_path: str):
    n_frames, n_bins = mag_db.shape
    freq_res = sr / n_fft
    max_freq = 8000.0
    max_bin = min(n_bins, int(max_freq / freq_res) + 1)
    times = np.arange(n_frames) * hop / sr
    freqs = np.arange(max_bin) * freq_res
    Z = mag_db[:, :max_bin].T

    fig, ax = plt.subplots(figsize=(12, 5))
    img = ax.pcolormesh(times, freqs, Z, cmap="magma", vmin=-90, vmax=0, shading="auto")
    plt.colorbar(img, ax=ax, label="Magnitud (dBFS)")
    ax.set_xlabel("Tiempo (s)")
    ax.set_ylabel("Frecuencia (Hz)")
    ax.set_ylim(0, max_freq)
    ax.set_title("STFT — Espectrograma de la voz")
    plt.tight_layout()
    plt.savefig(out_path, dpi=140, facecolor="white")
    plt.close(fig)


def plot_peaks(mag_db_frame: np.ndarray, sr: int, n_fft: int,
               peaks_freqs: np.ndarray, peaks_mags: np.ndarray, out_path: str):
    n_bins = len(mag_db_frame)
    freq_res = sr / n_fft
    freqs = np.arange(n_bins) * freq_res

    fig, ax = plt.subplots(figsize=(12, 5))
    _set_clean_axes(ax)
    ax.plot(freqs, mag_db_frame, color=COL_INK, linewidth=1.0, alpha=0.85,
            label="|X(k)| dBFS")
    ax.axhline(PEAK_THRESH, color=COL_FAINT, linestyle="--", linewidth=1,
               label=f"Umbral {PEAK_THRESH:.0f} dBFS")
    if len(peaks_freqs):
        ax.scatter(peaks_freqs, peaks_mags, s=55, color=COL_RED,
                   edgecolors="white", linewidths=1.2, zorder=4,
                   label=f"{len(peaks_freqs)} picos detectados")
    ax.set_xlim(0, 8000)
    ax.set_ylim(-100, 5)
    ax.set_xlabel("Frecuencia (Hz)")
    ax.set_ylabel("Magnitud (dBFS)")
    ax.legend(loc="upper right", frameon=False, fontsize=10)
    ax.set_title("Peak Detection — picos espectrales del frame medio")
    plt.tight_layout()
    plt.savefig(out_path, dpi=140, facecolor="white")
    plt.close(fig)


def plot_parabola(mag_db_frame: np.ndarray, k: int, sr: int, n_fft: int, out_path: str):
    """Zoom alrededor del bin k con la parábola ajustada por interpolación parabólica."""
    freq_res = sr / n_fft
    a = mag_db_frame[k - 1]
    b = mag_db_frame[k]
    c = mag_db_frame[k + 1]
    A = (a + c) / 2.0 - b
    B = (c - a) / 2.0
    C = b
    delta = -B / (2.0 * A) if abs(A) > 1e-10 else 0.0
    delta = float(np.clip(delta, -1.0, 1.0))
    peak_y = A * delta ** 2 + B * delta + C
    peak_freq = (k + delta) * freq_res

    # Zoom: mostrar 9 bins alrededor de k (k-4..k+4) más la parábola continua
    bin_offsets_data = np.arange(-4, 5)
    bins_y = mag_db_frame[k + bin_offsets_data]
    xs_bin = np.linspace(-1.6, 1.6, 240)
    parabola_y = A * xs_bin ** 2 + B * xs_bin + C
    bin_freqs_x = (k + bin_offsets_data) * freq_res
    parabola_freqs = (k + xs_bin) * freq_res

    fig, ax = plt.subplots(figsize=(12, 5))
    _set_clean_axes(ax)
    # Línea conectando todos los bins (envolvente local)
    ax.plot(bin_freqs_x, bins_y, color=COL_INK, alpha=0.4, linewidth=1.2)
    # Parábola
    ax.plot(parabola_freqs, parabola_y, color=COL_AMBER, linewidth=2.6,
            label="Parábola y = Ax² + Bx + C")
    # Tres bins de la interpolación
    abc_freqs = (k + np.array([-1, 0, 1])) * freq_res
    abc_vals = np.array([a, b, c])
    ax.scatter(abc_freqs, abc_vals, s=110, color=COL_INK, zorder=5,
               edgecolors="white", linewidths=1.5, label="Bins (α, β, γ)")
    # Resto de bins zoom (gris claro)
    other_mask = (bin_offsets_data < -1) | (bin_offsets_data > 1)
    ax.scatter(bin_freqs_x[other_mask], bins_y[other_mask], s=40,
               color=COL_FAINT, zorder=4, alpha=0.7)
    # Pico real interpolado
    ax.scatter([peak_freq], [peak_y], s=210, color=COL_GREEN, marker="*",
               zorder=6, edgecolors="white", linewidths=1.5,
               label=f"Pico real ≈ {peak_freq:.1f} Hz")

    # Anotaciones α β γ
    for lbl, xv, yv in zip(["α", "β", "γ"], abc_freqs, abc_vals):
        ax.annotate(lbl, xy=(xv, yv), xytext=(0, 12),
                    textcoords="offset points", ha="center",
                    fontsize=14, color=COL_INK, fontweight="bold")

    ax.set_xlabel("Frecuencia (Hz)")
    ax.set_ylabel("Magnitud (dBFS)")
    ax.legend(loc="lower right", frameon=False, fontsize=10)
    ax.set_title(f"Interpolación Parabólica — δ = {delta:.3f} bin "
                 f"(error de bin → {delta * freq_res:+.2f} Hz)")
    plt.tight_layout()
    plt.savefig(out_path, dpi=140, facecolor="white")
    plt.close(fig)


# ─────────────────────────────────────────────────────────────────────────────
# Pipeline completo
# ─────────────────────────────────────────────────────────────────────────────
def _decode_audio_bytes(raw: bytes) -> tuple:
    bio = io.BytesIO(raw)
    data, sr = sf.read(bio, always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)
    data = data.astype(np.float64)
    peak = float(np.max(np.abs(data))) if data.size else 0.0
    if peak > 1e-12:
        data /= peak
    return data, int(sr)


def _save_wav(path: str, sig: np.ndarray, sr: int):
    sf.write(path, np.clip(sig, -1.0, 1.0).astype(np.float32), sr, subtype="PCM_16")


def _pick_best_peak_frame(all_mags: List[np.ndarray]) -> int:
    """Elige el frame con el pico más alto (típicamente cerca del centro tonal)."""
    best_frame = 0
    best_mag = -1e9
    for i, mags in enumerate(all_mags):
        if mags.size and mags.max() > best_mag:
            best_mag = mags.max()
            best_frame = i
    return best_frame


def _process_voice(signal: np.ndarray, sr: int, session_dir: str) -> dict:
    n_samples = len(signal)

    # 1. STFT
    _, mag_db = compute_stft(signal, N_FFT, HOP)
    n_frames = mag_db.shape[0]

    # 2. Picos por frame
    all_freqs: List[np.ndarray] = []
    all_mags: List[np.ndarray] = []
    for i in range(n_frames):
        pf, pm = detect_peaks(mag_db[i], N_FFT, sr)
        all_freqs.append(pf)
        all_mags.append(pm)

    # 3. Tracking MQ
    Track._counter = 0
    tracks_all = mq_tracking(all_freqs, all_mags, freq_tol=FREQ_TOL_HZ)
    long_tracks = [t for t in tracks_all if len(t) >= MIN_TRACK_LEN]

    # Frame "ejemplo" para los plots de picos / parábola: el más rico
    demo_frame = _pick_best_peak_frame(all_mags)
    demo_mag_db = mag_db[demo_frame]

    # Bin para la parábola: el bin del pico más fuerte detectado en demo_frame
    if all_freqs[demo_frame].size:
        # Reconstruir índice del bin más fuerte en este frame
        # (detect_peaks ya filtró por umbral y rango; encontramos el bin del máximo
        #  global del espectro dentro de [60, 8000] Hz)
        freq_res = sr / N_FFT
        k_min = max(2, int(60 / freq_res))
        k_max = min(len(demo_mag_db) - 2, int(8000 / freq_res))
        # Buscamos el máximo local más fuerte
        best_k = k_min
        best_val = -1e9
        for k in range(k_min, k_max):
            if (demo_mag_db[k] > demo_mag_db[k - 1]
                and demo_mag_db[k] > demo_mag_db[k + 1]
                and demo_mag_db[k] > best_val):
                best_val = demo_mag_db[k]
                best_k = k
    else:
        best_k = N_FFT // 8

    # ── Plots ────────────────────────────────────────────────────────────
    plot_stft(mag_db, HOP, sr, N_FFT, os.path.join(session_dir, "stft.png"))
    plot_peaks(demo_mag_db, sr, N_FFT,
               all_freqs[demo_frame], all_mags[demo_frame],
               os.path.join(session_dir, "peaks.png"))
    plot_parabola(demo_mag_db, best_k, sr, N_FFT,
                  os.path.join(session_dir, "parabola.png"))
    plot_tracks_figure(long_tracks, HOP, sr,
                       os.path.join(session_dir, "tracks.png"),
                       n_top=80, title_stem="voz grabada")

    # ── Síntesis ─────────────────────────────────────────────────────────
    # Ordenar tracks por energía descendente
    if long_tracks:
        energies = np.array([t.energy() for t in long_tracks])
        order = np.argsort(energies)[::-1]
        sorted_tracks = [long_tracks[i] for i in order]
    else:
        sorted_tracks = []

    n_parciales = min(MAX_PARCIALES, len(sorted_tracks))

    audio_files = {}
    audio_files["original"] = "original.wav"
    _save_wav(os.path.join(session_dir, "original.wav"),
              signal.astype(np.float32), sr)

    # Síntesis acumulativa 1..N
    for n in range(1, n_parciales + 1):
        sig_n = synthesize_tracks(sorted_tracks[:n], HOP, sr, n_samples, n_select=None)
        fname = f"parcial_{n:02d}.wav"
        _save_wav(os.path.join(session_dir, fname), sig_n, sr)
        audio_files[f"parcial_{n:02d}"] = fname

    # Síntesis total (todos los tracks deterministas)
    if long_tracks:
        sintesis_total = synthesize_tracks(long_tracks, HOP, sr, n_samples, n_select=None)
    else:
        sintesis_total = np.zeros(n_samples, dtype=np.float32)
    _save_wav(os.path.join(session_dir, "sintesis_total.wav"), sintesis_total, sr)
    audio_files["sintesis_total"] = "sintesis_total.wav"

    # Residuo estocástico
    residuo_crudo = (signal - sintesis_total.astype(np.float64)).astype(np.float32)
    residuo = modelar_ruido_estocastico(residuo_crudo, n_fft=N_FFT, hop=HOP)
    _save_wav(os.path.join(session_dir, "residuo.wav"), residuo, sr)
    audio_files["residuo"] = "residuo.wav"

    # SMS completo: determinista + residuo ≈ señal original reconstruida
    sms_completo = np.clip(sintesis_total.astype(np.float32) + residuo, -1.0, 1.0)
    _save_wav(os.path.join(session_dir, "sms_completo.wav"), sms_completo, sr)
    audio_files["sms_completo"] = "sms_completo.wav"

    return {
        "n_frames": int(n_frames),
        "n_tracks": int(len(long_tracks)),
        "n_parciales": int(n_parciales),
        "audio_files": audio_files,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Endpoint principal
# ─────────────────────────────────────────────────────────────────────────────
@app.post("/process-sms")
async def process_sms(audio: UploadFile = File(...)):
    """Recibe WAV mono → ejecuta SMS → devuelve URLs de audios + plots."""
    _cleanup_old_sessions()

    raw = await audio.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Audio vacío")

    try:
        signal, sr = _decode_audio_bytes(raw)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo decodificar audio: {e}")

    dur = len(signal) / sr if sr > 0 else 0.0
    if dur < 0.5:
        raise HTTPException(status_code=400, detail=f"Grabación muy corta ({dur:.2f}s)")
    if dur > 10.0:
        signal = signal[: int(sr * 10.0)]

    session_id = uuid.uuid4().hex[:12]
    session_dir = os.path.join(SESSIONS_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)

    info = _process_voice(signal, sr, session_dir)

    base = f"/sessions/{session_id}"
    audio_urls: Dict[str, str] = {
        key: f"{base}/{fname}" for key, fname in info["audio_files"].items()
    }
    image_urls = {
        "stft":     f"{base}/stft.png",
        "peaks":    f"{base}/peaks.png",
        "parabola": f"{base}/parabola.png",
        "tracks":   f"{base}/tracks.png",
    }

    return {
        "session_id": session_id,
        "sample_rate": sr,
        "duration": float(dur),
        "n_frames": info["n_frames"],
        "n_tracks": info["n_tracks"],
        "n_parciales": info["n_parciales"],
        "audio": audio_urls,
        "images": image_urls,
    }
