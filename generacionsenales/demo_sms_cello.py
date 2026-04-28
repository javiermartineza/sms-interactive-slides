"""
demo_sms_cello.py
=================
Demostración académica de Spectral Modeling Synthesis (SMS)
basado en el algoritmo McAulay-Quatieri (MQ).

Dependencias:
    pip install numpy scipy matplotlib soundfile

Uso:    python demo_sms_cello.py
Input:  todos los archivos .wav dentro de la carpeta  inputs/

Salidas (en la carpeta  outputs/, una por cada archivo de entrada):
    <nombre>_plot_tracks.png          – Gráfico espagueti de trayectorias (MQ original)
    <nombre>_plot_tracks_sin_orden.png– Gráfico espagueti de trayectorias (MQ sin orden)
    <nombre>_03_parciales.wav         – Síntesis con los 3 parciales más fuertes
    <nombre>_10_parciales.wav         – Síntesis con los 10 parciales más fuertes
    <nombre>_30_parciales.wav         – Síntesis con los 30 parciales más fuertes
    <nombre>_30_mas_residuo.wav       – 30 parciales + residuo estocástico
    <nombre>_30_ROTO.wav              – Tracking sin memoria (artefactos)
    <nombre>_30_SIN_ORDEN.wav         – Tracking sin ordenar picos por magnitud ("burbujeo")
"""

import sys
import os
import shutil
import numpy as np
import scipy.fft as sfft
from scipy.ndimage import median_filter
from scipy.signal import stft as scipy_stft, istft as scipy_istft
import matplotlib
matplotlib.use("Agg")          # backend sin GUI; funciona en cualquier entorno
import matplotlib.pyplot as plt
import soundfile as sf


# ─────────────────────────────────────────────────────────────────────────────
# PARÁMETROS GLOBALES
# ─────────────────────────────────────────────────────────────────────────────

N_FFT         = 2048    # Tamaño de ventana de análisis (muestras)
HOP           = 512     # Salto entre ventanas consecutivas (muestras)
N_PEAKS_MAX   = 60      # Máximo de picos a detectar por frame
FREQ_TOL_HZ   = 50.0    # Tolerancia de matching MQ en Hz
MIN_TRACK_LEN = 5       # Frames mínimos para que un track supere el filtro de ruido
PEAK_THRESH   = -75.0   # Umbral mínimo de magnitud (dBFS) para considerar un pico
SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
INPUT_DIR     = os.path.join(SCRIPT_DIR, "inputs")
OUTPUT_DIR    = os.path.join(SCRIPT_DIR, "outputs")


# ─────────────────────────────────────────────────────────────────────────────
# MÓDULO 1 · CARGA DE AUDIO
# ─────────────────────────────────────────────────────────────────────────────

def load_audio(path: str):
    """Carga el archivo WAV, lo convierte a mono float32 y lo normaliza."""
    data, sr = sf.read(path, always_2d=False)
    if data.ndim > 1:
        # [WHY] Si el archivo es estéreo, promediamos los canales para obtener
        # mono. La mezcla a mono preserva la energía espectral media del
        # instrumento sin preferir ningún canal de microfonía.
        data = data.mean(axis=1)
    data = data.astype(np.float64)
    peak = np.max(np.abs(data))
    if peak > 1e-12:
        data /= peak          # normalizar a pico unitario
    return data, int(sr)


# ─────────────────────────────────────────────────────────────────────────────
# MÓDULO 2 · STFT
# ─────────────────────────────────────────────────────────────────────────────

def compute_stft(signal: np.ndarray, n_fft: int, hop: int):
    """
    Calcula la STFT frame a frame usando scipy.fft.rfft.

    Retorna
    -------
    stft     : ndarray, shape (n_frames, n_fft//2+1), complejo
    mag_db   : ndarray, shape (n_frames, n_fft//2+1), magnitud en dBFS
    """
    # [WHY] La ventana Hann reduce la fuga espectral (spectral leakage).
    # Sin ventana, los bordes abruptos de cada frame actúan como una
    # multiplicación rectangular, que en frecuencia equivale a una convolución
    # con un sinc: los lóbulos laterales contaminan todos los bins adyacentes
    # y enmascaran picos débiles. La Hann concentra la energía en el lóbulo
    # principal y suprime los laterales ~31 dB, lo que permite detectar
    # parciales de amplitud moderada junto a otros más fuertes.
    window = np.hanning(n_fft)

    # Normalización de la ventana: compensar la atenuación RMS que introduce
    # la Hann para que las magnitudes del espectro sean comparables con la
    # amplitud real de cada sinusoide.
    # [WHY] Sin esta normalización, la energía de un parcial estaría dividida
    # entre todos los bins del lóbulo principal. Dividir por sum(window)/2
    # (factor ×2 por el espectro de una cara) reescala cada bin para que un
    # tono puro de amplitud A aparezca con magnitud A en su bin central.
    win_norm = np.sum(window) / 2.0

    n_frames = 1 + (len(signal) - n_fft) // hop
    n_bins   = n_fft // 2 + 1

    stft   = np.zeros((n_frames, n_bins), dtype=np.complex128)
    mag_db = np.zeros((n_frames, n_bins), dtype=np.float64)

    for i in range(n_frames):
        start = i * hop
        frame = signal[start : start + n_fft]
        if len(frame) < n_fft:
            frame = np.pad(frame, (0, n_fft - len(frame)))

        # [WHY] Multiplicar por la ventana antes de la FFT es la operación
        # fundamental del análisis de Fourier de tiempo corto (STFT): equivale
        # a "enfocar" el análisis en un segmento temporal finito asumiendo que
        # la señal es cuasi-estacionaria dentro de ese segmento. Con hop=512 y
        # N_FFT=2048, obtenemos ~86 frames/segundo (a 44100 Hz), suficiente
        # para capturar variaciones de vibrato del cello (~5-7 Hz).
        spec = sfft.rfft(frame * window) / win_norm

        stft[i]   = spec
        # [WHY] Usamos la escala dB (logarítmica) para la magnitud porque el
        # sistema auditivo humano sigue la ley de Weber-Fechner: percibe las
        # diferencias de intensidad de forma logarítmica. Un umbral de detección
        # de -75 dBFS tiene significado perceptual uniforme en todo el espectro,
        # a diferencia de un umbral lineal que sería arbitrario.
        mag_db[i] = 20.0 * np.log10(np.abs(spec) + 1e-12)

    return stft, mag_db


