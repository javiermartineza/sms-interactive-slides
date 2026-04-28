import { useState, useEffect, useRef } from 'react';
import { useLiveVoice } from '../voice/LiveVoiceContext';

// Mismo patrón de pipeline que SlidePipelineSMS, pero las imágenes
// se resuelven dinámicamente desde el backend (session.images.<key>).
const PIPELINE = [
  {
    step: 1,
    num: '1',
    title: 'STFT',
    sub: 'Dominio de la frecuencia',
    desc: 'Ventana Hann por frame → FFT → |X(k,m)| en dBFS sobre tu voz. Resolución: 21.53 Hz/bin.',
    color: '#2563eb',
    bg: '#eff6ff',
    imageKey: 'stft',
    caption: 'Espectrograma STFT — tu voz, tiempo vs. frecuencia',
  },
  {
    step: 2,
    num: '2',
    title: 'Peak Detection',
    sub: 'Máximos locales',
    desc: 'En el frame más intenso de tu voz: bins donde |X(k)| supera vecinos y umbral. Rango útil: 60–8000 Hz.',
    color: '#c0392b',
    bg: '#fef2f2',
    imageKey: 'peaks',
    caption: 'Picos detectados en el espectro de un frame de tu voz',
  },
  {
    step: 3,
    num: '3',
    title: 'Interpolación Parabólica',
    sub: 'Ajuste sub-bin',
    desc: 'δ = ½(α−γ)/(α−2β+γ) sobre el pico más fuerte detectado en tu voz. Error de frecuencia: de ±10 Hz a ±0.4 Hz.',
    color: '#d97706',
    bg: '#fffbeb',
    imageKey: 'parabola',
    caption: 'Refinamiento sub-bin sobre un pico real de tu voz',
  },
  {
    step: 4,
    num: '4',
    title: 'Tracking MQ',
    sub: 'Match · Birth · Death',
    desc: 'Conecta los picos de tu voz por proximidad. Mayor energía primero: la Regla de Oro.',
    color: '#16a34a',
    bg: '#f0fdf4',
    imageKey: 'tracks',
    caption: 'Trayectorias McAulay-Quatieri — parciales de tu voz',
  },
];

const BTN_LABELS = [
  'Paso 1: STFT',
  'Paso 2: Peak Detection',
  'Paso 3: Interpolación',
  'Paso 4: Tracking MQ',
  'Reiniciar',
];

function WaveBar({ active }) {
  const [bars, setBars] = useState([4, 9, 15, 9, 4]);
  useEffect(() => {
    if (!active) { setBars([4, 9, 15, 9, 4]); return; }
    const id = setInterval(() => {
      setBars([
        3 + Math.random() * 8,
        5 + Math.random() * 12,
        6 + Math.random() * 18,
        5 + Math.random() * 12,
        3 + Math.random() * 8,
      ]);
    }, 120);
    return () => clearInterval(id);
  }, [active]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 28 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 5,
          height: active ? h * 1.3 : 4,
          borderRadius: 3,
          backgroundColor: active ? '#2563eb' : '#d1d5db',
          transition: 'height 0.1s ease',
          alignSelf: 'center',
        }} />
      ))}
    </div>
  );
}

function ProcessingAnim() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhase((p) => (p + 1) % 24), 90);
    return () => clearInterval(id);
  }, []);
  const bars = Array.from({ length: 22 });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90 }}>
        {bars.map((_, i) => {
          const offset = (i + phase) % bars.length;
          const norm = Math.sin((offset / bars.length) * Math.PI);
          const h = 8 + norm * 78;
          const isStoch = i % 5 === 4;
          return (
            <div key={i} style={{
              width: 7,
              height: h,
              borderRadius: 3,
              backgroundColor: isStoch ? '#c0392b' : '#2563eb',
              opacity: 0.35 + norm * 0.6,
              transition: 'height 0.18s ease, opacity 0.18s ease',
            }} />
          );
        })}
      </div>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 14,
        color: '#7c3aed',
        letterSpacing: '0.06em',
      }}>
        Extrayendo Parciales{'.'.repeat(((phase % 12) / 4 | 0) + 1)}
      </span>
    </div>
  );
}

function ImagePanel({ card }) {
  const [visible, setVisible] = useState(false);
  const [displayed, setDisplayed] = useState(card);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!card) { setVisible(false); return; }
    if (!displayed) { setDisplayed(card); setVisible(true); return; }
    setVisible(false);
    timerRef.current = setTimeout(() => {
      setDisplayed(card);
      setVisible(true);
    }, 260);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card]);

  if (!displayed) {
    return (
      <div style={{
        flex: 1,
        borderRadius: 18,
        border: '2px dashed #d1cdc4',
        background: '#f9f8f5',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 340,
      }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, color: '#9e9eb8', letterSpacing: '0.06em' }}>
          Presiona un paso para ver el resultado
        </span>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(14px)',
      transition: 'opacity 0.35s ease, transform 0.35s ease',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        borderRadius: 18,
        overflow: 'hidden',
        border: `2px solid ${displayed.color}44`,
        background: '#fff',
        boxShadow: '0 6px 32px rgba(0,0,0,0.08)',
      }}>
        <img
          src={displayed.image}
          alt={displayed.caption}
          style={{
            width: '100%',
            height: 370,
            objectFit: 'contain',
            display: 'block',
            background: '#fff',
          }}
        />
        <div style={{
          padding: '12px 20px',
          borderTop: `2px solid ${displayed.color}22`,
          background: displayed.bg,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 10, height: 10,
            borderRadius: '50%',
            background: displayed.color,
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 15,
            color: displayed.color,
            fontWeight: 600,
          }}>
            {displayed.caption}
          </span>
        </div>
      </div>
    </div>
  );
}

