import { useEffect, useState, useRef } from 'react';
import { M } from './Math';

const N = 2048, FS = 44100, BIN_RES = FS / N;
const TRUE_FREQ = 441.25; // Exaggerates delta to ~0.5 for a very high peak
const TRUE_BIN = TRUE_FREQ / BIN_RES;

const W = 900, H = 380;
const PAD = { l: 55, r: 30, t: 30, b: 45 };
const PW = W - PAD.l - PAD.r;
const PH = H - PAD.t - PAD.b;

function envelope(bin) {
  const d = bin - TRUE_BIN;
  return Math.exp(-d * d / (2 * 2.2 * 2.2));
}

// Zoom into the 3 bins of interest: k=20, k=20 (peak), k=21
// Actually the peak bin is 20 (closest to 20.44)
const BETA_K = 20;
const ALPHA_K = BETA_K - 1; // 19
const GAMMA_K = BETA_K + 1; // 21

const alpha = envelope(ALPHA_K);
const beta = envelope(BETA_K);
const gamma = envelope(GAMMA_K);

// Parabolic interpolation
const delta = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma);
const peakAmp = beta - 0.25 * (alpha - gamma) * delta;

// Chart range: show bins 17..23
const B_START = 17, B_END = 23, B_RANGE = B_END - B_START;

function binToX(b) { return PAD.l + ((b - B_START) / B_RANGE) * PW; }
function ampToY(a) { return PAD.t + (1 - a) * PH; }