# ─────────────────────────────────────────────────────────────────────────────
# MÓDULO 3 · DETECCIÓN DE PICOS + INTERPOLACIÓN PARABÓLICA
# ─────────────────────────────────────────────────────────────────────────────

def _parabolic_interp(mag_db: np.ndarray, k: int) -> tuple:
    """
    Interpolación parabólica alrededor del bin k.

    Retorna
    -------
    freq_offset : desplazamiento fraccional en bins respecto a k
    mag_peak    : magnitud interpolada en el máximo real (dBFS)
    """
    # [WHY] La DFT discreta muestrea el espectro continuo en bins separados
    # Δf = fs/N Hz. La frecuencia real de un parcial tonal raramente cae
    # exactamente en un bin; sin interpolación el error puede ser hasta Δf/2
    # (~10 Hz con N=2048 y fs=44100). La interpolación parabólica aprovecha
    # la simetría del lóbulo principal de la ventana Hann para estimar la
    # posición sub-bin con un error residual de ~Δf/50, lo cual es crucial
    # para rastrear armónicos del cello y para que la síntesis no desafine.
    a = mag_db[k - 1]
    b = mag_db[k]
    c = mag_db[k + 1]
    denom = a - 2.0 * b + c
    if abs(denom) < 1e-10:
        return 0.0, b
    offset    = 0.5 * (a - c) / denom
    offset    = float(np.clip(offset, -1.0, 1.0))
    mag_peak  = b - 0.25 * (a - c) * offset   # valor en el vértice de la parábola
    return offset, mag_peak


def detect_peaks(mag_db: np.ndarray, n_fft: int, sr: int,
                 n_max: int = N_PEAKS_MAX,
                 threshold: float = PEAK_THRESH):
    """
    Detecta picos locales en el espectro de un frame.

    Retorna
    -------
    freqs : ndarray de frecuencias en Hz (orden descendente de magnitud)
    mags  : ndarray de magnitudes en dBFS
    """
    peaks_k    = []
    peaks_freq = []
    peaks_mag  = []
    freq_res   = sr / n_fft   # Hz por bin

    # [WHY] Buscamos máximos locales (un bin que supere a sus dos vecinos
    # inmediatos) porque los parciales armónicos del cello se manifiestan
    # como lóbulos principales estrechos en el espectro: un máximo local es
    # la evidencia inequívoca de una componente sinusoidal presente en ese
    # frame. Simplemente tomar los N bins más grandes introduciría aliasing:
    # el mismo lóbulo principal contribuiría con múltiples bins.
    n_bins = len(mag_db)
    for k in range(1, n_bins - 1):
        if (mag_db[k] > mag_db[k - 1] and
                mag_db[k] > mag_db[k + 1] and
                mag_db[k] > threshold):
            offset, mag_interp = _parabolic_interp(mag_db, k)
            freq = (k + offset) * freq_res
            # [WHY] Limitamos el rango a 60-8000 Hz porque el cello tiene
            # fundamentos en ~65-1047 Hz con armónicos hasta ~8 kHz.
            # Picos por encima de 8 kHz son casi siempre ruido de cuantización
            # o artefactos de la grabación; incluirlos consumiría osciladores
            # sin beneficio perceptual.
            if 60.0 < freq < 8000.0:
                peaks_freq.append(freq)
                peaks_mag.append(mag_interp)

    if len(peaks_freq) == 0:
        return np.array([]), np.array([])

    freqs = np.array(peaks_freq)
    mags  = np.array(peaks_mag)

    # [WHY] Seleccionamos los n_max picos más fuertes pero los devolvemos en su 
    # orden original de descubrimiento (frecuencia ascendente). 
    # Esto permite que mq_tracking() decida su propio orden de procesamiento 
    # (re-ordenando por magnitud), mientras que mq_tracking_sin_orden() los 
    # procesará en orden de frecuencia. Esto es clave para que los picos de 
    # ruido de baja frecuencia "roben" la trayectoria antes que los armónicos 
    # principales.
    if len(mags) > n_max:
        idx_strong = np.argsort(mags)[::-1][:n_max]
        idx_freq   = np.sort(idx_strong)
        return freqs[idx_freq], mags[idx_freq]

    return freqs, mags


# ─────────────────────────────────────────────────────────────────────────────
# MÓDULO 4a · CLASE TRACK
# ─────────────────────────────────────────────────────────────────────────────

