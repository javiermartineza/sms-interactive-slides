import { useEffect, useState, useRef, useCallback } from 'react';
import { M } from './Math';

// Web Audio API singleton
let audioCtx = null;
let oscillator = null;
let gainNode = null;

function startTone(frequency) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  stopTone();
  oscillator = audioCtx.createOscillator();
  gainNode = audioCtx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.05);
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();
}

function updateTone(frequency) {
  if (oscillator) {
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  }
}

function stopTone() {
  if (gainNode && oscillator) {
    try {
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.05);
      setTimeout(() => { try { oscillator.stop(); } catch { } }, 60);
    } catch { }
    oscillator = null;
    gainNode = null;
  }
}

const N = 2048, FS = 44100, BIN_RES = FS / N;

// SVG layout — maximized for projector
const W = 900, H = 360;
const PAD = { l: 45, r: 15, t: 25, b: 45 };
const PW = W - PAD.l - PAD.r;
const PH = H - PAD.t - PAD.b;

const BIN_START = 14, BIN_END = 28;
const NUM_BINS = BIN_END - BIN_START;

function envelope(bin, centerBin) {
  const d = bin - centerBin;
  return Math.exp(-d * d / (2 * 2.2 * 2.2));
}

function binToX(bin) {
  return PAD.l + ((bin - BIN_START) / NUM_BINS) * PW;
}
function ampToY(a) {
  return PAD.t + (1 - a) * PH;
}

