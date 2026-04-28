import { useEffect, useState, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Instances, Instance } from '@react-three/drei';
import * as THREE from 'three';

const NUM_FRAMES = 20;
const NUM_FREQ_BINS = 60;
const HARMONICS = [1, 2, 3, 4.01, 5];
const FUND = 12;

function generateSpectrum() {
  const bins = [];
  for (let i = 0; i < NUM_FREQ_BINS; i++) {
    let val = 0;
    for (const h of HARMONICS) {
      const center = FUND * h;
      const d = i - center;
      val += Math.exp(-d * d / (2 * 1.2 * 1.2)) * (1 / h) * 0.9;
    }
    val += Math.random() * 0.02;
    bins.push(val);
  }
  return bins;
}

function generateAllFrames() {
  return Array.from({ length: NUM_FRAMES }, () => generateSpectrum());
}

/* ── Translucent surface ── */
function Surface({ data }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const verts = [];
    const idx = [];
    const sx = 8 / NUM_FREQ_BINS, sz = 6 / NUM_FRAMES, sy = 3;

    for (let f = 0; f < NUM_FRAMES; f++) {
      for (let i = 0; i < NUM_FREQ_BINS; i++) {
        verts.push(i * sx - 4, data[f][i] * sy, f * sz - 3);
      }
    }
    for (let f = 0; f < NUM_FRAMES - 1; f++) {
      for (let i = 0; i < NUM_FREQ_BINS - 1; i++) {
        const a = f * NUM_FREQ_BINS + i;
        idx.push(a, a + NUM_FREQ_BINS, a + 1);
        idx.push(a + 1, a + NUM_FREQ_BINS, a + NUM_FREQ_BINS + 1);
      }
    }

    g.setIndex(idx);
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.computeVertexNormals();
    return g;
  }, [data]);

  return (
    <mesh geometry={geom}>
      <meshStandardMaterial color="#e8e0d0" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

/* ── Blue deterministic tracks ── */
function DeterministicTracks({ data }) {
  const tracks = useMemo(() => {
    const sx = 8 / NUM_FREQ_BINS, sz = 6 / NUM_FRAMES, sy = 3;
    return HARMONICS.map((h) => {
      const pts = [];
      for (let f = 0; f < NUM_FRAMES; f++) {
        let bestI = Math.round(FUND * h), bestV = 0;
        for (let i = Math.max(0, bestI - 2); i <= Math.min(NUM_FREQ_BINS - 1, bestI + 2); i++) {
          if (data[f][i] > bestV) { bestV = data[f][i]; bestI = i; }
        }
        pts.push(new THREE.Vector3(bestI * sx - 4, bestV * sy + 0.03, f * sz - 3));
      }
      return pts;
    });
  }, [data]);

  return tracks.map((pts, i) => (
    <Line key={i} points={pts} color="#2563eb" lineWidth={3.5} />
  ));
}

/* ── Red stochastic particles (orphan peaks) ── */
function StochasticParticles({ data }) {
  const particles = useMemo(() => {
    const sx = 8 / NUM_FREQ_BINS, sz = 6 / NUM_FRAMES, sy = 3;
    const pts = [];
    const harmonicBins = new Set();
    for (const h of HARMONICS) {
      for (let d = -2; d <= 2; d++) harmonicBins.add(Math.round(FUND * h) + d);
    }

    for (let f = 0; f < NUM_FRAMES; f++) {
      for (let i = 0; i < NUM_FREQ_BINS; i++) {
        if (harmonicBins.has(i)) continue;
        if (data[f][i] > 0.03 && Math.random() > 0.5) {
          pts.push({
            pos: [i * sx - 4, data[f][i] * sy + 0.05, f * sz - 3],
            scale: 0.03 + data[f][i] * 0.06,
          });
        }
      }
    }
    return pts;
  }, [data]);

  return (
    <Instances limit={500}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial color="#c0392b" transparent opacity={0.8} />
      {particles.map((p, i) => (
        <Instance key={i} position={p.pos} scale={p.scale} />
      ))}
    </Instances>
  );
}

/* ── Float animation for particles ── */
function FloatGroup({ children }) {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.03;
    }
  });
  return <group ref={ref}>{children}</group>;
}

/* ── Auto-rotate ── */
function AutoRotate({ controlsRef }) {
  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = true;
      controlsRef.current.autoRotateSpeed = 0.35;
    }
  });
  return null;
}

export default function SlideSMS() {
  const [show, setShow] = useState(false);
  const controlsRef = useRef();
  const allData = useMemo(() => generateAllFrames(), []);

  useEffect(() => { setShow(true); }, []);

  return (
    <div className="max-w-5xl mx-auto px-6 py-4">
      <div className={`mb-5 ${show ? 'anim-fade-up' : 'opacity-0'}`}>
        <span className="font-sans text-xs tracking-[0.2em] uppercase text-ink-faint">08 · Síntesis</span>
        <h2 className="font-serif text-4xl sm:text-5xl font-500 text-ink mt-1">
          Separación <em>SMS</em>
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* 3D Canvas */}
        <div className={`lg:col-span-3 canvas-3d ${show ? 'anim-fade-up delay-2' : 'opacity-0'}`}
          style={{ height: '420px' }}>
          <Canvas camera={{ position: [7, 5, 7], fov: 42 }} dpr={[1, 2]}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[5, 8, 5]} intensity={0.5} />
            <Surface data={allData} />
            <DeterministicTracks data={allData} />
            <FloatGroup>
              <StochasticParticles data={allData} />
            </FloatGroup>
            <OrbitControls ref={controlsRef} enablePan={false} minDistance={5} maxDistance={15} />
            <AutoRotate controlsRef={controlsRef} />
          </Canvas>
        </div>

        {/* Text */}
        <div className={`lg:col-span-2 space-y-4 ${show ? 'anim-fade-up delay-4' : 'opacity-0'}`}>
          <p className="text-ink-light text-[0.9rem] leading-relaxed">
            La <strong className="text-ink">Síntesis de Modelado Espectral (SMS)</strong> divide el mundo en dos:
          </p>

          <div className="space-y-4">
            {/* Deterministic */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent-blue/5 border border-accent-blue/15">
              <div className="shrink-0 w-3 h-3 mt-1 rounded-full bg-accent-blue" />
              <div>
                <p className="font-sans text-xs font-600 text-accent-blue mb-1">Determinista (Armónicos)</p>
                <p className="text-ink-light text-[0.85rem] leading-relaxed">
                  Los <strong className="text-accent-blue">hilos azules</strong> sólidos son trayectorias
                  estables — tonos puros con frecuencia, magnitud y fase continuas. Se resintetizan
                  con <em>síntesis aditiva</em>.
                </p>
              </div>
            </div>

            {/* Stochastic */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent-red/5 border border-accent-red/15">
              <div className="shrink-0 w-3 h-3 mt-1 rounded-full bg-accent-red" />
              <div>
                <p className="font-sans text-xs font-600 text-accent-red mb-1">Estocástico (Residuo)</p>
                <p className="text-ink-light text-[0.85rem] leading-relaxed">
                  Los <strong className="text-accent-red">picos rojos</strong> huérfanos que MQ desechó se
                  sustraen y se modelan como <em>ruido blanco filtrado</em> — el componente estocástico.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-3 mt-3">
            <p className="font-serif text-[0.95rem] text-ink italic leading-relaxed">
              ¡Hemos deconstruido el sonido!
            </p>
            <p className="sidenote mt-2">
              La señal original ≈ Determinista + Estocástico. Cada parte puede editarse
              independientemente: transposición, time-stretching, morphing...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
