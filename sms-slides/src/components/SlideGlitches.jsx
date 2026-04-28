import { useState, useRef, useEffect } from 'react';

export default function SlideGlitches() {
  const [activeAudio, setActiveAudio] = useState(null); // 'memoria' | 'orden'

  const memoriaRef = useRef(null);
  const ordenRef = useRef(null);

  const refs = { memoria: memoriaRef, orden: ordenRef };

  const handlePlay = (key) => {
    // Pausar todos los demás
    Object.entries(refs).forEach(([k, ref]) => {
      if (k !== key && ref.current) {
        ref.current.pause();
        ref.current.currentTime = 0;
      }
    });

    const audio = refs[key].current;
    if (!audio) return;

    if (activeAudio === key) {
      audio.pause();
      setActiveAudio(null);
    } else {
      audio.play().catch(err => console.warn('Audio play error:', err));
      setActiveAudio(key);
    }
  };

  useEffect(() => {
    const handleEnded = () => setActiveAudio(null);
    [memoriaRef, ordenRef].forEach(ref => {
      if (ref.current) ref.current.addEventListener('ended', handleEnded);
    });
    return () => {
      [memoriaRef, ordenRef].forEach(ref => {
        if (ref.current) ref.current.removeEventListener('ended', handleEnded);
      });
    };
  }, []);

  const PlayBtn = ({ id, label }) => (
    <button
      onClick={() => handlePlay(id)}
      className={`w-full py-2.5 rounded-lg font-sans text-sm font-500 transition-colors flex justify-center items-center gap-2
        ${id === 'memoria'
          ? activeAudio === id ? 'bg-amber-500 text-white shadow-sm' : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
          : activeAudio === id ? 'bg-red-500   text-white shadow-sm' : 'bg-red-500/10   text-red-600   hover:bg-red-500/20'
        }`}
    >
      {activeAudio === id ? (
        <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg> Pausar</>
      ) : (
        <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg> {label}</>
      )}
    </button>
  );

  return (
    <div className="max-w-[95vw] xl:max-w-7xl mx-auto px-6 py-4">

      {/* Header */}
      <div className="mb-6 anim-fade-up">
        <span className="font-sans text-xs tracking-[0.2em] uppercase text-ink-faint">
          10 · Autopsia del Tracking
        </span>
        <h2 className="font-serif text-4xl sm:text-5xl font-500 text-ink mt-1">
          Autopsia Auditiva: Glitches del Tracking
        </h2>
        <p className="text-ink-light text-base mt-3 max-w-4xl leading-relaxed">
          Dos fallos del algoritmo McAulay-Quatieri: qué línea de código se rompe y cómo suena.
        </p>
      </div>

      {/* 2 columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 anim-fade-up delay-2">

        {/* ── Tarjeta 1: Sin Memoria ── */}
        <div className={`flex flex-col p-8 rounded-2xl border transition-all duration-300
          ${activeAudio === 'memoria'
            ? 'bg-amber-50 border-amber-500 ring-1 ring-amber-400/50 shadow-lg scale-[1.02]'
            : 'bg-white border-border hover:border-amber-300 shadow-sm'}`}>

          <div className="flex items-center justify-between mb-5">
            <h3 className={`font-sans font-600 text-[0.95rem] uppercase tracking-wider
              ${activeAudio === 'memoria' ? 'text-amber-600' : 'text-ink-light'}`}>
              1. Sin Memoria Temporal (Zipper Noise)
            </h3>
            <div className={`w-3 h-3 rounded-full transition-colors flex-shrink-0
              ${activeAudio === 'memoria' ? 'bg-amber-500 animate-pulse' : 'bg-border'}`} />
          </div>

          <p className="text-[1rem] text-ink-light leading-relaxed mb-5">
            Ignorar el historial del oscilador genera saltos de frecuencia violentos (clics).
          </p>

          <div className="bg-[#1e1e1e] rounded-xl p-4 mb-6 flex-1 overflow-x-auto text-[0.82rem] font-mono leading-6 shadow-inner border border-white/5">
            <pre className="text-gray-300 whitespace-pre">{
              `# [ERROR FATAL]: Asignación directa sin conectar trayectorias
`}<span className="text-[#569cd6]">for</span>{` i `}<span className="text-[#569cd6]">in</span>{` `}<span className="text-[#dcdcaa]">range</span>{`(num_osc):
    # El oscilador salta instantáneamente a donde caiga el pico
    osciladores[i].freq = picos_actuales[i]`}</pre>
          </div>

          <PlayBtn id="memoria" label="Escuchar Glitch 1" />
          <audio ref={memoriaRef} src="/audio/violin_30_ROTO.wav" preload="auto" />
        </div>

        {/* ── Tarjeta 2: Sin Orden ── */}
        <div className={`flex flex-col p-8 rounded-2xl border transition-all duration-300
          ${activeAudio === 'orden'
            ? 'bg-red-50 border-red-500 ring-1 ring-red-400/50 shadow-lg scale-[1.02]'
            : 'bg-white border-border hover:border-red-300 shadow-sm'}`}>

          <div className="flex items-center justify-between mb-5">
            <h3 className={`font-sans font-600 text-[0.95rem] uppercase tracking-wider
              ${activeAudio === 'orden' ? 'text-red-600' : 'text-ink-light'}`}>
              2. Sin Orden de Magnitud (Burbujeo)
            </h3>
            <div className={`w-3 h-3 rounded-full transition-colors flex-shrink-0
              ${activeAudio === 'orden' ? 'bg-red-500 animate-pulse' : 'bg-border'}`} />
          </div>

          <p className="text-[1rem] text-ink-light leading-relaxed mb-5">
            Sin priorizar los picos fuertes, un ruido débil "roba" el camino de un armónico principal.
          </p>

          <div className="bg-[#1e1e1e] rounded-xl p-4 mb-6 flex-1 overflow-x-auto text-[0.82rem] font-mono leading-6 shadow-inner border border-white/5">
            <pre className="text-gray-300 whitespace-pre">{`alive_tracks = [tr `}<span className="text-[#569cd6]">for</span>{` tr `}<span className="text-[#569cd6]">in</span>{` tracks `}<span className="text-[#569cd6]">if</span>{` tr[`}<span className="text-[#ce9178]">'alive'</span>{`]]

`}<span className="text-emerald-400"># [LÍNEA ELIMINADA] - ¡Causa el glitch de burbujeo!</span>{`
`}<span className="text-red-400 line-through"># alive_tracks.sort(key=lambda tr: tr['mags'][-1], reverse=True)</span>{`

`}<span className="text-[#569cd6]">for</span>{` tr `}<span className="text-[#569cd6]">in</span>{` alive_tracks:
    `}<span className="text-emerald-400"># Se empareja al azar...</span></pre>
          </div>

          <PlayBtn id="orden" label="Escuchar Glitch 2" />
          <audio ref={ordenRef} src="/audio/violin_30_SIN_ORDEN.wav" preload="auto" />
        </div>

      </div>
    </div>
  );
}
