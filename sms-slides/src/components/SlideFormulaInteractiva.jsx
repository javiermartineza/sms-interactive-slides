import { useState, useEffect, useRef, useMemo } from 'react';
import katex from 'katex';

const ACCENT = '#2563eb';

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

function getAudioSrc(n) {
  const nn = String(n).padStart(2, '0');
  return n === 1
    ? `/audio/violin_${nn}_parcial.wav`
    : `/audio/violin_${nn}_parciales.wav`;
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

export default function SlideFormulaInteractiva() {
  const [show, setShow] = useState(false);
  const [value, setValue] = useState(5);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => { setShow(true); }, []);

  useEffect(() => {
    return () => {
      clearTimeout(debounceRef.current);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
    };
  }, []);

  // Formula: everything except the limit number is static; L(t) shows dynamic colored value
  const formulaHtml = useMemo(() => {
    const tex = `s(t) = \\sum_{j=1}^{\\textcolor{${ACCENT}}{${value}}} A_j(t) \\cos(\\phi_j(t))`;
    return renderLatex(tex, true);
  }, [value]);

  function loadAndPlay(n) {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    const audio = new Audio(getAudioSrc(n));
    audio.addEventListener('ended', () => setIsPlaying(false));
    audioRef.current = audio;
    audio.play().catch(() => {});
    setIsPlaying(true);
  }

  function handleSliderChange(e) {
    const n = parseInt(e.target.value, 10);
    setValue(n);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadAndPlay(n), 280);
  }

  function togglePlay() {
    if (!audioRef.current || audioRef.current.src === '' || audioRef.current.src.endsWith('undefined')) {
      loadAndPlay(value);
      return;
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }

  // Partial bars visualization
  const totalBars = 30;

  return (
    <div className="max-w-7xl mx-auto px-8 py-3 flex flex-col" style={{ minHeight: 'calc(100vh - 100px)' }}>
      {/* Header */}
      <div className={`mb-4 ${show ? 'anim-fade-up' : 'opacity-0'}`}>
        <span className="font-sans text-sm tracking-[0.2em] uppercase text-ink-muted font-semibold">
          08 · Síntesis Aditiva
        </span>
        <h2 className="font-serif text-5xl sm:text-6xl font-500 text-ink mt-1">
          Construyendo el Sonido <em>Parcial a Parcial</em>
        </h2>
      </div>

      <div className={`flex flex-col lg:flex-row gap-8 flex-1 items-stretch ${show ? 'anim-fade-up delay-2' : 'opacity-0'}`}>

        {/* Left: formula + slider + play + bars */}
        <div className="lg:w-[48%] flex flex-col gap-5 shrink-0">

          {/* Formula card — larger */}
          <div style={{
            background: '#ffffff',
            border: '2px solid #e0ddd4',
            borderRadius: 20,
            padding: '28px 32px',
            textAlign: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
          }}>
            <div
              dangerouslySetInnerHTML={{ __html: formulaHtml }}
              style={{ fontSize: '1.6em' }}
            />
            <p style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 15,
              color: '#6b6b8a',
              marginTop: 12,
              letterSpacing: '0.04em',
            }}>
              El límite superior{' '}
              <span style={{ color: ACCENT, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                L(t)
              </span>{' '}
              controla cuántos parciales se suman
            </p>
          </div>

          {/* Slider — bigger */}
          <div style={{ padding: '0 4px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}>
              <span style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 15,
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
              </span>
            </div>

            <input
              type="range"
              min={1}
              max={30}
              value={value}
              onChange={handleSliderChange}
              style={{
                width: '100%',
                height: 8,
                appearance: 'none',
                borderRadius: 4,
                background: `linear-gradient(to right, ${ACCENT} ${(value - 1) / 29 * 100}%, #e5e7eb ${(value - 1) / 29 * 100}%)`,
                cursor: 'pointer',
                outline: 'none',
              }}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 6,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              color: '#9ca3af',
            }}>
              <span>1</span>
              <span>15</span>
              <span>30</span>
            </div>
          </div>

          {/* Play/Pause button + wave */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={togglePlay}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 28px',
                borderRadius: 50,
                border: `2.5px solid ${ACCENT}`,
                background: isPlaying ? ACCENT : 'transparent',
                color: isPlaying ? '#fff' : ACCENT,
                fontFamily: "'Inter', sans-serif",
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                letterSpacing: '0.03em',
              }}
            >
              {isPlaying ? (
                <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor">
                  <rect x="1" y="1" width="4" height="10" rx="1" />
                  <rect x="7" y="1" width="4" height="10" rx="1" />
                </svg>
              ) : (
                <svg width="13" height="15" viewBox="0 0 11 13" fill="currentColor">
                  <path d="M1 1.2v10.6L10.2 6.5 1 1.2z" />
                </svg>
              )}
              {isPlaying ? 'Pausar' : 'Reproducir'}
            </button>

            {isPlaying && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <WaveBar active={isPlaying} color={ACCENT} />
                <span style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 15,
                  color: ACCENT,
                  fontWeight: 600,
                }}>
                  {value} {value === 1 ? 'parcial' : 'parciales'}
                </span>
              </div>
            )}
          </div>

          {/* Harmonic spectrum bars */}
          <div style={{
            background: '#ffffff',
            border: '2px solid #e0ddd4',
            borderRadius: 16,
            padding: '16px 16px 10px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
          }}>
            <p style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 700,
              color: '#1a1a2e',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 10,
              textAlign: 'center',
            }}>
              Armónicos activos
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 2,
              height: 100,
            }}>
              {Array.from({ length: totalBars }, (_, i) => {
                const n = i + 1;
                const active = n <= value;
                const maxH = 90;
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
              <span>f₁</span>
              <span>→ armónico n</span>
              <span>30f₁</span>
            </div>
          </div>
        </div>

        {/* Right: Tracks image — the actual partials used */}
        <div className="lg:w-[52%] flex flex-col gap-3">
          <div style={{
            background: '#ffffff',
            border: '2px solid #e0ddd4',
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <img
              src="/imagenes/violin_tracks_parciales.png"
              alt="Trayectorias de parciales McAulay-Quatieri — violín"
              style={{
                width: '100%',
                flex: 1,
                objectFit: 'contain',
                display: 'block',
                background: '#fff',
                padding: '12px 8px 4px',
              }}
            />
            <div style={{
              padding: '10px 20px',
              borderTop: '2px solid #eff6ff',
              background: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <div style={{
                width: 10, height: 10,
                borderRadius: '50%',
                background: ACCENT,
                flexShrink: 0,
              }} />
              <span style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 15,
                color: ACCENT,
                fontWeight: 600,
              }}>
                Trayectorias MQ — parciales del violín utilizados en la síntesis
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}>
            {[
              { label: 'Parciales activos', value: value, color: ACCENT },
              { label: 'Restantes', value: 30 - value, color: '#9ca3af' },
            ].map(({ label, value: v, color }) => (
              <div key={label} style={{
                background: '#fff',
                borderRadius: 12,
                padding: '10px 16px',
                textAlign: 'center',
                border: '2px solid #e0ddd4',
              }}>
                <div style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 28,
                  fontWeight: 700,
                  color,
                  lineHeight: 1,
                }}>
                  {v}
                </div>
                <div style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: 13,
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
    </div>
  );
}
