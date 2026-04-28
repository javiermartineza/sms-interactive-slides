import { useState, useEffect, useCallback } from 'react';
import SlidePortada from './components/SlidePortada';
import SlidePicketFence from './components/SlidePicketFence';
import SlideMath from './components/SlideMath';
import SlideTracking from './components/SlideTracking';
import SlidePipelineSMS from './components/SlidePipelineSMS';
import SlideFormulaInteractiva from './components/SlideFormulaInteractiva';
import SlideResiduoVsRuido from './components/SlideResiduoVsRuido';
import SlideGlitches from './components/SlideGlitches';
import SlideLivePipelineSMS from './components/SlideLivePipelineSMS';
import SlideLiveFormula from './components/SlideLiveFormula';
import { LiveVoiceProvider } from './voice/LiveVoiceContext';

const SLIDES = [
  { id: 'portada',  component: SlidePortada,           label: 'Portada' },
  { id: 'picket',   component: SlidePicketFence,       label: 'Picket-Fence' },
  { id: 'math',     component: SlideMath,              label: 'Sub-Bin' },
  { id: 'tracking', component: SlideTracking,          label: 'MQ Track' },
  { id: 'live-pipe',component: SlideLivePipelineSMS,   label: 'Pipeline Voz' },
  { id: 'live-form',component: SlideLiveFormula,       label: 'Síntesis Voz' },
  { id: 'pipeline', component: SlidePipelineSMS,       label: 'Pipeline SMS' },
  { id: 'formula',  component: SlideFormulaInteractiva,label: 'Síntesis Aditiva' },
  { id: 'residuo',  component: SlideResiduoVsRuido,    label: 'Residuo vs Ruido' },
  { id: 'glitches', component: SlideGlitches,          label: 'Autopsia Track' },
];

export default function App() {
  const [current, setCurrent] = useState(0);
  const [slideKey, setSlideKey] = useState(0);

  const goTo = useCallback((idx) => {
    if (idx < 0 || idx >= SLIDES.length || idx === current) return;
    setCurrent(idx);
    setSlideKey((k) => k + 1);
  }, [current]);

  const next = useCallback(() => goTo(current + 1), [current, goTo]);
  const prev = useCallback(() => goTo(current - 1), [current, goTo]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev]);

  const SlideComponent = SLIDES[current].component;

  return (
    <LiveVoiceProvider>
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border-light">
        <span className="font-sans text-[11px] tracking-[0.15em] uppercase text-ink-faint">
          Análisis de Señales Musicales
        </span>
        <span className="font-mono text-[11px] text-ink-faint">
          {current + 1}<span className="text-border mx-1">/</span>{SLIDES.length}
        </span>
      </header>

      {/* Slide content */}
      <main className="flex-1 overflow-y-auto py-6">
        <div key={slideKey} className="slide-enter">
          <SlideComponent />
        </div>
      </main>

      {/* Bottom navigation */}
      <footer className="border-t border-border-light px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          {/* Prev */}
          <button
            onClick={prev}
            disabled={current === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-sans text-sm transition-all
              ${current === 0
                ? 'text-border cursor-not-allowed'
                : 'text-ink-muted hover:text-ink hover:bg-cream-dark active:scale-97'
              }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Anterior
          </button>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {SLIDES.map((s, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                title={s.label}
                className={`transition-all duration-300 rounded-full
                  ${i === current
                    ? 'w-6 h-1.5 bg-accent-blue'
                    : i < current
                    ? 'w-1.5 h-1.5 bg-accent-blue/40 hover:bg-accent-blue/60'
                    : 'w-1.5 h-1.5 bg-border hover:bg-ink-faint'
                  }`}
              />
            ))}
          </div>

          {/* Next */}
          <button
            onClick={next}
            disabled={current === SLIDES.length - 1}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-sans text-sm transition-all
              ${current === SLIDES.length - 1
                ? 'text-border cursor-not-allowed'
                : 'text-ink-muted hover:text-ink hover:bg-cream-dark active:scale-97'
              }`}
          >
            Siguiente
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </footer>
    </div>
    </LiveVoiceProvider>
  );
}
