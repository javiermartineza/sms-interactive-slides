import numpy as np
from scipy.fft import rfft

# ─────────────────────────────────────────────────────────────────────────────
# 2 · Detectar — encuentra los picos en un frame 📍
# ─────────────────────────────────────────────────────────────────────────────
def detect_peaks(mX, thresh_db=-60):
    """
    Devuelve los índices (bins) donde mX tiene un pico local por encima del umbral.
    mX debe estar en dB.
    Implementación vectorizada con numpy.
    """
    # Evitamos extremos (índice 0 y último) porque no tienen ambos vecinos
    cond_thresh = mX[1:-1] > thresh_db
    cond_left   = mX[1:-1] > mX[:-2]
    cond_right  = mX[1:-1] > mX[2:]

    # Los picos están en índices 1..N-2, sumamos 1 para recuperar índice original
    peaks = np.where(cond_thresh & cond_left & cond_right)[0] + 1
    return peaks


# ─────────────────────────────────────────────────────────────────────────────
# 3 · Interpolar — refina la frecuencia con parábola 🎯
# ─────────────────────────────────────────────────────────────────────────────
def parabolic_interp(mX, plocs):
    """
    Refina las posiciones de los picos con interpolación parabólica.
    Devuelve (iplocs_float, ipmags) — arrays del mismo largo que plocs.

    Fórmulas:
        δ = 0.5 * (α - γ) / (α - 2β + γ)
        |X|_real = β - 0.25 * (α - γ) * δ
    """
    alpha = mX[plocs - 1]
    beta  = mX[plocs]
    gamma = mX[plocs + 1]

    delta = 0.5 * (alpha - gamma) / (alpha - 2*beta + gamma + 1e-12)
    iplocs = plocs + delta
    ipmags = beta - 0.25 * (alpha - gamma) * delta

    return iplocs, ipmags


# ─────────────────────────────────────────────────────────────────────────────
# 4 · Rastrear — conecta picos entre frames (McAulay-Quatieri) 🕵️
# ─────────────────────────────────────────────────────────────────────────────
def track_peaks(escena, fs=44100, n_fft=2048, hop=512, thresh_db=-50, max_dev_hz=30):
    """
    Analiza toda la señal con el algoritmo McAulay-Quatieri simplificado.
    Devuelve la lista de tracks (dicts con 'freqs', 'mags', 'start_frame', 'alive').

    Decisiones por frame:
        MATCH  → pico cercano a track vivo (|Δf| < max_dev_hz)
        DEATH  → track vivo sin pico cercano
        BIRTH  → pico sin track padre
    """
    w = np.hanning(n_fft)
    tracks = []  # lista de dicts con historia por track
    n_frames = (len(escena) - n_fft) // hop + 1

    for m in range(n_frames):
        frame = escena[m*hop : m*hop + n_fft] * w
        mX = 20 * np.log10(np.abs(rfft(frame)) + 1e-12)
        plocs = detect_peaks(mX, thresh_db)

        if plocs is None or len(plocs) == 0:
            # Todos los tracks vivos mueren en este frame
            for tr in tracks:
                if tr['alive']:
                    tr['alive'] = False
            continue

        iplocs, ipmags = parabolic_interp(mX, plocs)
        cand_freqs = iplocs * fs / n_fft
        cand_mags  = ipmags
        used = set()

        # ── 1. MATCH: tracks vivos eligen primero (por magnitud descendente) ──
        alive_tracks = [tr for tr in tracks if tr['alive']]
        alive_tracks.sort(key=lambda tr: tr['mags'][-1], reverse=True)

        for tr in alive_tracks:
            last_f = tr['freqs'][-1]
            dists = np.abs(cand_freqs - last_f)

            # Buscar candidato no usado más cercano
            best_idx = -1
            best_dist = float('inf')
            for i in range(len(cand_freqs)):
                if i in used:
                    continue
                if dists[i] < best_dist:
                    best_dist = dists[i]
                    best_idx = i

            if best_idx != -1 and best_dist < max_dev_hz:
                # MATCH: continuar track
                tr['freqs'].append(cand_freqs[best_idx])
                tr['mags'].append(cand_mags[best_idx])
                used.add(best_idx)
            else:
                # DEATH: no hay candidato cercano
                tr['alive'] = False

        # ── 2. BIRTH: candidatos no usados son tracks nuevos ──
        for i in range(len(cand_freqs)):
            if i in used:
                continue
            tracks.append({
                'freqs': [cand_freqs[i]],
                'mags': [cand_mags[i]],
                'start_frame': m,
                'alive': True
            })

    return tracks