class Track:
    """Trayectoria sinusoidal activa o completada."""
    _counter = 0

    def __init__(self, start_frame: int, freq: float, mag: float):
        Track._counter += 1
        self.tid         = Track._counter
        self.start_frame = start_frame
        self.freqs       = [freq]
        self.mags        = [mag]
        self.alive       = True

    # ── métodos de conveniencia ──────────────────────────────
    def extend(self, freq: float, mag: float):
        self.freqs.append(freq)
        self.mags.append(mag)

    def kill(self):
        self.alive = False

    def __len__(self):
        return len(self.freqs)

    def energy(self) -> float:
        """Energía total del track (suma de amplitudes lineales)."""
        return float(np.sum(10.0 ** (np.asarray(self.mags) / 20.0)))


# ─────────────────────────────────────────────────────────────────────────────
# MÓDULO 4b · TRACKING McAULAY-QUATIERI (CON MEMORIA)
# ─────────────────────────────────────────────────────────────────────────────

def mq_tracking(all_freqs: list, all_mags: list,
                freq_tol: float = FREQ_TOL_HZ) -> list:
    """
    Implementa el algoritmo Match / Birth / Death de McAulay-Quatieri.

    Parámetros
    ----------
    all_freqs : lista de n_frames arrays de frecuencias detectadas
    all_mags  : lista de n_frames arrays de magnitudes dBFS
    freq_tol  : ventana de búsqueda en Hz para emparejar picos consecutivos

    Retorna
    -------
    Lista de todos los Track (vivos y muertos).
    """
    Track._counter = 0
    active   = []    # tracks vivos en este momento
    finished = []    # tracks que ya murieron

    for frame_idx, (freqs, mags) in enumerate(zip(all_freqs, all_mags)):
        if freqs.size == 0:
            # Frame silencioso: matar todos los tracks activos
            for t in active:
                t.kill()
                finished.append(t)
            active = []
            continue

        # ── PASO: MATCHING ────────────────────────────────────────────────
        # [WHY] Ordenamos los PICOS ACTUALES por magnitud descendente antes
        # de hacer el matching. Los parciales perceptualmente más importantes
        # (más fuertes) tienen prioridad en la asignación: si dos picos están
        # igualmente cerca de un track activo, el más fuerte "gana" la
        # continuidad. Esto mantiene la coherencia de los armónicos dominantes
        # a costa de los débiles, que el oído prioriza de la misma manera.
        order_cur    = np.argsort(mags)[::-1]
        cur_freqs    = freqs[order_cur]
        cur_mags     = mags[order_cur]

        matched_tracks = set()   # índices de tracks ya pareados
        matched_peaks  = set()   # índices de picos ya pareados

        for pi, (pf, pm) in enumerate(zip(cur_freqs, cur_mags)):
            best_ti   = None
            best_dist = freq_tol

            for ti, t in enumerate(active):
                if ti in matched_tracks:
                    continue
                dist = abs(t.freqs[-1] - pf)
                if dist < best_dist:
                    best_dist = dist
                    best_ti   = ti

            if best_ti is not None:
                active[best_ti].extend(pf, pm)
                matched_tracks.add(best_ti)
                matched_peaks.add(pi)

        # ── PASO: DEATH ───────────────────────────────────────────────────
        # [WHY] Un track "muere" cuando ningún pico del frame actual se
        # encuentra dentro de la ventana freq_tol Hz. Esto modela el cese
        # físico de un parcial: fin de nota, cambio de posición del arco que
        # extingue un armónico, o simplemente que ese armónico cayó bajo el
        # umbral de detección. Mantener tracks "zombies" más allá de su vida
        # real introduciría componentes sinusoidales fantasmas en la síntesis.
        new_active = []
        for ti, t in enumerate(active):
            if ti in matched_tracks:
                new_active.append(t)
            else:
                t.kill()
                finished.append(t)
        active = new_active

        # ── PASO: BIRTH ───────────────────────────────────────────────────
        # [WHY] Los picos sin match son "nacimientos": componentes sinusoidales
        # nuevas que aparecen en este frame. Corresponden al ataque de una nota
        # nueva (la cuerda empieza a vibrar), a un armónico que supera el
        # umbral de detección, o al inicio de una transición musical. Crear un
        # track nuevo es la única forma honesta de representar la aparición de
        # energía en una frecuencia que antes no estaba presente.
        for pi, (pf, pm) in enumerate(zip(cur_freqs, cur_mags)):
            if pi not in matched_peaks:
                new_t = Track(start_frame=frame_idx, freq=pf, mag=pm)
                active.append(new_t)

    # Al terminar, matar todos los tracks todavía activos
    for t in active:
        t.kill()
        finished.append(t)

    return finished


# ─────────────────────────────────────────────────────────────────────────────
# MÓDULO 4b2 · TRACKING McAULAY-QUATIERI (SIN ORDEN DE MAGNITUD)
# ─────────────────────────────────────────────────────────────────────────────