function RecordPanel() {
  const { status, errorMsg, recElapsed, minRecSec, maxRecSec, startRecording, stopRecording, reset } = useLiveVoice();
  const recProgress = Math.min(1, recElapsed / maxRecSec);

  return (
    <div style={{
      flex: 1,
      borderRadius: 18,
      border: '2px dashed #d1cdc4',
      background: '#fdfcf8',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 370,
      padding: 28,
    }}>
      {status === 'idle' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, maxWidth: 360, textAlign: 'center' }}>
          <span className="font-sans" style={{ fontSize: 12, color: '#9e9eb8', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600 }}>
            Paso 0 — Captura
          </span>
          <p className="font-serif" style={{ fontSize: 22, color: '#1a1a2e', lineHeight: 1.3 }}>
            Graba <em>3 a 5 segundos</em> de tu voz y deja que el modelo SMS la descomponga.
          </p>
          <button
            onClick={startRecording}
            style={{
              marginTop: 10,
              padding: '14px 30px',
              borderRadius: 50,
              border: '2.5px solid #c0392b',
              background: '#c0392b',
              color: '#fff',
              fontFamily: "'Inter', sans-serif",
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              letterSpacing: '0.04em',
            }}
          >
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff' }} />
            Grabar Voz
          </button>
        </div>
      )}

      {status === 'recording' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#c0392b', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>
            Grabando…
          </span>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 56, color: '#1a1a2e', letterSpacing: '0.04em' }}>
            {recElapsed.toFixed(1)}s
          </div>
          <div style={{ width: 280, height: 8, borderRadius: 4, background: '#f3eee2', overflow: 'hidden' }}>
            <div style={{
              width: `${recProgress * 100}%`,
              height: '100%',
              background: '#c0392b',
              transition: 'width 80ms linear',
            }} />
          </div>
          <p className="font-sans" style={{ fontSize: 13, color: '#9e9eb8' }}>
            Mín {minRecSec}s · Máx {maxRecSec}s (auto-stop)
          </p>
          <button
            onClick={stopRecording}
            style={{
              padding: '8px 20px',
              borderRadius: 50,
              border: '1.5px solid #c0392b',
              background: '#fff',
              color: '#c0392b',
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Detener
          </button>
        </div>
      )}

      {status === 'processing' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, maxWidth: 360, textAlign: 'center' }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#7c3aed', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>
            Análisis SMS
          </span>
          <ProcessingAnim />
          <p className="font-sans" style={{ fontSize: 13, color: '#9e9eb8' }}>
            STFT → Picos → MQ tracking → Síntesis aditiva → Residuo
          </p>
        </div>
      )}

      {status === 'error' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, maxWidth: 360, textAlign: 'center' }}>
          <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: '#c0392b', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>
            Error
          </span>
          <p className="font-sans" style={{ fontSize: 14, color: '#1a1a2e' }}>
            {errorMsg || 'Verifica que el backend esté corriendo en :8765.'}
          </p>
          <button
            onClick={reset}
            style={{
              padding: '8px 20px',
              borderRadius: 50,
              border: '1.5px solid #c0392b',
              background: '#fff',
              color: '#c0392b',
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}

export default function SlideLivePipelineSMS() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const { status, session, reset } = useLiveVoice();
  const ready = status === 'ready' && !!session;

  useEffect(() => { setShow(true); }, []);

  // (Re)cargar audio cuando hay sesión nueva
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsPlaying(false);
    if (ready && session.audio.original) {
      const a = new Audio(session.audio.original);
      a.addEventListener('ended', () => setIsPlaying(false));
      audioRef.current = a;
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [ready, session]);

  // Reset de pasos al cambiar de sesión
  useEffect(() => {
    setStep(0);
  }, [session]);

  function toggleAudio() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }

  function handleStep() {
    if (!ready) return;
    if (step === 4) {
      setStep(0);
      if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    } else {
      setStep(s => s + 1);
    }
  }

  const isLast = step === 4;
  const baseCard = step > 0 ? PIPELINE[step - 1] : null;
  const activeCard = baseCard && ready ? {
    ...baseCard,
    image: session.images[baseCard.imageKey],
  } : null;

  return (
    <div
      className="max-w-7xl mx-auto px-8"
      style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 16, paddingBottom: 12 }}
    >
      {/* Header */}
      <div className={show ? 'anim-fade-up' : 'opacity-0'} style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <span className="font-sans text-base tracking-[0.2em] uppercase text-ink-muted font-semibold">
            05 · Pipeline SMS · Voz
          </span>
          <h2 className="font-serif text-5xl sm:text-6xl font-500 text-ink mt-1">
            Tu Voz al <em>Mapa de Parciales</em>
          </h2>
        </div>
        {ready && (
          <button
            onClick={reset}
            style={{
              padding: '6px 14px',
              borderRadius: 50,
              border: '1.5px solid #d1cfc4',
              background: 'transparent',
              color: '#6b6b8a',
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
            title="Borrar grabación y volver a empezar"
          >
            ↻ Re-grabar
          </button>
        )}
      </div>

      {/* Body */}
      <div
        className={show ? 'anim-fade-up delay-2' : 'opacity-0'}
        style={{ display: 'flex', gap: 32, alignItems: 'stretch' }}
      >
        {/* Left column */}
        <div style={{ width: 310, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Audio player */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 18px',
            borderRadius: 14,
            border: '2px solid #e0ddd4',
            background: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            opacity: ready ? 1 : 0.55,
          }}>
            <button
              onClick={toggleAudio}
              disabled={!ready}
              style={{
                width: 42, height: 42,
                borderRadius: '50%',
                border: '2.5px solid #374151',
                background: isPlaying ? '#374151' : 'transparent',
                color: isPlaying ? '#fff' : '#374151',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: ready ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
            >
              {isPlaying ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <rect x="1" y="1" width="4" height="10" rx="1" />
                  <rect x="7" y="1" width="4" height="10" rx="1" />
                </svg>
              ) : (
                <svg width="11" height="13" viewBox="0 0 11 13" fill="currentColor">
                  <path d="M1 1.2v10.6L10.2 6.5 1 1.2z" />
                </svg>
              )}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 700, color: '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Tu Voz Cruda
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#9e9eb8', marginTop: 2, fontWeight: 600, letterSpacing: '0.1em' }}>
                {ready ? `ENTRADA · ${session.duration.toFixed(1)}s` : 'GRABA PRIMERO'}
              </div>
            </div>
            <WaveBar active={isPlaying} />
          </div>

          {/* Step cards */}
          {PIPELINE.map((card) => {
            const revealed = ready && step >= card.step;
            const active = ready && step === card.step;
            return (
              <div
                key={card.num}
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  border: `2px solid ${active ? card.color : revealed ? card.color + '55' : '#e0ddd4'}`,
                  background: active ? card.bg : revealed ? card.bg + '88' : '#faf9f7',
                  opacity: revealed ? 1 : 0.35,
                  transform: revealed ? 'translateX(0)' : 'translateX(-10px)',
                  transition: 'opacity 0.5s ease, transform 0.5s ease, border-color 0.35s, background 0.35s',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{
                  width: 30, height: 30,
                  borderRadius: '50%',
                  background: revealed ? card.color : '#d1d5db',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                  transition: 'background 0.3s',
                }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#fff',
                    lineHeight: 1,
                  }}>
                    {card.num}
                  </span>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 16,
                    fontWeight: 700,
                    color: revealed ? card.color : '#9ca3af',
                    lineHeight: 1.2,
                    transition: 'color 0.3s',
                  }}>
                    {card.title}
                  </div>
                  <div style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 13,
                    color: revealed ? card.color + 'cc' : '#c0bab0',
                    marginTop: 2,
                    transition: 'color 0.3s',
                    fontWeight: 500,
                  }}>
                    {card.sub}
                  </div>
                  {active && (
                    <p style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 14,
                      color: '#1a1a2e',
                      lineHeight: 1.5,
                      margin: '6px 0 0',
                    }}>
                      {card.desc}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right column */}
        {ready ? <ImagePanel card={activeCard} /> : <RecordPanel />}
      </div>

      {/* Bottom step button (solo cuando hay sesión) */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 4, minHeight: 56 }}>
        {ready ? (
          <button
            onClick={handleStep}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 36px',
              borderRadius: 50,
              border: `2.5px solid ${isLast ? '#9ca3af' : activeCard ? activeCard.color : '#2563eb'}`,
              background: isLast ? 'transparent' : activeCard ? activeCard.color : '#2563eb',
              color: isLast ? '#9ca3af' : '#fff',
              fontFamily: "'Inter', sans-serif",
              fontSize: 17,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.35s',
              letterSpacing: '0.03em',
            }}
          >
            {!isLast && (
              <svg width="15" height="15" viewBox="0 0 15 15" fill="currentColor">
                <polygon points="3,2 13,7.5 3,13" />
              </svg>
            )}
            {BTN_LABELS[step]}
            {isLast && (
              <svg width="14" height="14" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M2 6.5A4.5 4.5 0 1 1 6.5 11" strokeLinecap="round" />
                <path d="M2 11V6.5H6.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        ) : (
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            color: '#9e9eb8',
            letterSpacing: '0.06em',
          }}>
            Graba tu voz para activar los pasos del pipeline.
          </span>
        )}
      </div>
    </div>
  );
}