export default function SlidePicketFence() {
  const [show, setShow] = useState(false);
  const [freq, setFreq] = useState(440);
  const [vibrato, setVibrato] = useState(false);
  const [playing, setPlaying] = useState(false);
  const vibratoRef = useRef(null);
  const freqRef = useRef(440);

  useEffect(() => { setShow(true); return () => stopTone(); }, []);

  // Update tone frequency when freq changes and audio is playing
  useEffect(() => {
    if (playing) updateTone(freq);
  }, [freq, playing]);

  const toggleSound = useCallback(() => {
    if (playing) { stopTone(); setPlaying(false); }
    else { startTone(freq); setPlaying(true); }
  }, [playing, freq]);

  // Vibrato animation
  useEffect(() => {
    if (!vibrato) {
      if (vibratoRef.current) cancelAnimationFrame(vibratoRef.current);
      return;
    }
    const baseFreq = freqRef.current;
    const startTime = performance.now();
    const animate = (now) => {
      const t = (now - startTime) / 1000;
      const osc = baseFreq + Math.sin(t * 5.5) * 18; // ±18 Hz at ~5.5 Hz rate
      setFreq(Math.round(osc * 10) / 10);
      vibratoRef.current = requestAnimationFrame(animate);
    };
    vibratoRef.current = requestAnimationFrame(animate);
    return () => { if (vibratoRef.current) cancelAnimationFrame(vibratoRef.current); };
  }, [vibrato]);

  const handleSlider = useCallback((e) => {
    const v = parseFloat(e.target.value);
    setFreq(v);
    freqRef.current = v;
    if (vibrato) setVibrato(false);
  }, [vibrato]);

  const toggleVibrato = useCallback(() => {
    freqRef.current = freq;
    setVibrato(v => !v);
  }, [freq]);

  // Derived values
  const centerBin = freq / BIN_RES;
  const peakBinK = Math.round(centerBin);
  const binLow = Math.floor(centerBin);
  const binHigh = binLow + 1;
  const freqLow = (binLow * BIN_RES);
  const freqHigh = (binHigh * BIN_RES);
  const error = Math.abs(freq - peakBinK * BIN_RES);

  // Continuous envelope path
  const envPoints = [];
  for (let i = 0; i <= 300; i++) {
    const bin = BIN_START + (i / 300) * NUM_BINS;
    envPoints.push(`${i === 0 ? 'M' : 'L'}${binToX(bin).toFixed(1)},${ampToY(envelope(bin, centerBin)).toFixed(1)}`);
  }
  const envPath = envPoints.join(' ');

  // Discrete bins
  const bins = [];
  for (let k = BIN_START; k <= BIN_END; k++) {
    bins.push({ k, amp: envelope(k, centerBin), freq: (k * BIN_RES).toFixed(1) });
  }

  const sorted = [...bins].sort((a, b) => b.amp - a.amp);
  const top3 = new Set(sorted.slice(0, 3).map(b => b.k));
  const topBinK = sorted[0].k;

  return (
    <div className="max-w-6xl mx-auto px-4 py-2">
      {/* Header */}
      <div className={`mb-3 ${show ? 'anim-fade-up' : 'opacity-0'}`}>
        <span className="font-sans text-xs tracking-[0.2em] uppercase text-ink-faint">02 · Motivación</span>
        <h2 className="font-serif text-4xl sm:text-5xl font-500 text-ink mt-1">
          Fuga <em>Espectral</em>
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* LEFT: SVG + controls — 2 cols */}
        <div className={`lg:col-span-2 ${show ? 'anim-fade-up delay-1' : 'opacity-0'}`}>
          {/* SVG Chart */}
          <div className="bg-white rounded-xl border border-border p-3">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ overflow: 'visible' }}>
              {/* Axes */}
              <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="#ddd8ce" strokeWidth="1" />
              <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="#ddd8ce" strokeWidth="1" />
              <text x={PAD.l - 8} y={PAD.t + 5} textAnchor="end" className="font-sans text-[10px]" fill="#b0a990">1.0</text>
              <text x={PAD.l - 8} y={H - PAD.b + 4} textAnchor="end" className="font-sans text-[10px]" fill="#b0a990">0</text>
              <text x={W / 2} y={H - 6} textAnchor="middle" className="font-sans text-[11px]" fill="#b0a990">Frecuencia (Hz) — bins fijos de la FFT</text>



              {/* True frequency dashed line */}
              <line x1={binToX(centerBin)} y1={PAD.t - 5} x2={binToX(centerBin)} y2={H - PAD.b}
                stroke="#16a34a" strokeWidth="1.5" strokeDasharray="5 4" opacity="0.7" />
              <text x={binToX(centerBin)} y={PAD.t - 10} textAnchor="middle"
                className="font-mono text-[10px] font-bold" fill="#16a34a">
                {freq.toFixed(1)} Hz
              </text>

              {/* Stems */}
              {bins.map((b) => {
                const x = binToX(b.k);
                const y = ampToY(b.amp);
                const y0 = ampToY(0);
                const isTop = top3.has(b.k);
                const isPeak = b.k === topBinK;
                return (
                  <g key={b.k}>
                    <line x1={x} y1={y0} x2={x} y2={y}
                      stroke={isTop ? '#2563eb' : '#c4c0b6'}
                      strokeWidth={isTop ? 2.5 : 1.2} />
                    <circle cx={x} cy={y} r={isTop ? 5 : 3}
                      fill={isPeak ? '#2563eb' : isTop ? '#3b82f6' : '#d4d0c8'}
                      stroke="#fff" strokeWidth="1.5" />
                    {isTop && (
                      <>
                        <text x={x} y={y - 12} textAnchor="middle"
                          className="font-mono text-[10px] font-bold" fill="#2563eb">
                          k={b.k}
                        </text>
                        <text x={x} y={y0 + 16} textAnchor="middle"
                          className="font-mono text-[9px]" fill="#6b6b8a">
                          {b.freq}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            {/* Slider */}
            <div className="flex-1 min-w-[200px]">
              <label className="font-sans text-xs text-ink-muted block mb-1">
                Frecuencia de la nota: <strong className="text-ink font-mono">{freq.toFixed(1)} Hz</strong>
              </label>
              <input
                type="range"
                min="400"
                max="480"
                step="0.5"
                value={freq}
                onChange={handleSlider}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-accent-blue bg-border"
              />
              <div className="flex justify-between font-mono text-[9px] text-ink-faint mt-0.5">
                <span>400 Hz</span>
                <span>480 Hz</span>
              </div>
            </div>

            {/* Vibrato button */}
            <button
              onClick={toggleVibrato}
              className={`font-sans text-sm font-500 px-4 py-2.5 rounded-lg border transition-all active:scale-95
                ${vibrato
                  ? 'bg-accent-blue text-white border-accent-blue shadow-md shadow-accent-blue/20'
                  : 'bg-white text-ink-light border-border hover:border-accent-blue hover:text-accent-blue'
                }`}
            >
              {vibrato ? '⏸ Detener' : '〰 Vibrato'}
            </button>

            {/* Sound button */}
            <button
              onClick={toggleSound}
              className={`font-sans text-sm font-500 px-4 py-2.5 rounded-lg border transition-all active:scale-95
                ${playing
                  ? 'bg-accent-green text-white border-accent-green shadow-md shadow-accent-green/20'
                  : 'bg-white text-ink-light border-border hover:border-accent-green hover:text-accent-green'
                }`}
            >
              {playing ? '🔇 Silenciar' : '🔊 Escuchar'}
            </button>
          </div>
        </div>

        {/* RIGHT: Key metrics — 1 col */}
        <div className={`space-y-4 ${show ? 'anim-fade-up delay-3' : 'opacity-0'}`}>
          {/* Bin resolution */}
          <div className="bg-white rounded-xl border border-border p-4">
            <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-ink-faint mb-1">Resolución por bin</p>
            <div className="font-mono text-5xl font-bold text-ink leading-none">
              {BIN_RES.toFixed(2)}
              <span className="text-lg text-ink-muted font-normal ml-1">Hz</span>
            </div>
            <div className="mt-2">
              <M t={`\\Delta f = \\frac{f_s}{N} = \\frac{${FS}}{${N}}`} d />
            </div>
          </div>

          {/* Nearest bins */}
          <div className="bg-white rounded-xl border border-border p-4">
            <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-ink-faint mb-2">Bins vecinos a {freq.toFixed(0)} Hz</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div className="font-sans text-[9px] text-ink-faint mb-0.5">Bin {binLow}</div>
                <div className="font-mono text-3xl font-bold text-accent-blue leading-none">{freqLow.toFixed(1)}</div>
                <div className="text-[10px] text-ink-muted">Hz</div>
              </div>
              <div className="text-center">
                <div className="font-sans text-[9px] text-ink-faint mb-0.5">Bin {binHigh}</div>
                <div className="font-mono text-3xl font-bold text-accent-blue leading-none">{freqHigh.toFixed(1)}</div>
                <div className="text-[10px] text-ink-muted">Hz</div>
              </div>
            </div>
          </div>

          {/* Error */}
          <div className="rounded-xl border p-4 transition-colors bg-white border-border">
            <p className="font-sans text-[10px] tracking-[0.15em] uppercase text-ink-faint mb-1">Error respecto al bin más cercano</p>
            <div className="font-mono text-5xl font-bold leading-none text-ink">
              {error.toFixed(1)}
              <span className="text-lg font-normal ml-1">Hz</span>
            </div>
          </div>


        </div>
      </div>

      {/* ─── TIME-DOMAIN OSCILLOSCOPE ─── */}
      <div className={`mt-4 ${show ? 'anim-fade-up delay-4' : 'opacity-0'}`}>
        <div className="bg-white rounded-xl border border-border p-3">
          <svg viewBox="0 0 900 150" className="w-full" preserveAspectRatio="xMidYMid meet">
            {/* Static axes — never change */}
            <line x1="40" y1="10" x2="40" y2="125" stroke="#ddd8ce" strokeWidth="1" />
            <line x1="40" y1="67.5" x2="890" y2="67.5" stroke="#e0ddd4" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="40" y1="125" x2="890" y2="125" stroke="#ddd8ce" strokeWidth="1" />
            <text x="34" y="18" textAnchor="end" className="font-sans text-[9px]" fill="#b0a990">+1</text>
            <text x="34" y="125" textAnchor="end" className="font-sans text-[9px]" fill="#b0a990">−1</text>
            <text x="34" y="70" textAnchor="end" className="font-sans text-[8px]" fill="#c0bab0">0</text>
            <text x="465" y="146" textAnchor="middle" className="font-sans text-[10px]" fill="#b0a990">
              Tiempo (5 ms) — barrotes = muestreo discreto de la ventana
            </text>

            {/* Fixed fence posts: 24 evenly spaced vertical lines */}
            {Array.from({ length: 24 }, (_, i) => {
              const x = 40 + ((i + 1) / 25) * 850;
              const t = ((i + 1) / 25) * 0.005;
              const sY = 67.5 - Math.sin(2 * Math.PI * freq * t) * 53.5;
              return (
                <g key={i}>
                  <line x1={x} y1={10} x2={x} y2={125}
                    stroke="#d97706" strokeWidth="1.5" strokeDasharray="3 5" opacity="0.5" />
                  <circle cx={x} cy={sY} r="5.5"
                    fill="#d97706" stroke="#fff" strokeWidth="2.5" opacity="1" />
                </g>
              );
            })}

            {/* Sinusoid — 500 fixed points, only y changes with freq */}
            <path
              d={Array.from({ length: 501 }, (_, i) => {
                const x = 40 + (i / 500) * 850;
                const t = (i / 500) * 0.005;
                const y = 67.5 - Math.sin(2 * Math.PI * freq * t) * 53.5;
                return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
              }).join(' ')}
              fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