def mq_tracking_sin_orden(all_freqs: list, all_mags: list,
                          freq_tol: float = FREQ_TOL_HZ) -> list:
    """
    Variante del algoritmo Match / Birth / Death de McAulay-Quatieri
    sin ordenamiento previo por magnitud.
    """
    # [WHY] Al no ordenar los picos por magnitud antes de hacer el emparejamiento,
    # los picos se procesan en el orden arbitrario en que los entregó el detector
    # (típicamente de menor a mayor frecuencia). Esto significa que un pico de
    # ruido débil puede "robarle" prematuramente la trayectoria a un armónico
    # principal si se encuentra dentro de la tolerancia freq_tol y es evaluado
    # antes. Acústicamente, esto genera un "burbujeo" (warbling) o gorjeo inestable,
    # ya que las trayectorias saltan caóticamente entre componentes reales y
    # espurios, perdiendo la solidez del tono fundamental.
    Track._counter = 0
    active   = []    # tracks vivos en este momento
    finished = []    # tracks que ya murieron

    for frame_idx, (freqs, mags) in enumerate(zip(all_freqs, all_mags)):
        if freqs.size == 0:
            # Frame silencioso: matar todos los tracks activos
            for t in active:
                t.kill()
                finished.append(t)
            active = []
            continue

        # Usamos las matrices crudas sin np.argsort
        cur_freqs = freqs
        cur_mags  = mags

        matched_tracks = set()   # índices de tracks ya pareados
        matched_peaks  = set()   # índices de picos ya pareados

        # ── PASO: MATCHING ────────────────────────────────────────────────
        for pi, (pf, pm) in enumerate(zip(cur_freqs, cur_mags)):
            best_ti   = None
            best_dist = freq_tol

            for ti, t in enumerate(active):
                if ti in matched_tracks:
                    continue
                dist = abs(t.freqs[-1] - pf)
                if dist < best_dist:
                    best_dist = dist
                    best_ti   = ti

            if best_ti is not None:
                active[best_ti].extend(pf, pm)
                matched_tracks.add(best_ti)
                matched_peaks.add(pi)

        # ── PASO: DEATH ───────────────────────────────────────────────────
        new_active = []
        for ti, t in enumerate(active):
            if ti in matched_tracks:
                new_active.append(t)
            else:
                t.kill()
                finished.append(t)
        active = new_active

        # ── PASO: BIRTH ───────────────────────────────────────────────────
        for pi, (pf, pm) in enumerate(zip(cur_freqs, cur_mags)):
            if pi not in matched_peaks:
                new_t = Track(start_frame=frame_idx, freq=pf, mag=pm)
                active.append(new_t)

    # Al terminar, matar todos los tracks todavía activos
    for t in active:
        t.kill()
        finished.append(t)

    return finished


# ─────────────────────────────────────────────────────────────────────────────
# MÓDULO 4c · TRACKING "ROTO" — SIN MEMORIA
# ─────────────────────────────────────────────────────────────────────────────

def broken_tracking(all_freqs: list, all_mags: list,
                    n_tracks: int = 30) -> list:
    """
    Asignación frame-a-frame por magnitud descendente, sin continuidad temporal.

    Cada "track i" recibe en cada frame el i-ésimo pico más fuerte,
    sin importar si es el mismo parcial físico que el frame anterior.
    """
    # [WHY] Este rastreador "roto" es el contra-ejemplo pedagógico: ignora
    # completamente la continuidad de fase entre frames. El resultado es que
    # el "track 1" puede corresponder al 1.er armónico en un frame y al 5.º
    # en el siguiente si éste se vuelve más fuerte. Al sintetizar, la fase
    # acumulada no pertenece a ninguna sinusoide física real: el oscilador
    # salta discontinuamente entre frecuencias muy distintas. El oído percibe
    # esto como clics metálicos, "zipper noise" y pérdida total del timbre
    # característico del instrumento. Es la demostración auditiva de POR QUÉ
    # el algoritmo MQ con continuidad de fase es necesario.
    n_frames      = len(all_freqs)
    mat_freqs     = np.zeros((n_frames, n_tracks), dtype=np.float64)
    mat_mags      = np.full((n_frames, n_tracks), PEAK_THRESH - 10.0)

    for fi, (freqs, mags) in enumerate(zip(all_freqs, all_mags)):
        if freqs.size == 0:
            continue
        order = np.argsort(mags)[::-1]
        k     = min(n_tracks, len(freqs))
        mat_freqs[fi, :k] = freqs[order[:k]]
        mat_mags[fi,  :k] = mags[order[:k]]

    # Envolver en objetos Track para reutilizar la función de síntesis
    fake_tracks = []
    for ti in range(n_tracks):
        t             = Track.__new__(Track)
        t.tid         = -(ti + 1)
        t.start_frame = 0
        t.alive       = False
        t.freqs       = list(mat_freqs[:, ti])
        t.mags        = list(mat_mags[:,  ti])
        fake_tracks.append(t)

    return fake_tracks


# ─────────────────────────────────────────────────────────────────────────────
# MÓDULO 5 · SÍNTESIS ADITIVA CON FASE CONTINUA
# ─────────────────────────────────────────────────────────────────────────────

def _select_tracks(tracks: list, n_select) -> list:
    """Retorna los n_select tracks de mayor energía total (o todos si n_select es None)."""
    if n_select is None or n_select >= len(tracks):
        return tracks
    # [WHY] Seleccionamos los tracks con mayor energía total (integral de la
    # amplitud lineal a lo largo de su duración) porque son los parciales
    # perceptualmente dominantes. El oído integra la energía de cada parcial
    # para construir el timbre percibido; usar los más energéticos primero
    # garantiza que con pocos osciladores ya captamos la identidad tonal del
    # instrumento, mientras que los de baja energía son los últimos en ser
    # agregados (como en la síntesis aditiva clásica de Hammond).
    energies = [t.energy() for t in tracks]
    order    = np.argsort(energies)[::-1]
    return [tracks[i] for i in order[:n_select]]


