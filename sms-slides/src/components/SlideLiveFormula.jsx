import { useState, useEffect, useRef, useMemo } from 'react';
import katex from 'katex';
import { useLiveVoice } from '../voice/LiveVoiceContext';

const ACCENT = '#2563eb';
const RES_RED = '#c0392b';
const FAINT = '#9ca3af';

function renderLatex(tex, display = false) {
  try {
    return katex.renderToString(tex, {
      throwOnError: false,
      displayMode: display,
      trust: true,
      strict: false,
    });
  } catch {
    return tex;
  }
}

function WaveBar({ active, color }) {
  const [bars, setBars] = useState([5, 10, 16, 10, 5]);
  useEffect(() => {
    if (!active) { setBars([5, 10, 16, 10, 5]); return; }
    const id = setInterval(() => {
      setBars([
        4 + Math.random() * 10,
        5 + Math.random() * 16,
        6 + Math.random() * 20,
        5 + Math.random() * 16,
        4 + Math.random() * 10,
      ]);
    }, 120);
    return () => clearInterval(id);
  }, [active]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 28 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 5,
          height: active ? h : 3,
          borderRadius: 3,
          backgroundColor: active ? color : '#d1d5db',
          transition: 'height 0.1s ease, background-color 0.3s',
          alignSelf: 'center',
        }} />
      ))}
    </div>
  );
}

