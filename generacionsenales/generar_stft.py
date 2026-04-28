"""
generar_stft.py
===============
Genera el espectrograma STFT del violin y lo guarda en outputs/.

Uso: python generar_stft.py
"""

import os
import numpy as np
import scipy.fft as sfft
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import soundfile as sf

INPUT_WAV = "inputs/641703__theflyfishingfilmmaker__violin-single-note-swell.wav"
OUTPUT_PNG = "outputs/641703__theflyfishingfilmmaker__violin-single-note-swell_stft.png"

N_FFT = 2048
HOP   = 512


def load_audio(path):
    data, sr = sf.read(path, always_2d=False)
    if data.ndim > 1:
        data = data.mean(axis=1)
    data = data.astype(np.float64)
    peak = np.max(np.abs(data))
    if peak > 1e-12:
        data /= peak
    return data, int(sr)


def compute_stft(signal, n_fft, hop):
    window   = np.hanning(n_fft)
    win_norm = np.sum(window) / 2.0
    n_frames = 1 + (len(signal) - n_fft) // hop
    n_bins   = n_fft // 2 + 1
    mag_db   = np.zeros((n_frames, n_bins), dtype=np.float64)

    for i in range(n_frames):
        start = i * hop
        frame = signal[start : start + n_fft]
        if len(frame) < n_fft:
            frame = np.pad(frame, (0, n_fft - len(frame)))
        spec       = sfft.rfft(frame * window) / win_norm
        mag_db[i]  = 20.0 * np.log10(np.abs(spec) + 1e-12)

    return mag_db


def plot_stft(mag_db, hop, sr, n_fft, out_path):
    n_frames, n_bins = mag_db.shape
    freq_res  = sr / n_fft
    max_freq  = 8000.0
    max_bin   = min(n_bins, int(max_freq / freq_res) + 1)

    times = np.arange(n_frames) * hop / sr
    freqs = np.arange(max_bin) * freq_res
    Z     = mag_db[:, :max_bin].T   # (freq, time)

    fig, ax = plt.subplots(figsize=(14, 5))
    img = ax.pcolormesh(times, freqs, Z, cmap="magma",
                        vmin=-90.0, vmax=0.0, shading="auto")
    plt.colorbar(img, ax=ax, label="Magnitud (dBFS)")
    ax.set_xlabel("Tiempo (s)", fontsize=12)
    ax.set_ylabel("Frecuencia (Hz)", fontsize=12)
    ax.set_ylim(0, max_freq)
    ax.set_title(
        "STFT - Espectrograma (violin-single-note-swell.wav)\n"
        f"N_FFT={n_fft}, hop={hop}, ventana Hann",
        fontsize=11
    )
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"Guardado: {out_path}")


if __name__ == "__main__":
    print(f"Cargando {INPUT_WAV}...")
    signal, sr = load_audio(INPUT_WAV)
    print(f"  sr={sr} Hz | duracion={len(signal)/sr:.2f}s")

    print(f"Calculando STFT (N_FFT={N_FFT}, hop={HOP})...")
    mag_db = compute_stft(signal, N_FFT, HOP)
    print(f"  {mag_db.shape[0]} frames | {mag_db.shape[1]} bins")

    os.makedirs("outputs", exist_ok=True)
    plot_stft(mag_db, HOP, sr, N_FFT, OUTPUT_PNG)