def synthesize_tracks(tracks: list, hop: int, sr: int,
                      n_total_samples: int,
                      n_select=None) -> np.ndarray:
    """
    Síntesis aditiva de sinusoides con fase continua.

    Parámetros
    ----------
    tracks         : lista de Track (MQ o broken)
    hop            : salto en muestras
    sr             : tasa de muestreo
    n_total_samples: longitud de la señal de salida
    n_select       : número de tracks a usar (los más energéticos)

    Retorna
    -------
    Señal sintetizada normalizada, float32.
    """
    selected = _select_tracks(tracks, n_select)
    output   = np.zeros(n_total_samples, dtype=np.float64)

    for t in selected:
        n_t    = len(t.freqs)
        if n_t < 2:
            continue

        freqs_arr = np.asarray(t.freqs,  dtype=np.float64)
        amps_arr  = 10.0 ** (np.asarray(t.mags, dtype=np.float64) / 20.0)
        offset    = t.start_frame

        # [WHY] La FASE CONTINUA es la piedra angular de la síntesis SMS.
        # Acumulamos la fase muestra a muestra integrando la frecuencia
        # instantánea: φ(n) = φ(n-1) + 2π·f(n)/sr. Si reiniciáramos la fase
        # en cada hop (Phase Reset), tendríamos discontinuidades de fase en
        # cada frontera entre frames. Una discontinuidad de Δφ en la fase de
        # un oscilador produce un "clic" cuya amplitud es proporcional a
        # A·sin(Δφ). Con 30 osciladores saltando de fase 60 veces por segundo
        # se obtiene una cortina de clics ininteligible: exactamente lo que
        # produce el "tracker roto" (cello_30_ROTO.wav).
        phase = 0.0

        for fi in range(n_t - 1):
            global_frame = offset + fi
            s_start      = global_frame * hop
            s_end        = min(s_start + hop, n_total_samples)
            n_samp       = s_end - s_start
            if n_samp <= 0:
                break

            f0, f1 = freqs_arr[fi],  freqs_arr[fi + 1]
            a0, a1 = amps_arr[fi],   amps_arr[fi + 1]

            t_vec = np.arange(n_samp, dtype=np.float64)

            # [WHY] Interpolamos linealmente frecuencia y amplitud entre frames
            # consecutivos para modelar la transición suave entre estados
            # espectrales del instrumento (vibrato, glissando, transientes de
            # arco). Sin interpolación, tendríamos frecuencias y amplitudes en
            # escalera: saltos discretos cada 512 muestras (~11 ms) que el
            # oído percibiría como modulación de amplitud a 86 Hz, añadiendo
            # un tono parasitario indeseado en el rango de los agudos.
            f_interp = f0 + (f1 - f0) * t_vec / hop
            a_interp = a0 + (a1 - a0) * t_vec / hop

            # Acumulación de fase (integración numérica de la frecuencia)
            phases = phase + 2.0 * np.pi * np.cumsum(f_interp) / sr
            output[s_start:s_end] += a_interp * np.sin(phases)

            phase = float(phases[-1])   # conservar fase para el siguiente hop

    # Normalizar a pico ±0.95 para evitar clipping en el WAV
    peak = np.max(np.abs(output))
    if peak > 1e-12:
        output *= 0.95 / peak

    return output.astype(np.float32)


# ─────────────────────────────────────────────────────────────────────────────
# MÓDULO 6 · MODELADO ESTOCÁSTICO (RESIDUO SMS)
# ─────────────────────────────────────────────────────────────────────────────

def modelar_ruido_estocastico(residuo_crudo: np.ndarray,
                               n_fft: int = 2048, hop: int = 512) -> np.ndarray:
    """
    Modela el componente estocástico SMS a partir del residuo crudo.

    Suaviza la envolvente espectral del residuo con filtro mediana y
    sintetiza ruido blanco moldeado con esa envolvente (fase aleatoria).

    Retorna
    -------
    Señal estocástica normalizada, float32.
    """
    rng    = np.random.default_rng(0)
    n_orig = len(residuo_crudo)

    # [WHY] Calculamos la STFT del residuo crudo para separar "qué frecuencias
    # tienen energía" de "cuál es la fase de esa energía". El objetivo es
    # conservar la envolvente espectral (textura del arco, ruido de sala,
    # inharmonicidad no modelada) pero DESCARTAR la fase original, que contiene
    # coherencia de los parciales que quedaron mal cancelados al restar la
    # síntesis aditiva (cuya fase comienza en φ₀=0, mientras que la grabación
    # tiene fase arbitraria en cada parcial).
    _, _, Zxx = scipy_stft(residuo_crudo.astype(np.float64),
                           nperseg=n_fft, noverlap=n_fft - hop,
                           window='hann', padded=True)
    mag = np.abs(Zxx)   # shape: (n_bins, n_frames)

    # [WHY] El filtro mediana sobre el eje de frecuencia (size=50 bins ≈ 525 Hz
    # con N_FFT=2048 y sr=44100) elimina los picos tonales que sobrevivieron en
    # el residuo porque la fase de la síntesis aditiva (φ₀=0) no coincide con
    # la fase de la grabación. Sin este suavizado, el "ruido" contendría
    # sinusoides fantasmas audibles como parciales del cello. El resultado es una
    # envolvente espectral suave que modela únicamente la densidad de energía
    # del ruido de arco y sala.
    mag_smooth = median_filter(mag, size=(50, 1))

    # [WHY] Asignamos fase aleatoria uniforme en [0, 2π). Este es el principio
    # fundamental del modelo estocástico SMS: la componente de ruido no tiene
    # coherencia de fase entre frames (a diferencia de un parcial tonal, cuya
    # fase acumula de forma determinista). La fase aleatoria regenera la textura
    # del ruido sin reproducir su realización particular, lo que permite
    # time-stretching y pitch-shifting independientes sobre el residuo.
    random_phase = rng.uniform(0.0, 2.0 * np.pi, mag_smooth.shape)
    Zxx_stoch    = mag_smooth * np.exp(1j * random_phase)

    # [WHY] La ISTFT reconstruye la señal temporal. Usamos los mismos parámetros
    # (n_fft, hop, Hann) que en el análisis para que el Overlap-Add interno
    # sea consistente y no introduzca ripple de reconstrucción.
    _, audio_out = scipy_istft(Zxx_stoch,
                               nperseg=n_fft, noverlap=n_fft - hop,
                               window='hann')
    audio_out = audio_out.real
    if len(audio_out) >= n_orig:
        audio_out = audio_out[:n_orig]
    else:
        audio_out = np.pad(audio_out, (0, n_orig - len(audio_out)))

    peak = np.max(np.abs(audio_out))
    if peak > 1e-12:
        audio_out *= 0.95 / peak

    return audio_out.astype(np.float32)


