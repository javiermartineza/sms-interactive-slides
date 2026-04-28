import { useEffect, useState } from 'react';
import { M } from './Math';

// ═══ MATH CONSTANTS ═══
const N = 2048, FS = 44100, BIN_RES = FS / N;

// Hardcoded Pedagogical Example (dB)
const alpha_val = -15;
const beta_val  = -3;
const gamma_val = -6;
const delta = 0.5 * (alpha_val - gamma_val) / (alpha_val - 2 * beta_val + gamma_val); // 0.3
const y_hat = beta_val - 0.25 * (alpha_val - gamma_val) * delta; // -2.325

const BETA_K = 20;
const ALPHA_K = 19;
const GAMMA_K = 21;

// ═══ SVG LAYOUT ═══
const W = 520, H = 440;
const PAD = { l: 50, r: 20, t: 25, b: 75 };
const PW = W - PAD.l - PAD.r;
const PH = H - PAD.t - PAD.b;
const B_START = 18.5, B_END = 21.5, B_RANGE = B_END - B_START;

function binToX(b) { return PAD.l + ((b - B_START) / B_RANGE) * PW; }
function ampToY(db) {
  const norm = Math.max(0, (db + 20) / 20);
  return PAD.t + (1 - norm) * PH;
}

// ═══ STEP CONFIG ═══
const BTN_LABELS = [
  'Paso 1: Evaluar',
  'Paso 2: Interpolar',
  'Paso 3: Frecuencia δ',
  'Paso 4: Magnitud ŷ',
];

// ─── STEP 0 CONFIG ───
const S0_W = 800, S0_H = 400;
const S0_PL = 50, S0_PR = 20, S0_PT = 20, S0_PB = 40;
const S0_PW = S0_W - S0_PL - S0_PR, S0_PH = S0_H - S0_PT - S0_PB;
const s0X = hz => S0_PL + (hz / 2000) * S0_PW;
const s0Y = db => S0_PT + (1 - (db + 40) / 100) * S0_PH;

const s0_peaks = [
  { f: 180, db: 15 },
  { f: 350, db: -10 },
  { f: 500, db: 35 },
  { f: 720, db: 0 },
  { f: 980, db: 55 },   // Highest central
  { f: 1250, db: -5 },
  { f: 1500, db: 20 },
  { f: 1720, db: -25 }, // Below threshold
  { f: 1880, db: -12 }
];

const thresholdDb = -20;

const PEAK_CODE_HTML = `<span style="color:#569cd6">def</span> <span style="color:#dcdcaa">detect_peaks</span>(<span style="color:#9cdcfe">mX</span>, <span style="color:#9cdcfe">thresh_db</span>=<span style="color:#b5cea8">-60</span>):
    <span style="color:#6a9955"># mX es el arreglo con las magnitudes del espectro en dB</span>

    <span style="color:#6a9955"># 1. ¿Supera el umbral?</span>
    <span style="color:#9cdcfe">cond_thresh</span> = <span style="color:#9cdcfe">mX</span>[1:-1] &gt; <span style="color:#9cdcfe">thresh_db</span>

    <span style="color:#6a9955"># 2. ¿Es mayor que el bin de la izquierda?</span>
    <span style="color:#d97706">cond_left</span>   = <span style="color:#9cdcfe">mX</span>[1:-1] &gt; <span style="color:#9cdcfe">mX</span>[:-2]

    <span style="color:#6a9955"># 3. ¿Es mayor que el bin de la derecha?</span>
    <span style="color:#16a34a">cond_right</span>  = <span style="color:#9cdcfe">mX</span>[1:-1] &gt; <span style="color:#9cdcfe">mX</span>[2:]

    <span style="color:#6a9955"># Juntamos las 3 condiciones.</span>
    <span style="color:#6a9955"># Sumamos +1 porque mX[1:-1] excluye el índice 0</span>
    <span style="color:#9cdcfe">peaks</span> = <span style="color:#9cdcfe">np</span>.<span style="color:#dcdcaa">where</span>(<span style="color:#9cdcfe">cond_thresh</span> &amp; <span style="color:#d97706">cond_left</span> &amp; <span style="color:#16a34a">cond_right</span>)[0] + 1

    <span style="color:#569cd6">return</span> <span style="color:#9cdcfe">peaks</span>`;

