import { useState, useEffect, useRef } from 'react';

const LAYERS = [
  {
    key: 'original',
    label: 'Violín Original',
    tag: 'ENTRADA',
    desc: 'Grabación original. Referencia de escucha.',
    color: '#374151',
    tagBg: '#f9fafb',
    tagColor: '#6b7280',
    src: '/audio/violin_original.wav',
  },
  {
    key: '03p',
    label: '3 Parciales',
    tag: 'DETERM.',
    desc: 'Sólo 3 armónicos. Sonido esquelético.',
    color: '#2563eb',
    tagBg: '#eff6ff',
    tagColor: '#2563eb',
    src: '/audio/violin_03_parciales.wav',
  },
  {
    key: '10p',
    label: '10 Parciales',
    tag: 'DETERM.',
    desc: 'Ya reconocible, pero aún muy "sintético".',
    color: '#2563eb',
    tagBg: '#eff6ff',
    tagColor: '#2563eb',
    src: '/audio/violin_10_parciales.wav',
  },
  {
    key: '30p',
    label: '30 Parciales',
    tag: 'DETERM.',
    desc: 'Muy limpio pero sin textura de arco.',
    color: '#2563eb',
    tagBg: '#eff6ff',
    tagColor: '#2563eb',
    src: '/audio/violin_30_parciales.wav',
  },
  {
    key: 'ruido',
    label: 'Ruido Modelado',
    tag: 'ESTOC.',
    desc: 'Residuo estocastizado. Sólo textura de arco.',
    color: '#c0392b',
    tagBg: '#fef2f2',
    tagColor: '#c0392b',
    src: '/audio/violin_ruido_puro.wav',
  },
  {
    key: 'sms',
    label: '30 Parciales + Ruido',
    tag: 'SMS COMPLETO',
    desc: 'Determinista + estocástico. Recupera la textura.',
    color: '#7c3aed',
    tagBg: '#f5f3ff',
    tagColor: '#7c3aed',
    src: '/audio/violin_sms_completo.wav',
  },
  {
    key: 'roto',
    label: '30 Parciales — ROTO',
    tag: 'SIN REGLA DE ORO',
    desc: 'Picos débiles roban trayectorias. Artefactos.',
    color: '#d97706',
    tagBg: '#fffbeb',
    tagColor: '#d97706',
    src: '/audio/violin_30_roto.wav',
  },
];

function WaveIndicator({ color, active }) {
  const [bars, setBars] = useState([4, 8, 14, 8, 4]);

  useEffect(() => {
    if (!active) {
      setBars([4, 8, 14, 8, 4]);
      return;
    }
    const id = setInterval(() => {
      setBars([
        3 + Math.random() * 9,
        4 + Math.random() * 14,
        5 + Math.random() * 18,
        4 + Math.random() * 14,
        3 + Math.random() * 9,
      ]);
    }, 130);
    return () => clearInterval(id);
  }, [active]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, width: 30, height: 24, flexShrink: 0 }}>
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: active ? h : 3,
            borderRadius: 2,
            backgroundColor: active ? color : '#d1d5db',
            transition: 'height 0.12s ease, background-color 0.3s',
            alignSelf: 'center',
          }}
        />
      ))}
    </div>
  );
}

export default function SlideAudioShowcase() {
  const [show, setShow] = useState(false);
  const [playingKey, setPlayingKey] = useState(null);
  const audioRefs = useRef({});

  useEffect(() => { setShow(true); }, []);

  useEffect(() => {
    LAYERS.forEach(layer => {
      const audio = new Audio(layer.src);
      audio.addEventListener('ended', () => {
        setPlayingKey(k => (k === layer.key ? null : k));
      });
      audioRefs.current[layer.key] = audio;
    });
    return () => {
      Object.values(audioRefs.current).forEach(a => { a.pause(); a.src = ''; });
    };
  }, []);

  function handleToggle(key) {
    if (playingKey === key) {
      audioRefs.current[key].pause();
      setPlayingKey(null);
      return;
    }
    if (playingKey && audioRefs.current[playingKey]) {
      audioRefs.current[playingKey].pause();
      audioRefs.current[playingKey].currentTime = 0;
    }
    audioRefs.current[key].currentTime = 0;
    audioRefs.current[key].play();
    setPlayingKey(key);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-3">
      <div className={`mb-4 ${show ? 'anim-fade-up' : 'opacity-0'}`}>
        <span className="font-sans text-xs tracking-[0.2em] uppercase text-ink-faint">09 · Resultados</span>
        <h2 className="font-serif text-4xl sm:text-5xl font-500 text-ink mt-1">
          Resíntesis <em>Progresiva</em>
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* Left: track plot image */}
        <div className={`lg:col-span-3 ${show ? 'anim-fade-up delay-2' : 'opacity-0'}`}>
          <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #e0ddd4', background: '#fff' }}>
            <img
              src="/imagenes/violin_plot_tracks.png"
              alt="Trayectorias de parciales del violín (algoritmo MQ)"
              style={{ width: '100%', height: 330, objectFit: 'contain', background: '#fff', display: 'block' }}
            />
          </div>
          <p className="sidenote mt-2 text-center">
            Trayectorias de parciales extraídas por el algoritmo McAulay-Quatieri
          </p>
        </div>

        {/* Right: audio layers */}
        <div className={`lg:col-span-2 flex flex-col gap-2 ${show ? 'anim-fade-up delay-4' : 'opacity-0'}`}>
          <p className="font-sans text-[10px] font-600 text-ink-faint tracking-[0.18em] uppercase mb-0.5">
            Capas de Reconstrucción
          </p>

          {LAYERS.map(layer => {
            const isPlaying = playingKey === layer.key;
            return (
              <div
                key={layer.key}
                onClick={() => handleToggle(layer.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '7px 10px',
                  borderRadius: 12,
                  border: `1px solid ${isPlaying ? layer.color + '44' : '#e0ddd4'}`,
                  backgroundColor: isPlaying ? `${layer.color}0d` : '#ffffff',
                  cursor: 'pointer',
                  transition: 'border-color 0.25s, background-color 0.25s',
                  userSelect: 'none',
                }}
              >
                <div style={{
                  width: 8, height: 8,
                  borderRadius: '50%',
                  backgroundColor: layer.color,
                  flexShrink: 0,
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                    <span style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: 13,
                      fontWeight: 600,
                      color: isPlaying ? layer.color : '#1a1a2e',
                      transition: 'color 0.2s',
                      whiteSpace: 'nowrap',
                    }}>
                      {layer.label}
                    </span>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 8.5,
                      fontWeight: 500,
                      letterSpacing: '0.05em',
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: layer.tagBg,
                      color: layer.tagColor,
                      border: `1px solid ${layer.color}33`,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}>
                      {layer.tag}
                    </span>
                  </div>
                  <p style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: 11,
                    color: '#6b7280',
                    lineHeight: 1.3,
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {layer.desc}
                  </p>
                </div>

                <WaveIndicator color={layer.color} active={isPlaying} />

                <button
                  onClick={(e) => { e.stopPropagation(); handleToggle(layer.key); }}
                  style={{
                    width: 34, height: 34,
                    borderRadius: '50%',
                    border: `2px solid ${layer.color}`,
                    background: isPlaying ? layer.color : 'transparent',
                    color: isPlaying ? '#fff' : layer.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'background 0.2s, color 0.2s',
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