# ─────────────────────────────────────────────────────────────────────────────
# MÓDULO 7 · VISUALIZACIÓN
# ─────────────────────────────────────────────────────────────────────────────

def plot_stft_figure(mag_db: np.ndarray, hop: int, sr: int, n_fft: int,
                     out_path: str = "plot_stft.png",
                     title_stem: str = ""):
    """
    Genera el espectrograma STFT (Tiempo vs Frecuencia, color = dBFS).
    """
    n_frames, n_bins = mag_db.shape
    freq_res = sr / n_fft
    max_freq_hz = 8000.0
    max_bin = min(n_bins, int(max_freq_hz / freq_res) + 1)

    # Eje tiempo (segundos) y eje frecuencia (Hz)
    times = np.arange(n_frames) * hop / sr
    freqs = np.arange(max_bin) * freq_res

    # mag_db shape: (n_frames, n_bins) → recortar y transponer para imshow
    Z = mag_db[:, :max_bin].T   # shape: (max_bin, n_frames)

    fig, ax = plt.subplots(figsize=(14, 5))
    vmin = -90.0
    vmax = 0.0
    img = ax.pcolormesh(times, freqs, Z, cmap="magma",
                        vmin=vmin, vmax=vmax, shading="auto")
    plt.colorbar(img, ax=ax, label="Magnitud (dBFS)")
    ax.set_xlabel("Tiempo (s)", fontsize=12)
    ax.set_ylabel("Frecuencia (Hz)", fontsize=12)
    ax.set_ylim(0, max_freq_hz)
    label = f"{title_stem}.wav  |  " if title_stem else ""
    ax.set_title(
        "STFT — Espectrograma\n"
        f"{label}N_FFT={n_fft}, hop={hop}, ventana Hann",
        fontsize=11
    )
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"  [OK] {out_path}")


def plot_tracks_figure(tracks: list, hop: int, sr: int,
                       out_path: str = "plot_tracks.png",
                       n_top: int = 80,
                       title_stem: str = ""):
    """
    Genera el gráfico espagueti Tiempo vs Frecuencia de los parciales.
    """
    # Seleccionar los n_top más energéticos
    energies   = [t.energy() for t in tracks]
    order      = np.argsort(energies)[::-1]
    top_tracks = [tracks[i] for i in order[:n_top]]

    fig, ax = plt.subplots(figsize=(14, 6))

    # [WHY] Graficamos Tiempo (eje X) vs Frecuencia (eje Y) con color
    # proporcional a la magnitud relativa. Este "gráfico espagueti" revela
    # directamente la estructura armónica: los parciales bajos del cello
    # (fundamento y primeros armónicos) aparecen como líneas densas y
    # continuas en la parte inferior; los armónicos altos son líneas más tenues
    # y cortas. La continuidad de las líneas valida que el tracker MQ conecta
    # correctamente el mismo parcial físico a lo largo del tiempo, mientras
    # que gaps o saltos verticales exponen transiciones entre notas.
    all_times  = []
    all_freqs  = []
    all_colors = []

    for t in top_tracks:
        n = len(t.freqs)
        times  = (t.start_frame + np.arange(n)) * hop / sr
        freqs  = np.asarray(t.freqs)
        mags   = np.asarray(t.mags)
        c_vals = (mags - mags.min()) / (mags.max() - mags.min() + 1e-6)
        all_times.append(times)
        all_freqs.append(freqs)
        all_colors.append(c_vals)

    for times, freqs, c_vals in zip(all_times, all_freqs, all_colors):
        sc = ax.scatter(times, freqs, c=c_vals, cmap="inferno",
                        s=0.8, alpha=0.85, vmin=0.0, vmax=1.0)

    sm = plt.cm.ScalarMappable(cmap="inferno",
                                norm=plt.Normalize(vmin=0, vmax=1))
    sm.set_array([])
    plt.colorbar(sm, ax=ax, label="Magnitud normalizada")

    ax.set_xlabel("Tiempo (s)", fontsize=12)
    ax.set_ylabel("Frecuencia (Hz)", fontsize=12)
    # Ampliamos a 8000 Hz (el límite de detect_peaks) para ver toda la actividad
    ax.set_ylim(0, 8000)
    label = f"{title_stem}.wav  |  " if title_stem else ""
    ax.set_title(
        "SMS — Trayectorias de Parciales (McAulay-Quatieri)\n"
        f"{label}N_FFT={N_FFT}, hop={HOP}, "
        f"freq_tol={FREQ_TOL_HZ} Hz, top {n_top} tracks",
        fontsize=11
    )
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"  [OK] {out_path}")


# ─────────────────────────────────────────────────────────────────────────────
# MÓDULO 8 · UTILIDADES DE GUARDADO
# ─────────────────────────────────────────────────────────────────────────────

