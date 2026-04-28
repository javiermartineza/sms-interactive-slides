import { useEffect, useState } from 'react';

export default function SlidePortada() {
  const [show, setShow] = useState(false);
  useEffect(() => { setShow(true); }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[75vh] text-center px-8">
      {/* Project badge */}
      <span
        className={`font-sans text-[10px] tracking-[0.25em] uppercase px-3 py-1 rounded-full border border-border text-ink-faint mb-6
          ${show ? 'anim-fade' : 'opacity-0'}`}
      >
        Proyecto 1
      </span>

      {/* Decorative line */}
      <div
        className={`w-16 h-px bg-ink-faint mb-10 transition-all duration-1000 ${show ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}`}
      />

      {/* Title */}
      <h1
        className={`font-serif text-5xl sm:text-6xl md:text-7xl font-500 tracking-tight leading-[1.1] text-ink mb-6
          ${show ? 'anim-fade-up' : 'opacity-0'}`}
        style={{ fontWeight: 500 }}
      >
        Modelado Sinusoidal
        <br />
        <span className="text-accent-blue" style={{ fontWeight: 600 }}>y Peak Tracking</span>
      </h1>

      {/* Subtitle */}
      <p
        className={`font-serif text-lg sm:text-xl text-ink-muted italic max-w-xl leading-relaxed
          ${show ? 'anim-fade-up delay-2' : 'opacity-0'}`}
      >
        De la rejilla rígida de píxeles a los hilos
        paramétricos del sonido.
      </p>

      {/* Decorative wave */}
      <svg
        className={`mt-14 ${show ? 'anim-fade delay-5' : 'opacity-0'}`}
        width="240" height="40" viewBox="0 0 240 40"
      >
        <path
          d={`M0,20 ${Array.from({ length: 49 }, (_, i) => {
            const x = i * 5;
            const y = 20 + Math.sin(i * 0.4) * 12 * Math.exp(-Math.pow((i - 24) / 12, 2));
            return `L${x},${y}`;
          }).join(' ')}`}
          fill="none"
          stroke="#2563eb"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="anim-draw"
          style={{ '--path-length': 300 }}
        />
      </svg>

      {/* Keyboard hint */}
      <div
        className={`mt-16 flex items-center gap-2 font-sans text-xs text-ink-faint
          ${show ? 'anim-fade delay-8' : 'opacity-0'}`}
      >
        <span>Navega con</span>
        <kbd className="px-1.5 py-0.5 rounded border border-border bg-white text-ink-muted font-mono text-[10px]">←</kbd>
        <kbd className="px-1.5 py-0.5 rounded border border-border bg-white text-ink-muted font-mono text-[10px]">→</kbd>
      </div>
    </div>
  );
}