export default function SlideLiveFormula() {
  const [show, setShow] = useState(false);
  const { status, session } = useLiveVoice();
  const ready = status === 'ready' && !!session;
  const maxParciales = ready ? Math.max(1, session.nParciales) : 30;

  const [value, setValue] = useState(5);
  // 'idle' | 'partials' | 'residue'
  const [playMode, setPlayMode] = useState('idle');
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => { setShow(true); }, []);

  // Asegurar value en rango cuando cambia la sesión
  useEffect(() => {
    if (ready) {
      setValue(v => Math.min(Math.max(1, v), maxParciales));
      // detener audio si había uno
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      setIsPlaying(false);
      setPlayMode('idle');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
    };
  }, []);

  // ── Fórmula KaTeX con resaltado dinámico ─────────────────────────────────
  const formulaHtml = useMemo(() => {
    const isRes = playMode === 'residue';
    const sumColor = isRes ? FAINT : ACCENT;
    const resColor = isRes ? RES_RED : RES_RED + '88';
    const limit = isRes ? '\\textcolor{' + FAINT + '}{R}'
                        : `\\textcolor{${ACCENT}}{${value}}`;
    const detTerm = isRes
      ? `\\textcolor{${FAINT}}{\\hat{A}_r(t)\\,\\cos[\\hat{\\theta}_r(t)]}`
      : `\\textcolor{${ACCENT}}{\\hat{A}_r(t)\\,\\cos[\\hat{\\theta}_r(t)]}`;
    const tex =
      `s(t) = \\textcolor{${sumColor}}{\\sum_{r=1}^{${limit}}}\\, ${detTerm}` +
      ` \\;+\\; \\textcolor{${resColor}}{e(t)}`;
    return renderLatex(tex, true);
  }, [value, playMode]);

  function audioForCount(n) {
    if (!ready) return null;
    const key = `parcial_${String(n).padStart(2, '0')}`;
    return session.audio[key] || null;
  }

  function loadAndPlay(src, mode) {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    if (!src) {
      setIsPlaying(false);
      setPlayMode('idle');
      return;
    }
    const audio = new Audio(src);
    audio.addEventListener('ended', () => setIsPlaying(false));
    audioRef.current = audio;
    audio.play().catch(() => {});
    setIsPlaying(true);
    setPlayMode(mode);
  }

  function handleSliderChange(e) {
    const n = parseInt(e.target.value, 10);
    setValue(n);
    if (!ready) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadAndPlay(audioForCount(n), 'partials');
    }, 280);
  }

  function togglePartials() {
    if (!ready) return;
    if (playMode === 'partials' && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    if (playMode === 'partials' && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
      return;
    }
    loadAndPlay(audioForCount(value), 'partials');
  }

  function toggleResidue() {
    if (!ready) return;
    if (playMode === 'residue' && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    loadAndPlay(session.audio.residuo, 'residue');
  }

  const totalBars = maxParciales;
  const isResMode = playMode === 'residue';

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-8 py-3 flex flex-col" style={{ minHeight: 'calc(100vh - 100px)' }}>
      {/* Header */}
      <div className={`mb-4 ${show ? 'anim-fade-up' : 'opacity-0'}`}>
        <span className="font-sans text-sm tracking-[0.2em] uppercase text-ink-muted font-semibold">
          06 · Síntesis Aditiva · Voz
        </span>
        <h2 className="font-serif text-5xl sm:text-6xl font-500 text-ink mt-1">
          Tu Voz <em>Parcial a Parcial</em>
        </h2>
      </div>

      {!ready && (
        <div className={`flex-1 flex items-center justify-center ${show ? 'anim-fade-up delay-2' : 'opacity-0'}`}>
          <div style={{
            border: '2px dashed #d1cdc4',
            borderRadius: 18,
            padding: '36px 44px',
            textAlign: 'center',
            background: '#fdfcf8',
            maxWidth: 460,
          }}>
            <p className="font-sans" style={{ fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9e9eb8', fontWeight: 600 }}>
              Esperando captura
            </p>
            <p className="font-serif" style={{ fontSize: 22, color: '#1a1a2e', marginTop: 8, lineHeight: 1.35 }}>
              Vuelve a la slide anterior y graba 3 a 5 segundos de tu voz.
              <br/> Luego podrás escuchar la síntesis aditiva parcial a parcial.
            </p>
          </div>
        </div>
      )}

      {ready && (
      <div className={`flex flex-col lg:flex-row gap-8 flex-1 items-stretch ${show ? 'anim-fade-up delay-2' : 'opacity-0'}`}>

        {/* Left: formula + slider + controles */}
        <div className="lg:w-[48%] flex flex-col gap-5 shrink-0">

          {/* Formula card */}
          <div style={{
            background: '#ffffff',
            border: '2px solid #e0ddd4',
            borderRadius: 20,
            padding: '26px 28px',
            textAlign: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
          }}>
            <div
              dangerouslySetInnerHTML={{ __html: formulaHtml }}
              style={{ fontSize: '1.45em' }}
            />
            <p style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 14,
              color: '#6b6b8a',
              marginTop: 12,
              letterSpacing: '0.03em',
              lineHeight: 1.5,
            }}>
              <span style={{ color: ACCENT, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>R</span>{' '}
              parciales reconstruyen la parte determinista;{' '}
              <span style={{ color: RES_RED, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>e(t)</span>{' '}
              es el residuo estocástico (lo no modelado por sinusoides).
            </p>
          </div>

          {/* Slider */}
          <div style={{ padding: '0 4px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}>
              <span style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 14,
                fontWeight: 700,
                color: '#1a1a2e',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}>
                Parciales activos
              </span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 36,
                fontWeight: 700,
                color: ACCENT,
                lineHeight: 1,
              }}>
                {value}
                <span style={{ fontSize: 18, color: '#9ca3af', marginLeft: 4 }}>
                  / {maxParciales}
                </span>
              </span>
            </div>

            <input
              type="range"
              min={1}
              max={maxParciales}
              value={value}
              onChange={handleSliderChange}
              style={{
                width: '100%',
                height: 8,
                appearance: 'none',
                borderRadius: 4,
                background: `linear-gradient(to right, ${ACCENT} ${(value - 1) / Math.max(1, maxParciales - 1) * 100}%, #e5e7eb ${(value - 1) / Math.max(1, maxParciales - 1) * 100}%)`,
                cursor: 'pointer',
                outline: 'none',
              }}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 6,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              color: '#9ca3af',
            }}>
              <span>1</span>
              <span>{Math.round(maxParciales / 2)}</span>
              <span>{maxParciales}</span>
            </div>
          </div>

          {/* Controles de reproducción */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button
              onClick={togglePartials}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 24px',
                borderRadius: 50,
                border: `2.5px solid ${ACCENT}`,
                background: (isPlaying && playMode === 'partials') ? ACCENT : 'transparent',
                color: (isPlaying && playMode === 'partials') ? '#fff' : ACCENT,
                fontFamily: "'Inter', sans-serif",
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                letterSpacing: '0.03em',
              }}
            >
              {(isPlaying && playMode === 'partials') ? (
                <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor">
                  <rect x="1" y="1" width="4" height="10" rx="1" />
                  <rect x="7" y="1" width="4" height="10" rx="1" />
                </svg>
              ) : (
                <svg width="12" height="14" viewBox="0 0 11 13" fill="currentColor">
                  <path d="M1 1.2v10.6L10.2 6.5 1 1.2z" />
                </svg>
              )}
              {(isPlaying && playMode === 'partials') ? 'Pausar' : 'Reproducir parciales'}
            </button>

            {(isPlaying && playMode === 'partials') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <WaveBar active color={ACCENT} />
                <span style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 14,
                  color: ACCENT,
                  fontWeight: 600,
                }}>
                  {value} {value === 1 ? 'parcial' : 'parciales'}
                </span>
              </div>
            )}
          </div>

          {/* Botón especial: residuo estocástico */}
          <div style={{
            background: isResMode ? '#fef2f2' : '#fff',
            border: `2px solid ${isResMode ? RES_RED : '#e0ddd4'}`,
            borderRadius: 16,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            transition: 'background 0.25s, border-color 0.25s',
          }}>
            <button
              onClick={toggleResidue}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 22px',
                borderRadius: 50,
                border: `2.5px solid ${RES_RED}`,
                background: (isPlaying && isResMode) ? RES_RED : RES_RED,
                color: '#fff',
                fontFamily: "'Inter', sans-serif",
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '0.03em',
                boxShadow: (isPlaying && isResMode) ? `0 0 0 6px ${RES_RED}22` : 'none',
                transition: 'box-shadow 0.25s',
              }}
            >
              {(isPlaying && isResMode) ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <rect x="1" y="1" width="4" height="10" rx="1" />
                  <rect x="7" y="1" width="4" height="10" rx="1" />
                </svg>
              ) : (
                <svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor">
                  <path d="M1 1.2v10.6L10.2 6.5 1 1.2z" />
                </svg>
              )}
              Escuchar Residuo Estocástico
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                fontWeight: 700,
                color: RES_RED,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}>
                e(t) — el aliento
              </div>
              <div style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 12,
                color: '#6b6b8a',
                marginTop: 2,
                lineHeight: 1.35,
              }}>
                Solo el componente no modelado por sinusoides.
              </div>
            </div>
          </div>

          {/* Barras armónicas */}
          <div style={{
            background: '#ffffff',
            border: '2px solid #e0ddd4',
            borderRadius: 16,
            padding: '14px 16px 8px',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <p style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              fontWeight: 700,
              color: '#1a1a2e',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 8,
              textAlign: 'center',
            }}>
              Tracks activos
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 2,
              height: 80,
            }}>
              {Array.from({ length: totalBars }, (_, i) => {
                const n = i + 1;
                const active = n <= value && !isResMode;
                const maxH = 76;
                const h = Math.max(4, maxH / n);
                return (
                  <div
                    key={n}
                    style={{
                      flex: 1,
                      height: h,
                      borderRadius: '3px 3px 0 0',
                      backgroundColor: active ? ACCENT : '#e5e7eb',
                      transition: 'background-color 0.15s ease',
                      opacity: active ? 1 : 0.5,
                    }}
                  />
                );
              })}
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 6,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              color: '#9ca3af',
            }}>
              <span>track 1</span>
              <span>energía ↓</span>
              <span>track {maxParciales}</span>
            </div>
          </div>
        </div>

        {/* Right: tracks image + stats */}
        <div className="lg:w-[52%] flex flex-col gap-3">
          <div style={{
            background: '#ffffff',
            border: `2px solid ${isResMode ? RES_RED + '55' : '#e0ddd4'}`,
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            transition: 'border-color 0.3s',
          }}>
            <img
              src={session.images.tracks}
              alt="Trayectorias MQ — voz grabada"
              style={{
                width: '100%',
                flex: 1,
                objectFit: 'contain',
                display: 'block',
                background: '#fff',
                padding: '10px 8px 4px',
                opacity: isResMode ? 0.4 : 1,
                transition: 'opacity 0.3s',
              }}
            />
            <div style={{
              padding: '10px 18px',
              borderTop: `2px solid ${isResMode ? '#fef2f2' : '#eff6ff'}`,
              background: isResMode ? '#fef2f2' : '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              transition: 'background 0.3s, border-color 0.3s',
            }}>
              <div style={{
                width: 10, height: 10,
                borderRadius: '50%',
                background: isResMode ? RES_RED : ACCENT,
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 14,
                color: isResMode ? RES_RED : ACCENT,
                fontWeight: 600,
              }}>
                {isResMode
                  ? 'Residuo en escena: las sinusoides quedan en silencio.'
                  : 'Trayectorias MQ — parciales de tu voz utilizados en la síntesis'}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10,
          }}>
            {[
              { label: 'Activos', value: value, color: ACCENT },
              { label: 'Restantes', value: Math.max(0, maxParciales - value), color: '#9ca3af' },
              { label: 'Tracks totales', value: maxParciales, color: '#7c3aed' },
            ].map(({ label, value: v, color }) => (
              <div key={label} style={{
                background: '#fff',
                borderRadius: 12,
                padding: '10px 12px',
                textAlign: 'center',
                border: '2px solid #e0ddd4',
              }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 26,
                  fontWeight: 700,
                  color,
                  lineHeight: 1,
                }}>
                  {v}
                </div>
                <div style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 11,
                  color: '#6b6b8a',
                  marginTop: 4,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