def save_wav(path: str, signal: np.ndarray, sr: int):
    """Guarda la señal como WAV PCM-16 bits, con saturación suave."""
    sig = np.clip(signal, -1.0, 1.0)
    sf.write(path, sig, sr, subtype="PCM_16")
    dur = len(sig) / sr
    print(f"  [OK] {path}  ({dur:.2f}s)")


# ─────────────────────────────────────────────────────────────────────────────
# MÓDULO 9 · PROCESAMIENTO DE UN SOLO ARCHIVO
# ─────────────────────────────────────────────────────────────────────────────

def process_file(input_path: str, stem: str, out_dir: str):
    """
    Ejecuta el pipeline SMS completo sobre un archivo WAV y guarda todos
    los resultados con el prefijo <stem> dentro de out_dir.

    Parámetros
    ----------
    input_path : ruta absoluta al archivo WAV de entrada
    stem       : nombre base del archivo sin extensión (usado como prefijo)
    out_dir    : carpeta de destino para todos los archivos generados
    """
    sep = "=" * 64

    def out(filename):
        return os.path.join(out_dir, f"{stem}_{filename}")

    print(f"\n{sep}")
    print(f"  SMS — McAulay-Quatieri  |  {stem}.wav")
    print(f"{sep}\n")

    # ── 1. CARGAR AUDIO ──────────────────────────────────────────────────
    print("[1/8] Cargando audio...")
    signal, sr = load_audio(input_path)
    n_samples  = len(signal)
    print(f"      sr={sr} Hz  |  duración={n_samples/sr:.2f}s  |  {n_samples} muestras")

    # ── 2. STFT ──────────────────────────────────────────────────────────
    print(f"\n[2/8] Calculando STFT  (N_FFT={N_FFT}, hop={HOP})...")
    stft_matrix, mag_db = compute_stft(signal, N_FFT, HOP)
    n_frames = stft_matrix.shape[0]
    freq_res = sr / N_FFT
    print(f"      {n_frames} frames  |  resolución espectral = {freq_res:.2f} Hz/bin")

    # ── 3. DETECCIÓN DE PICOS + INTERPOLACIÓN PARABÓLICA ─────────────────
    print("\n[3/8] Detectando picos + interpolación parabólica...")
    all_peak_freqs = []
    all_peak_mags  = []

    for i in range(n_frames):
        pf, pm = detect_peaks(mag_db[i], N_FFT, sr)
        all_peak_freqs.append(pf)
        all_peak_mags.append(pm)

    total_peaks = sum(len(f) for f in all_peak_freqs)
    print(f"      Total picos: {total_peaks}  "
          f"(promedio {total_peaks/n_frames:.1f} / frame)")

    # ── 4a. TRACKING McAULAY-QUATIERI ────────────────────────────────────
    print("\n[4a/8] Tracking McAulay-Quatieri...")
    # Reiniciar el contador de IDs para que cada archivo empiece desde 1
    Track._counter = 0
    all_tracks = mq_tracking(all_peak_freqs, all_peak_mags,
                              freq_tol=FREQ_TOL_HZ)

    # [WHY] Filtramos tracks con menos de MIN_TRACK_LEN frames porque son
    # casi siempre ruido de detección o transitorios percusivos no sinusoidales
    # (ej. el golpe de arco al inicio de nota). Usarlos en la síntesis
    # añadiría osciladores de vida muy corta cuya contribución energética es
    # despreciable pero cuyo costo computacional no lo es.
    long_tracks = [t for t in all_tracks if len(t) >= MIN_TRACK_LEN]
    print(f"      Tracks totales:          {len(all_tracks)}")
    print(f"      Tracks >= {MIN_TRACK_LEN} frames: {len(long_tracks)}")

    # ── 4b. TRACKING "ROTO" ───────────────────────────────────────────────
    print("\n[4b/8] Tracking 'sin memoria' (broken)...")
    broken_tracks = broken_tracking(all_peak_freqs, all_peak_mags, n_tracks=30)
    print(f"      {len(broken_tracks)} pseudo-tracks creados (sin continuidad temporal)")

    # ── 4c. TRACKING SIN ORDEN ───────────────────────────────────────────
    print("\n[4c/8] Tracking McAulay-Quatieri (sin orden)...")
    Track._counter = 0
    tracks_sin_orden = mq_tracking_sin_orden(all_peak_freqs, all_peak_mags, freq_tol=FREQ_TOL_HZ)
    long_tracks_sin_orden = [t for t in tracks_sin_orden if len(t) >= MIN_TRACK_LEN]
    print(f"      Tracks totales:          {len(tracks_sin_orden)}")
    print(f"      Tracks >= {MIN_TRACK_LEN} frames: {len(long_tracks_sin_orden)}")

    # ── 5. SÍNTESIS ADITIVA ──────────────────────────────────────────────
    print("\n[5/8] Síntesis aditiva (1–30 parciales)...")
    synths = {}
    for n in range(1, 31):
        print(f"      {n:3d} parcial(es)...", end=" ", flush=True)
        synths[n] = synthesize_tracks(long_tracks, HOP, sr, n_samples, n_select=n)
        print("listo")

    print("      ROTO (30, sin memoria)...", end=" ", flush=True)
    synth_roto = synthesize_tracks(broken_tracks, HOP, sr, n_samples, n_select=None)
    print("listo")

    print("      SIN ORDEN (30)...", end=" ", flush=True)
    synth_sin_orden = synthesize_tracks(long_tracks_sin_orden, HOP, sr, n_samples, n_select=30)
    print("listo")

    # ── 6. MODELADO ESTOCÁSTICO ───────────────────────────────────────────
    print("\n[6/8] Modelando componente estocástico (residuo de 30 parciales)...")
    residuo_crudo = (signal - synths[30].astype(np.float64)).astype(np.float32)
    ruido_real    = modelar_ruido_estocastico(residuo_crudo, n_fft=N_FFT, hop=HOP)
    sms_completo  = synths[30] + (ruido_real * 0.1).astype(np.float32)  # Atenuado para no robar protagonismo
    peak_sms      = np.max(np.abs(sms_completo))
    if peak_sms > 1e-12:
        sms_completo = (sms_completo * (0.95 / peak_sms)).astype(np.float32)
    print("      listo")

    # ── 7. VISUALIZACIÓN ─────────────────────────────────────────────────
    print("\n[7/8] Generando gráficos...")
    plot_stft_figure(mag_db, HOP, sr, N_FFT, out("stft.png"), title_stem=stem)
    plot_tracks_figure(long_tracks, HOP, sr, out("plot_tracks.png"),
                       n_top=80, title_stem=stem)
    plot_tracks_figure(long_tracks_sin_orden, HOP, sr, out("plot_tracks_sin_orden.png"),
                       n_top=80, title_stem=stem + " (Sin Orden)")

    # ── 8. GUARDAR ARCHIVOS WAV ──────────────────────────────────────────
    print("\n[8/8] Guardando archivos WAV...")
    for n, synth in synths.items():
        label = "parcial" if n == 1 else "parciales"
        save_wav(out(f"{n:02d}_{label}.wav"), synth, sr)
    save_wav(out("30_ROTO.wav"),         synth_roto,    sr)
    save_wav(out("30_SIN_ORDEN.wav"),    synth_sin_orden, sr)
    save_wav(out("30_residuo_crudo.wav"), residuo_crudo, sr)
    save_wav(out("30_ruido_puro.wav"),    ruido_real,    sr)
    save_wav(out("30_SMS_completo.wav"),  sms_completo,  sr)

    # ── 8.5 COPIA AUTOMÁTICA A LA PRESENTACIÓN ────────────────────────────
    print("\n[8.5/8] Copiando resultados a la presentación (sms-slides)...")
    try:
        slides_audio_dir = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "sms-slides", "public", "audio"))
        if os.path.isdir(slides_audio_dir):
            shutil.copy2(out("30_residuo_crudo.wav"), os.path.join(slides_audio_dir, "violin_residuo_crudo.wav"))
            shutil.copy2(out("30_ruido_puro.wav"),    os.path.join(slides_audio_dir, "violin_ruido_puro.wav"))
            shutil.copy2(out("30_SMS_completo.wav"),  os.path.join(slides_audio_dir, "violin_sms_completo.wav"))
            print(f"      [OK] Archivos de audio actualizados en '{slides_audio_dir}'")
        else:
            print(f"      [WARN] No se encontró la carpeta de la presentación: '{slides_audio_dir}'")
    except Exception as e:
        print(f"      [ERROR] Falló la copia a la presentación: {e}")

    # ── RESUMEN PARCIAL ───────────────────────────────────────────────────
    print(f"\n  Archivos generados para '{stem}':")
    print(f"    outputs/{stem}_plot_tracks.png")
    print(f"    outputs/{stem}_plot_tracks_sin_orden.png")
    for n in range(1, 31):
        label = "parcial" if n == 1 else "parciales"
        print(f"    outputs/{stem}_{n:02d}_{label}.wav")
    print(f"    outputs/{stem}_30_ROTO.wav")
    print(f"    outputs/{stem}_30_SIN_ORDEN.wav")
    print(f"    outputs/{stem}_30_residuo_crudo.wav")
    print(f"    outputs/{stem}_30_ruido_puro.wav")
    print(f"    outputs/{stem}_30_SMS_completo.wav")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN · loop sobre todos los WAV de inputs/
