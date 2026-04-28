import { useState, useRef, useEffect } from 'react';
import { M } from './Math';

export default function SlideResiduoVsRuido() {
  const [activeAudio, setActiveAudio] = useState(null); // 'crudo', 'ruido', 'sms'

  const audioRefs = {
    crudo: useRef(null),
    ruido: useRef(null),
    sms: useRef(null)
  };

  const handlePlay = (key) => {
    // Pausar todos los demás audios
    Object.keys(audioRefs).forEach(k => {
      if (k !== key && audioRefs[k].current) {
        audioRefs[k].current.pause();
        audioRefs[k].current.currentTime = 0;
      }
    });

    // Reproducir o pausar el seleccionado
    const audio = audioRefs[key].current;
    if (audio) {
      if (activeAudio === key) {
        audio.pause();
        setActiveAudio(null);
      } else {
        audio.play();
        setActiveAudio(key);
      }
    }
  };

  // Escuchar el evento ended para resetear el estado
  useEffect(() => {
    const handleEnded = () => setActiveAudio(null);
    Object.values(audioRefs).forEach(ref => {
      if (ref.current) {
        ref.current.addEventListener('ended', handleEnded);
      }
    });
    return () => {
      Object.values(audioRefs).forEach(ref => {
        if (ref.current) {
          ref.current.removeEventListener('ended', handleEnded);
        }
      });
    }
  }, []);

  return (
    <div className="max-w-[95vw] xl:max-w-7xl mx-auto px-6 py-4">
      <div className="mb-6 anim-fade-up">
        <span className="font-sans text-xs tracking-[0.2em] uppercase text-ink-faint">09 · Modelado Estocástico</span>
        <h2 className="font-serif text-4xl sm:text-5xl font-500 text-ink mt-1">
          Residuo vs. Ruido
        </h2>
        <p className="text-ink-light text-base mt-3 max-w-4xl leading-relaxed">
          Escucha la diferencia entre el residuo crudo (que aún conserva ecos del instrumento original)
          y el modelo estocástico puro generado por SMS.
        </p>

        {/* Leyenda de Variables */}
        <div className="mt-5 flex flex-wrap gap-5 font-mono text-base text-ink-muted bg-white/50 p-4 rounded-xl border border-border inline-flex shadow-sm items-center">
          <span className="bg-white px-4 py-2 rounded-lg shadow-sm border border-border-light flex items-center gap-3"><strong className="text-ink text-xl">x(t)</strong> = Audio original</span>
          <span className="bg-white px-4 py-2 rounded-lg shadow-sm border border-border-light flex items-center gap-3"><strong className="text-ink text-xl">s(t)</strong> = <M t={"\\sum_{r=1}^{R} A_r(t) \\cos(\\theta_r(t))"} className="text-xl" /></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 anim-fade-up delay-2">

        {/* Panel 1: Residuo Crudo */}
        <div className={`flex flex-col p-8 rounded-2xl border transition-all duration-300 ${activeAudio === 'crudo' ? 'bg-accent-red/5 border-accent-red ring-1 ring-accent-red/50 shadow-lg scale-[1.02]' : 'bg-white border-border hover:border-accent-red/30 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`font-sans font-600 text-[0.95rem] uppercase tracking-wider ${activeAudio === 'crudo' ? 'text-accent-red' : 'text-ink-light'}`}>
              1. Residuo Crudo
            </h3>
            <div className={`w-3 h-3 rounded-full transition-colors ${activeAudio === 'crudo' ? 'bg-accent-red animate-pulse' : 'bg-border'}`} />
          </div>

          <div className={`py-6 mb-6 flex justify-center items-center transition-colors ${activeAudio === 'crudo' ? 'text-accent-red' : 'text-ink'}`}>
            <M t={"e(t) = x(t) - s(t)"} d={true} className="text-4xl" />
          </div>

          <p className="text-[1rem] text-ink-light leading-relaxed mb-8 flex-1">
            La resta en el tiempo deja ecos tonales debido al desajuste de fase entre la grabación original y la síntesis aditiva determinista.
          </p>

          <button
            onClick={() => handlePlay('crudo')}
            className={`w-full py-2.5 rounded-lg font-sans text-sm font-500 transition-colors flex justify-center items-center gap-2 ${activeAudio === 'crudo' ? 'bg-accent-red text-white shadow-sm' : 'bg-accent-red/10 text-accent-red hover:bg-accent-red/20'}`}
          >
            {activeAudio === 'crudo' ? (
              <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg> Pausar</>
            ) : (
              <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg> Escuchar</>
            )}
          </button>
          <audio ref={audioRefs.crudo} src="/audio/violin_residuo_crudo.wav" preload="auto" />
        </div>

        {/* Panel 2: Ruido Modelado */}
        <div className={`flex flex-col p-8 rounded-2xl border transition-all duration-300 ${activeAudio === 'ruido' ? 'bg-accent-green/5 border-accent-green ring-1 ring-accent-green/50 shadow-lg scale-[1.02]' : 'bg-white border-border hover:border-accent-green/30 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`font-sans font-600 text-[0.95rem] uppercase tracking-wider ${activeAudio === 'ruido' ? 'text-accent-green' : 'text-ink-light'}`}>
              2. Ruido Modelado
            </h3>
            <div className={`w-3 h-3 rounded-full transition-colors ${activeAudio === 'ruido' ? 'bg-accent-green animate-pulse' : 'bg-border'}`} />
          </div>

          <div className={`py-6 mb-6 flex justify-center items-center transition-colors w-full ${activeAudio === 'ruido' ? 'text-accent-green' : 'text-ink'}`}>
            <M t={"R(m,k) = \\text{Mediana}(|E(m,k)|) \\cdot e^{j U(-\\pi, \\pi)}"} d={true} className="text-[0.85rem] lg:text-[1rem]" />
          </div>

          <p className="text-[1rem] text-ink-light leading-relaxed mb-8 flex-1">
            Extraemos la envolvente espectral suave y aplicamos fase aleatoria (ruido blanco) para obtener la fricción pura del arco sin ecos.
          </p>

          <button
            onClick={() => handlePlay('ruido')}
            className={`w-full py-2.5 rounded-lg font-sans text-sm font-500 transition-colors flex justify-center items-center gap-2 ${activeAudio === 'ruido' ? 'bg-accent-green text-white shadow-sm' : 'bg-accent-green/10 text-accent-green hover:bg-accent-green/20'}`}
          >
            {activeAudio === 'ruido' ? (
              <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg> Pausar</>
            ) : (
              <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg> Escuchar</>
            )}
          </button>
          <audio ref={audioRefs.ruido} src="/audio/violin_ruido_puro.wav" preload="auto" />
        </div>

        {/* Panel 3: SMS Completo */}
        <div className={`flex flex-col p-8 rounded-2xl border transition-all duration-300 ${activeAudio === 'sms' ? 'bg-accent-blue/5 border-accent-blue ring-1 ring-accent-blue/50 shadow-lg scale-[1.02]' : 'bg-white border-border hover:border-accent-blue/30 shadow-sm'}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`font-sans font-600 text-[0.95rem] uppercase tracking-wider ${activeAudio === 'sms' ? 'text-accent-blue' : 'text-ink-light'}`}>
              3. SMS Completo
            </h3>
            <div className={`w-3 h-3 rounded-full transition-colors ${activeAudio === 'sms' ? 'bg-accent-blue animate-pulse' : 'bg-border'}`} />
          </div>

          <div className={`py-6 mb-6 flex justify-center items-center transition-colors ${activeAudio === 'sms' ? 'text-accent-blue' : 'text-ink'}`}>
            <M t={"x'(t) = s(t) + r(t)"} d={true} className="text-4xl" />
          </div>

          <p className="text-[1rem] text-ink-light leading-relaxed mb-8 flex-1">
            Suma final de las componentes deterministas (los 30 parciales más fuertes de la síntesis aditiva) y el modelo estocástico puro.
          </p>

          <button
            onClick={() => handlePlay('sms')}
            className={`w-full py-2.5 rounded-lg font-sans text-sm font-500 transition-colors flex justify-center items-center gap-2 ${activeAudio === 'sms' ? 'bg-accent-blue text-white shadow-sm' : 'bg-accent-blue/10 text-accent-blue hover:bg-accent-blue/20'}`}
          >
            {activeAudio === 'sms' ? (
              <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg> Pausar</>
            ) : (
              <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg> Escuchar</>
            )}
          </button>
          <audio ref={audioRefs.sms} src="/audio/violin_sms_completo.wav" preload="auto" />
        </div>

      </div>
    </div>
  );
}