export default function SlideParabola() {
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState(0); // 0=stems, 1=parabola, 2=peak

  useEffect(() => {
    setShow(true);
    const t1 = setTimeout(() => setPhase(1), 1000);
    const t2 = setTimeout(() => setPhase(2), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Build parabola path through the 3 points
  // Use the local coordinate: x in [-1, 1] mapped to [ALPHA_K, GAMMA_K]
  const a_coeff = 0.5 * (alpha + gamma) - beta;
  const b_coeff = 0.5 * (gamma - alpha);
  const c_coeff = beta;

  const parabolaPoints = [];
  const STEPS = 80;
  for (let i = 0; i <= STEPS; i++) {
    const x_local = -1.5 + (i / STEPS) * 3; // from -1.5 to 1.5
    const y_val = a_coeff * x_local * x_local + b_coeff * x_local + c_coeff;
    const bin = BETA_K + x_local;
    if (bin >= B_START && bin <= B_END && y_val >= 0) {
      parabolaPoints.push(`${parabolaPoints.length === 0 ? 'M' : 'L'}${binToX(bin).toFixed(1)},${ampToY(y_val).toFixed(1)}`);
    }
  }
  const parabolaPath = parabolaPoints.join(' ');

  // Envelope background
  const envPoints = [];
  for (let i = 0; i <= 150; i++) {
    const bin = B_START + (i / 150) * B_RANGE;
    envPoints.push(`${i === 0 ? 'M' : 'L'}${binToX(bin).toFixed(1)},${ampToY(envelope(bin)).toFixed(1)}`);
  }

  // The 3 key stems with strict color coding for Slide 4 connection
  const stems = [
    { k: ALPHA_K, amp: alpha, label: 'α', color: '#d97706' }, // Amber
    { k: BETA_K,  amp: beta,  label: 'β', color: '#2563eb' }, // Blue
    { k: GAMMA_K, amp: gamma, label: 'γ', color: '#16a34a' }, // Green
  ];

  const peakX = binToX(BETA_K + delta);
  const peakY = ampToY(peakAmp);

  return (
    <div className="max-w-4xl mx-auto px-6 py-4">
      <div className={`mb-6 ${show ? 'anim-fade-up' : 'opacity-0'}`}>
        <span className="font-sans text-xs tracking-[0.2em] uppercase text-ink-faint">03 · Intuición</span>
        <h2 className="font-serif text-4xl sm:text-5xl font-500 text-ink mt-1">
          La Intuición <em>Parabólica</em>
        </h2>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-center">
        {/* SVG Chart - Absolute Protagonist */}
        <div className={`w-full lg:w-[65%] flex justify-center ${show ? 'anim-fade-up delay-2' : 'opacity-0'}`}>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: 'visible' }}>
            {/* Axes */}
            <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="#e0ddd4" strokeWidth="1" />
            <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="#e0ddd4" strokeWidth="1" />
            <text x={W / 2} y={H - 8} textAnchor="middle" className="font-sans text-[10px]" fill="#9e9eb8">Frecuencia (bin index)</text>
            <text x={PAD.l - 8} y={PAD.t + 4} textAnchor="end" className="font-sans text-[9px]" fill="#9e9eb8">|X|</text>

            {/* Faint continuous envelope */}
            <path d={envPoints.join(' ')} fill="none" stroke="#2563eb" strokeWidth="1.2" opacity="0.15" />

            {/* All bins as faint stems */}
            {Array.from({ length: B_RANGE + 1 }, (_, i) => {
              const k = B_START + i;
              const a = envelope(k);
              const isKey = k >= ALPHA_K && k <= GAMMA_K;
              if (isKey) return null;
              return (
                <g key={k} opacity={show ? 0.3 : 0} style={{ transition: 'opacity 0.4s' }}>
                  <line x1={binToX(k)} y1={ampToY(0)} x2={binToX(k)} y2={ampToY(a)}
                    stroke="#c4c0b6" strokeWidth="1" />
                  <circle cx={binToX(k)} cy={ampToY(a)} r="2" fill="#c4c0b6" />
                </g>
              );
            })}

            {/* The 3 key stems */}
            {stems.map((s, i) => (
              <g key={s.k} opacity={show ? 1 : 0}
                style={{ transition: `opacity 0.5s ease ${0.3 + i * 0.15}s` }}>
                <line x1={binToX(s.k)} y1={ampToY(0)} x2={binToX(s.k)} y2={ampToY(s.amp)}
                  stroke={s.color} strokeWidth="2" />
                <circle cx={binToX(s.k)} cy={ampToY(s.amp)} r="5"
                  fill={s.color} stroke="#fff" strokeWidth="1.5" />
                {/* Greek label */}
                <text x={binToX(s.k)} y={ampToY(s.amp) - 14} textAnchor="middle"
                  className="font-serif text-[13px] italic" fill={s.color} fontWeight="500">
                  {s.label}
                </text>
                {/* Bin label */}
                <text x={binToX(s.k)} y={ampToY(0) + 16} textAnchor="middle"
                  className="font-mono text-[9px]" fill="#9e9eb8">
                  k={s.k}
                </text>
              </g>
            ))}

            {/* Parabola */}
            <path d={parabolaPath} fill="none"
              stroke="#c0392b" strokeWidth="2" strokeLinecap="round"
              opacity={phase >= 1 ? 0.85 : 0}
              className={phase >= 1 ? 'anim-draw' : ''}
              style={{ '--path-length': 500, transition: 'opacity 0.3s' }}
            />

            {/* Peak vertex */}
            {phase >= 2 && (
              <g className="anim-fade">
                <circle cx={peakX} cy={peakY} r="7"
                  fill="#c0392b" stroke="#fff" strokeWidth="2" className="anim-pulse" />
                {/* Dashed line down to axis */}
                <line x1={peakX} y1={peakY + 10} x2={peakX} y2={ampToY(0)}
                  stroke="#c0392b" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
                {/* Label */}
                <text x={peakX + 10} y={peakY - 8} className="font-mono text-[9px]" fill="#c0392b">
                  Pico real
                </text>
                <text x={peakX} y={ampToY(0) + 16} textAnchor="middle"
                  className="font-mono text-[8px]" fill="#c0392b">
                  {(BETA_K + delta).toFixed(2)}
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Text - Sidebar */}
        <div className={`w-full lg:w-[35%] space-y-5 ${show ? 'anim-fade-up delay-4' : 'opacity-0'}`}>
          <p className="text-ink-light text-[0.9rem] leading-relaxed">
            ¿Cómo encontramos el <strong className="text-ink">pico real</strong>?
            Asumimos que la cima del lóbulo se comporta como una <em>parábola</em>.
          </p>
          <p className="text-ink-light text-[0.9rem] leading-relaxed">
            Usando solo el bin máximo (<M t="\beta" />) y sus dos vecinos inmediatos
            (<M t="\alpha" /> y <M t="\gamma" />), podemos reconstruir la cima perdida
            <strong className="text-ink"> sin aumentar el tamaño de la FFT</strong>.
          </p>
          <div className="math-box mt-4">
            <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-ink-faint mb-2">Desplazamiento sub-bin</p>
            <M t="\delta = \frac{1}{2}\,\frac{\alpha - \gamma}{\alpha - 2\beta + \gamma}" d />
            <div className="mt-3 pt-3 border-t border-border-light">
              <p className="font-sans text-[10px] text-ink-faint mb-1">Resultado</p>
              <div className="font-mono text-4xl font-bold text-accent-blue leading-none">
                {((BETA_K + delta) * BIN_RES).toFixed(2)}
                <span className="text-base font-normal text-ink-muted ml-1">Hz</span>
              </div>
              <p className="font-mono text-xs text-ink-muted mt-1">
                δ = {delta.toFixed(4)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