# ─────────────────────────────────────────────────────────────────────────────

def main():
    sep = "=" * 64

    # Asegurar que existe la carpeta inputs/
    if not os.path.isdir(INPUT_DIR):
        os.makedirs(INPUT_DIR, exist_ok=True)
        print(f"\n[INFO] Se ha creado la carpeta '{INPUT_DIR}/'.")
        print(f"       Coloca allí tus archivos WAV para procesarlos.")
        return

    # Recoger todos los archivos WAV (insensible a mayúsculas en la extensión)
    wav_files = sorted(
        f for f in os.listdir(INPUT_DIR)
        if f.lower().endswith(".wav")
    )

    if not wav_files:
        print(f"\nERROR: No se encontraron archivos .wav dentro de '{INPUT_DIR}/'.")
        sys.exit(1)

    # Crear carpeta de salida si no existe
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"\n{sep}")
    print(f"  SMS Demo — McAulay-Quatieri")
    print(f"  {len(wav_files)} archivo(s) encontrado(s) en '{INPUT_DIR}/'")
    print(f"  Resultados -> '{OUTPUT_DIR}/'")
    print(f"{sep}")

    for idx, filename in enumerate(wav_files, start=1):
        stem       = os.path.splitext(filename)[0]   # nombre sin extensión
        input_path = os.path.join(INPUT_DIR, filename)
        print(f"\n>>> [{idx}/{len(wav_files)}] Procesando: {filename}")
        process_file(input_path, stem, OUTPUT_DIR)

    print(f"\n{sep}")
    print(f"  Demostración completada. Todos los resultados están en '{OUTPUT_DIR}/'.")
    print(f"{sep}\n")


if __name__ == "__main__":
    main()