export default function SlideMath() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => { setShow(true); }, []);

  // Generate step 0 spectrum path
  const s0_pts = [];
  for (let hz = 0; hz <= 2000; hz += 5) {
    let db = -35 + 2 * Math.sin(hz * 0.05) + 1.5 * Math.sin(hz * 0.13) + Math.sin(hz * 0.7);
    for (const p of s0_peaks) {
      const dx = hz - p.f;
      // Parabolic-like bell shape
      db += Math.max(0, (p.db - -35) * Math.exp(-(dx * dx) / 1000));
    }
    s0_pts.push(`${hz === 0 ? 'M' : 'L'} ${s0X(hz).toFixed(1)} ${s0Y(db).toFixed(1)}`);
  }
  const s0_path = s0_pts.join(' ');
  const s0_area = `${s0_path} L ${s0X(2000)} ${s0Y(-40)} L ${s0X(0)} ${s0Y(-40)} Z`;

  // Parabola coefficients (Step 1+): y(x) = ax² + bx + c, x ∈ [-1, 1]
  const a_coeff = 0.5 * (alpha_val + gamma_val) - beta_val;
  const b_coeff = 0.5 * (gamma_val - alpha_val);
  const c_coeff = beta_val;

  const parabolaPoints = [];
  for (let i = 0; i <= 60; i++) {
    const x_local = -1.3 + (i / 60) * 2.6;
    const y_val = a_coeff * x_local * x_local + b_coeff * x_local + c_coeff;
    const bin = BETA_K + x_local;
    if (bin >= B_START && bin <= B_END && y_val >= -22) {
      parabolaPoints.push(`${parabolaPoints.length === 0 ? 'M' : 'L'}${binToX(bin).toFixed(1)},${ampToY(y_val).toFixed(1)}`);
    }
  }
  const parabolaPath = parabolaPoints.join(' ');

  const stems = [
    { k: ALPHA_K, amp: alpha_val, label: '\\alpha', color: '#d97706', freq: (ALPHA_K * BIN_RES).toFixed(1), local: '-1' },
    { k: BETA_K,  amp: beta_val,  label: '\\beta',  color: '#2563eb', freq: (BETA_K * BIN_RES).toFixed(1),  local: '0' },
    { k: GAMMA_K, amp: gamma_val, label: '\\gamma', color: '#16a34a', freq: (GAMMA_K * BIN_RES).toFixed(1), local: '+1' },
  ];

  const peakBin = BETA_K + delta;
  const peakX = binToX(peakBin);
  const peakY = ampToY(y_hat);

  return (
    <div className="w-full max-w-[95vw] mx-auto px-6 py-2 bg-[#faf8f3]"
      style={{ height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>

      {/* Header — compact */}
      <div className={`shrink-0 mb-4 ${show ? 'anim-fade-up' : 'opacity-0'}`}>
        <span className="font-sans text-sm tracking-[0.2em] uppercase text-ink-muted font-semibold">03 · Derivación</span>
        <h2 className="font-serif text-4xl sm:text-5xl font-500 text-ink mt-0.5">
          La Matemática del <em>Sub-Bin</em>
        </h2>
      </div>

      {/* Main 2-col layout */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 items-stretch">

        {/* ─── LEFT: SVG (60%) ─── */}
        <div className={`w-full lg:w-[60%] flex items-center justify-center shrink-0 ${show ? 'anim-fade-up delay-1' : 'opacity-0'}`}>
          
          {step === 0 ? (
            /* STEP 0: Full Spectrum View (800x400) */
            <div className="bg-white rounded-2xl border-2 border-border shadow-sm p-5 w-full flex items-center justify-center">
              <svg viewBox={`0 0 ${S0_W} ${S0_H}`} className="w-full h-full max-h-full" style={{ minHeight: '400px', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="spectrum-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* dB Axis */}
                <line x1={S0_PL} y1={S0_PT} x2={S0_PL} y2={S0_H - S0_PB} stroke="#e0ddd4" strokeWidth="2.5" />
                <text x={S0_PL - 8} y={S0_PT - 4} textAnchor="end" className="font-sans text-[12px] font-bold" fill="#6b6b8a">dB</text>
                {[60, 40, 20, 0, -20, -40].map(db => (
                  <g key={db}>
                    <line x1={S0_PL - 4} y1={s0Y(db)} x2={S0_W - S0_PR} y2={s0Y(db)} stroke="#e0ddd4" strokeWidth="0.5" />
                    <text x={S0_PL - 8} y={s0Y(db) + 4} textAnchor="end" className="font-mono text-[12px]" fill="#6b6b8a">{db}</text>
                  </g>
                ))}

                {/* Hz Axis */}
                <line x1={S0_PL} y1={S0_H - S0_PB} x2={S0_W - S0_PR} y2={S0_H - S0_PB} stroke="#e0ddd4" strokeWidth="2.5" />
                <text x={S0_W / 2} y={S0_H - S0_PB + 28} textAnchor="middle" className="font-sans text-[13px] font-semibold" fill="#6b6b8a">Frecuencia (Hz)</text>
                {[0, 500, 1000, 1500, 2000].map(hz => (
                  <g key={hz}>
                    <line x1={s0X(hz)} y1={S0_H - S0_PB} x2={s0X(hz)} y2={S0_H - S0_PB + 4} stroke="#c0bab0" strokeWidth="1.5" />
                    <text x={s0X(hz)} y={S0_H - S0_PB + 16} textAnchor="middle" className="font-mono text-[12px]" fill="#6b6b8a">{hz}</text>
                  </g>
                ))}

                {/* Threshold */}
                <line x1={S0_PL} y1={s0Y(thresholdDb)} x2={S0_W - S0_PR} y2={s0Y(thresholdDb)}
                  stroke="#d97706" strokeWidth="2" strokeDasharray="4 4" opacity="0.8" />
                <text x={S0_W - S0_PR - 4} y={s0Y(thresholdDb) - 8} textAnchor="end" className="font-sans text-[12px] font-bold" fill="#d97706">
                  Umbral de Detección ({thresholdDb} dB)
                </text>

                {/* Path & Fill */}
                <path d={s0_area} fill="url(#spectrum-grad)" />
                <path d={s0_path} fill="none" stroke="#2563eb" strokeWidth="1.5" strokeLinejoin="round" />

                {/* Highlight Valid Peaks */}
                {s0_peaks.map((p, i) => {
                  if (p.db < thresholdDb) return null;
                  const r = 4;
                  const isMax = p.db === 55;
                  return (
                    <g key={i}>
                      {isMax && (
                        <circle cx={s0X(p.f)} cy={s0Y(p.db)} r="12" fill="none" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="4 2" className="anim-spin-slow" />
                      )}
                      <circle cx={s0X(p.f)} cy={s0Y(p.db)} r={r} fill="#c0392b" stroke="#fff" strokeWidth="2" />
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            /* STEP 1+: Local Parabola View */
            <div className="bg-white rounded-2xl border-2 border-border shadow-sm p-5 w-full flex items-center justify-center">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: 'visible' }}>

                {/* ── dB Axis ── */}
                <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="#e0ddd4" strokeWidth="2.5" />
              <text x={PAD.l - 8} y={PAD.t - 8} textAnchor="end" className="font-sans text-[11px] font-bold" fill="#6b6b8a">dB</text>
              {[0, -5, -10, -15, -20].map(db => (
                <g key={db}>
                  <line x1={PAD.l - 4} y1={ampToY(db)} x2={PAD.l} y2={ampToY(db)} stroke="#c0bab0" strokeWidth="1.5" />
                  <text x={PAD.l - 8} y={ampToY(db) + 4} textAnchor="end" className="font-mono text-[12px]" fill="#6b6b8a">{db}</text>
                </g>
              ))}

              {/* ── Hz Axis ── */}
              <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="#e0ddd4" strokeWidth="2.5" />
              <text x={W / 2} y={H - PAD.b + 25} textAnchor="middle" className="font-sans text-[12px] font-semibold" fill="#6b6b8a">Frecuencia (Hz)</text>

              {/* ── Local x Axis (only step >= 1) ── */}
              <g opacity={step >= 1 ? 1 : 0} style={{ transition: 'opacity 0.6s' }}>
                <line x1={PAD.l} y1={H - PAD.b + 50} x2={W - PAD.r} y2={H - PAD.b + 50} stroke="#b0a990" strokeWidth="3" strokeLinecap="round" />
                <text x={W / 2} y={H - PAD.b + 72} textAnchor="middle" className="font-sans text-[11px] font-bold" fill="#9e9eb8">Eje Local (x)</text>
              </g>

                {/* ── 3 Key Stems (always visible) ── */}
              {stems.map((s, i) => (
                <g key={s.k} opacity={step >= 1 ? 1 : 0} style={{ transition: `opacity 0.5s ease ${i * 0.12}s` }}>
                  <line x1={binToX(s.k)} y1={ampToY(-20)} x2={binToX(s.k)} y2={ampToY(s.amp)}
                    stroke={s.color} strokeWidth="5" />
                  <circle cx={binToX(s.k)} cy={ampToY(s.amp)} r="12"
                    fill={s.color} stroke="#fff" strokeWidth="4" />
                  {/* Greek label above */}
                  <foreignObject x={binToX(s.k) - 25} y={ampToY(s.amp) - 55} width="50" height="45">
                    <div className="flex justify-center items-center w-full h-full text-4xl drop-shadow-sm">
                      <M t={`\\textcolor{${s.color}}{${s.label}}`} d />
                    </div>
                  </foreignObject>
                  {/* Hz label */}
                  <text x={binToX(s.k)} y={ampToY(-20) + 16} textAnchor="middle" className="font-mono text-[12px] font-semibold" fill="#6b6b8a">{s.freq}</text>
                  <circle cx={binToX(s.k)} cy={ampToY(-20)} r="4" fill="#e0ddd4" />
                  {/* Local x tick + label */}
                  <line x1={binToX(s.k)} y1={H - PAD.b + 46} x2={binToX(s.k)} y2={H - PAD.b + 54} stroke="#b0a990" strokeWidth="3" />
                  <text x={binToX(s.k)} y={H - PAD.b + 66} textAnchor="middle" className="font-mono text-[14px] font-bold" fill={s.color}>
                    x={s.local}
                  </text>
                </g>
              ))}

              {/* ── Parabola (step >= 2) ── */}
              <path d={parabolaPath} fill="none"
                stroke="#c0392b" strokeWidth="5" strokeLinecap="round" strokeDasharray="10 10"
                opacity={step >= 2 ? 0.85 : 0}
                style={{ transition: 'opacity 0.6s 0.2s' }}
              />

              {/* ── Peak vertex dot (step >= 3) ── */}
              <g opacity={step >= 3 ? 1 : 0} style={{ transition: 'opacity 0.6s 0.15s' }}>
                <circle cx={peakX} cy={peakY} r="14" fill="#c0392b" stroke="#fff" strokeWidth="4" className="anim-pulse" />
              </g>

              {/* ── Vertical dashed line + δ arrow (step >= 3) ── */}
              <g opacity={step >= 3 ? 1 : 0} style={{ transition: 'opacity 0.6s' }}>
                <line x1={peakX} y1={peakY + 18} x2={peakX} y2={ampToY(-20)}
                  stroke="#c0392b" strokeWidth="3" strokeDasharray="6 6" opacity="0.6" />
                <circle cx={peakX} cy={ampToY(-20)} r="5" fill="#c0392b" />
                {/* Hz label — offset right with background pill to avoid axis collision */}
                <rect x={peakX + 8} y={ampToY(-20) + 4} width="72" height="18" rx="4" fill="#c0392b" opacity="0.12" />
                <text x={peakX + 44} y={ampToY(-20) + 17} textAnchor="middle" className="font-mono text-[13px] font-bold" fill="#c0392b">
                  {(peakBin * BIN_RES).toFixed(1)} Hz
                </text>
                {/* δ arrow from β stem to peak */}
                <line x1={binToX(BETA_K)} y1={ampToY(-17)} x2={peakX} y2={ampToY(-17)}
                  stroke="#c0392b" strokeWidth="3.5" markerEnd="url(#arrow-red)" />
                <foreignObject x={(binToX(BETA_K) + peakX) / 2 - 18} y={ampToY(-17) - 32} width="36" height="30">
                  <div className="flex justify-center items-center w-full h-full text-2xl text-accent-red font-bold">
                    <M t="\delta" />
                  </div>
                </foreignObject>
              </g>

              {/* ── Horizontal magnitude line (step >= 4) ── */}
              <g opacity={step >= 4 ? 1 : 0} style={{ transition: 'opacity 0.6s' }}>
                <line x1={PAD.l} y1={peakY} x2={peakX - 18}
                  y1={peakY} y2={peakY}
                  stroke="#c0392b" strokeWidth="2.5" strokeDasharray="4 4" opacity="0.55" />
                <text x={PAD.l - 6} y={peakY + 4} textAnchor="end" className="font-mono text-[12px] font-bold" fill="#c0392b">
                  {y_hat.toFixed(1)}
                </text>
              </g>

              {/* Defs */}
              <defs>
                <marker id="arrow-red" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#c0392b" />
                </marker>
              </defs>
            </svg>
            </div>
          )}
        </div>

        {/* ─── RIGHT: Steps (40%) ─── */}
        <div className={`w-full lg:w-[40%] flex flex-col gap-3 ${show ? 'anim-fade-up delay-3' : 'opacity-0'}`}>

          <div className="flex-1 min-h-0 flex flex-col justify-center overflow-y-auto">
          {step === 0 ? (
            /* Paso 0: Umbral */
            <div className="px-4">
              <h3 className="font-serif text-3xl font-500 text-ink mb-1">
                Detección de Picos
              </h3>
              <p className="font-sans text-sm text-ink-muted mb-3 leading-snug">
                Máximos locales que superan el umbral de detección.
              </p>
              <div className="rounded-xl overflow-hidden border border-[#2e2e4e]">
                <div className="bg-[#1e1e2e] px-3 py-1.5 flex items-center gap-1.5 border-b border-[#2e2e4e]">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f] inline-block" />
                  <span className="ml-2 font-mono text-[#858599] text-[0.65rem]">peak_detection.py</span>
                </div>
                <pre
                  className="bg-[#1e1e2e] px-4 py-3 font-mono text-[0.72rem] leading-[1.65] overflow-x-auto m-0"
                  style={{ color: '#d4d4d4' }}
                  dangerouslySetInnerHTML={{ __html: PEAK_CODE_HTML }}
                />
              </div>
            </div>
          ) : (
            /* Group Steps 1+ */
            <div className="flex flex-col gap-3">
              
              {/* Subtle Label */}
              <div className="text-center mb-1">
                <span className="inline-block px-3 py-1 bg-accent-blue/10 text-accent-blue rounded-full font-sans text-xs font-bold uppercase tracking-wider">
                  Zoom sobre un pico detectado
                </span>
              </div>

              {/* Paso 1: Los 3 bins */}
              <div className={`transition-all duration-500 ${step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <p className="font-sans text-xs font-bold tracking-[0.15em] text-ink-muted uppercase mb-1.5">
                  Paso 1 · Evaluar la parábola en 3 bins
                </p>
              <div className="bg-white rounded-xl border-2 border-border p-4 space-y-1">
                <div className="text-center mb-1 pb-1 border-b border-border-light">
                  <M t="y(x) = ax^2 + bx + c" d className="text-lg" />
                </div>
                <div className="text-[1.15rem]">
                  <M t="y(-1) = a - b + c = \textcolor{#d97706}{\alpha} = -15\,\text{dB}" d />
                  <M t="y(\phantom{-}0) = c = \textcolor{#2563eb}{\beta} = -3\,\text{dB}" d />
                  <M t="y(+1) = a + b + c = \textcolor{#16a34a}{\gamma} = -6\,\text{dB}" d />
                </div>
              </div>
            </div>

            {/* Paso 2: Parábola */}
            <div className={`transition-all duration-500 ${step >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: '0.1s' }}>
              <p className="font-sans text-xs font-bold tracking-[0.15em] text-ink-muted uppercase mb-1.5">
                Paso 2 · Interpolar parábola
              </p>
              <div className="bg-cream-dark/50 rounded-xl border border-border-light p-4">
                <p className="font-sans text-lg text-ink leading-snug">
                  💡 Derivamos e igualamos a cero:
                </p>
                <div className="mt-1.5 text-[1.15rem]">
                  <M t="y'(x) = 2ax + b = 0 \;\Rightarrow\; x_{\max} = -\frac{b}{2a}" d />
                </div>
              </div>
            </div>

            {/* Paso 3: δ y frecuencia */}
            <div className={`transition-all duration-500 ${step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: '0.15s' }}>
              <p className="font-sans text-xs font-bold tracking-[0.15em] text-ink-muted uppercase mb-1.5">
                Paso 3 · Desplazamiento δ
              </p>
              <div className="bg-white rounded-xl border-2 border-border p-4 space-y-2">
                <div className="text-[1.1rem]">
                  <M t="\delta = \frac{1}{2}\,\frac{\textcolor{#d97706}{\alpha} - \textcolor{#16a34a}{\gamma}}{\textcolor{#d97706}{\alpha} - 2\textcolor{#2563eb}{\beta} + \textcolor{#16a34a}{\gamma}} = \frac{1}{2}\frac{-15 - (-6)}{-15 - 2(-3) + (-6)}" d />
                </div>
                <div className="flex items-center gap-4 pt-2 border-t border-border-light">
                  <span className="font-mono text-2xl font-bold text-accent-red">
                    δ = {delta.toFixed(1)}
                  </span>
                  <span className="text-ink-faint text-xl">→</span>
                  <div className="px-4 py-1.5 bg-accent-blue/10 rounded-lg border border-accent-blue/25">
                    <span className="font-mono text-2xl font-bold text-accent-blue">
                      {(peakBin * BIN_RES).toFixed(1)} Hz
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Paso 4: Magnitud corregida ŷ */}
            <div className={`transition-all duration-500 ${step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: '0.2s' }}>
              <p className="font-sans text-xs font-bold tracking-[0.15em] text-ink-muted uppercase mb-1.5">
                Paso 4 · Magnitud corregida
              </p>
              <div className="bg-white rounded-xl border-2 border-accent-red/30 p-4 space-y-2">
                <div className="text-[1.1rem]">
                  <M t="\hat{y} = \textcolor{#2563eb}{\beta} - \tfrac{1}{4}(\textcolor{#d97706}{\alpha} - \textcolor{#16a34a}{\gamma})\,\delta" d />
                </div>
                <div className="flex items-center gap-4 pt-2 border-t border-border-light">
                  <div className="text-[1.05rem]">
                    <M t={`= -3 - \\tfrac{1}{4}(-9) \\times ${delta.toFixed(1)}`} />
                  </div>
                  <span className="text-ink-faint text-xl">=</span>
                  <div className="px-4 py-1.5 bg-accent-red/10 rounded-lg border border-accent-red/25">
                    <span className="font-mono text-2xl font-bold text-accent-red">
                      {y_hat.toFixed(1)} dB
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          )}
          </div>

          {/* Button */}
          <div className="shrink-0 pt-1">
            {step < 4 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="w-full px-6 py-3 bg-accent-blue text-white rounded-xl font-sans text-base font-bold shadow-sm hover:bg-accent-blue/90 hover:shadow-md transition-all active:scale-[0.97] flex items-center justify-center gap-2"
              >
                <span>{BTN_LABELS[step]}</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={() => setStep(0)}
                className="w-full px-6 py-3 bg-ink/10 text-ink rounded-xl font-sans text-base font-bold hover:bg-ink/15 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
              >
                <span>↺ Reiniciar</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
