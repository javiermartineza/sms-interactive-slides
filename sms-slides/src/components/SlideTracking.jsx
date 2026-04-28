import { useEffect, useState, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

/* ══════════════════════════════════════════════════════════════
   SCENE DATA
   X = Tiempo   Y = Magnitud (dB)   Z = Frecuencia (Hz)
   ══════════════════════════════════════════════════════════════ */
const FN = -4, FN1 = 0, FN2 = 5, PAST = -7;
const DF = 1.0;

const STRONG = { z: 1.2, y: 2.6, color: '#2563eb' };
const WEAK   = { z: 0.0, y: 1.0, color: '#f59e0b' };

// Frame n+1
const P1 = { z: 0.7, y: 2.3 }; // → match con STRONG
const P2 = { z: 2.8, y: 1.2 }; // → birth
const P3 = { z: -2.0, y: 0.9 }; // → birth

// Frame n+2  (los 3 tracks de n+1 encuentran match → sin deaths ni births)
const Q1 = { z: 0.5, y: 2.4 }; // → match con P1 (azul)
const Q2 = { z: 2.6, y: 0.9 }; // → match con P2 (verde)
const Q3 = { z: -1.8, y: 1.1 }; // → match con P3 (verde)
// |P1.z-Q1.z|=0.2 < DF ✓  |P2.z-Q2.z|=0.2 < DF ✓  |P3.z-Q3.z|=0.2 < DF ✓

/* ══════════════════════════════════════════════════════════════
   SMOOTH VALUE HOOK
   ══════════════════════════════════════════════════════════════ */
function useSmooth(target, speed = 4) {
  const v = useRef(target);
  useFrame((_, dt) => { v.current += (target - v.current) * Math.min(1, speed * dt); });
  return v;
}

/* ══════════════════════════════════════════════════════════════
   SPECTRAL STEM
   ══════════════════════════════════════════════════════════════ */
function Stem({ x, z, y, color, opacity = 1, glow = 0 }) {
  const stemRef = useRef();
  const sphereRef = useRef();
  const op = useSmooth(opacity);
  const gl = useSmooth(glow);

  useFrame(() => {
    const o = op.current;
    if (stemRef.current) stemRef.current.opacity = o;
    if (sphereRef.current) {
      sphereRef.current.opacity = o;
      sphereRef.current.emissiveIntensity = gl.current;
    }
  });

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, y / 2, 0]}>
        <cylinderGeometry args={[0.05, 0.05, y, 8]} />
        <meshStandardMaterial ref={stemRef} color={color} transparent opacity={1} />
      </mesh>
      <mesh position={[0, y, 0]}>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshStandardMaterial ref={sphereRef} color={color} emissive={color} emissiveIntensity={0} transparent opacity={1} />
      </mesh>
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════
   TRACK TUBE — historia PAST → frame dado
   ══════════════════════════════════════════════════════════════ */
function TrackTube({ z, y, color, opacity = 1 }) {
  const matRef = useRef();
  const op = useSmooth(opacity);

  const geom = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(PAST, y * 0.8, z + 0.15),
      new THREE.Vector3(PAST + 2, y * 0.85, z - 0.05),
      new THREE.Vector3(FN, y, z),
    ]);
    return new THREE.TubeGeometry(curve, 30, 0.045, 8, false);
  }, [z, y]);

  useFrame(() => { if (matRef.current) matRef.current.opacity = op.current; });
  return <mesh geometry={geom}><meshStandardMaterial ref={matRef} color={color} transparent opacity={1} /></mesh>;
}

/* ══════════════════════════════════════════════════════════════
   DEATH TAIL — amplitud decae A→0 en el TIEMPO (no en frecuencia)
   MQ: el track muerto interpola su amplitud a 0 en el siguiente frame
   ══════════════════════════════════════════════════════════════ */
function DeathTail({ peak, color, opacity = 0 }) {
  const matRef = useRef();
  const op = useSmooth(opacity);

  const geom = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(FN,       peak.y,       peak.z),
      new THREE.Vector3(FN + 1.5, peak.y * 0.4, peak.z),
      new THREE.Vector3(FN + 2.8, 0.05,         peak.z),
    ]);
    return new THREE.TubeGeometry(curve, 24, 0.032, 8, false);
  }, [peak]);

  useFrame(() => { if (matRef.current) matRef.current.opacity = op.current; });
  return <mesh geometry={geom}><meshStandardMaterial ref={matRef} color={color} transparent opacity={0} /></mesh>;
}

/* ══════════════════════════════════════════════════════════════
   SEARCH ZONE — banda ±Δf_max entre cualquier par de frames
   ══════════════════════════════════════════════════════════════ */
function SearchZone({ fromX, toX, z, y, color, opacity = 0 }) {
  const matRef = useRef();
  const op = useSmooth(opacity);
  const len = toX - fromX;
  const midX = (fromX + toX) / 2;

  useFrame(() => { if (matRef.current) matRef.current.opacity = op.current; });

  return (
    <group position={[midX, y / 2, z]}>
      <mesh>
        <boxGeometry args={[len, y + 0.2, DF * 2]} />
        <meshStandardMaterial ref={matRef} color={color} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0,  DF]}><boxGeometry args={[len, y + 0.2, 0.02]} /><meshStandardMaterial color={color} transparent opacity={opacity > 0 ? 0.3 : 0} /></mesh>
      <mesh position={[0, 0, -DF]}><boxGeometry args={[len, y + 0.2, 0.02]} /><meshStandardMaterial color={color} transparent opacity={opacity > 0 ? 0.3 : 0} /></mesh>
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════
   MATCH CURVE — arco glowing entre cualquier par de frames
   ══════════════════════════════════════════════════════════════ */
function MatchCurve({ fromX, fromPeak, toX, toPeak, color, opacity = 0 }) {
  const matRef = useRef();
  const op = useSmooth(opacity);

  const geom = useMemo(() => {
    const mx = (fromX + toX) / 2;
    const my = (fromPeak.y + toPeak.y) / 2 + 0.3;
    const mz = (fromPeak.z + toPeak.z) / 2;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(fromX, fromPeak.y, fromPeak.z),
      new THREE.Vector3(mx, my, mz),
      new THREE.Vector3(toX, toPeak.y, toPeak.z),
    ]);
    return new THREE.TubeGeometry(curve, 30, 0.05, 8, false);
  }, [fromX, fromPeak, toX, toPeak]);

  useFrame(() => { if (matRef.current) matRef.current.opacity = op.current; });
  return <mesh geometry={geom}><meshStandardMaterial ref={matRef} color={color} emissive={color} emissiveIntensity={0.4} transparent opacity={0} /></mesh>;
}

/* ══════════════════════════════════════════════════════════════
   COMMITTED TRACK — tubo sólido (trayectoria comprometida)
   ══════════════════════════════════════════════════════════════ */
function CommittedTrack({ fromX, fromPeak, toX, toPeak, color, opacity = 0 }) {
  const matRef = useRef();
  const op = useSmooth(opacity);

  const geom = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(fromX, fromPeak.y, fromPeak.z),
      new THREE.Vector3((fromX + toX) / 2, (fromPeak.y + toPeak.y) / 2 + 0.15, (fromPeak.z + toPeak.z) / 2),
      new THREE.Vector3(toX, toPeak.y, toPeak.z),
    ]);
    return new THREE.TubeGeometry(curve, 30, 0.055, 8, false);
  }, [fromX, fromPeak, toX, toPeak]);

  useFrame(() => { if (matRef.current) matRef.current.opacity = op.current; });
  return <mesh geometry={geom}><meshStandardMaterial ref={matRef} color={color} transparent opacity={0} /></mesh>;
}

/* ══════════════════════════════════════════════════════════════
   DEATH MARK — ✕ Html overlay sobre el último punto del track
   ══════════════════════════════════════════════════════════════ */
function DeathMark({ position, show = false }) {
  return (
    <Html position={position} center distanceFactor={9}
      style={{ transition: 'opacity 0.4s', opacity: show ? 1 : 0, pointerEvents: 'none' }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#ef4444', textShadow: '0 1px 8px rgba(0,0,0,0.25)', userSelect: 'none' }}>✕</div>
    </Html>
  );
}

/* ══════════════════════════════════════════════════════════════
   3D LABEL
   ══════════════════════════════════════════════════════════════ */
function Label3D({ position, text, color = '#fff', size = 13, show = true, bold = false }) {
  return (
    <Html position={position} center distanceFactor={9}
      style={{ transition: 'opacity 0.5s', opacity: show ? 1 : 0, pointerEvents: 'none' }}>
      <div style={{ fontFamily: 'Inter, sans-serif', fontSize: size, fontWeight: bold ? 800 : 600, color, whiteSpace: 'nowrap', userSelect: 'none', textShadow: '0 1px 6px rgba(0,0,0,0.15)', letterSpacing: '0.04em' }}>
        {text}
      </div>
    </Html>
  );
}

/* ══════════════════════════════════════════════════════════════
   AXES
   ══════════════════════════════════════════════════════════════ */
function Axes({ showFN2 }) {
  const axisColor = '#6b6b8a';
  const tickColor = '#9e9eb8';
  return (
    <group>
      <mesh position={[0, 0, -3]}><boxGeometry args={[14, 0.02, 0.02]} /><meshStandardMaterial color={axisColor} /></mesh>
      <Label3D position={[5.8, 0, -3]}  text="Tiempo →"    color={axisColor} size={12} />
      <Label3D position={[FN,  -0.5, -3]} text="Frame n"   color={tickColor} size={11} />
      <Label3D position={[FN1, -0.5, -3]} text="Frame n+1" color={tickColor} size={11} />
      <Label3D position={[FN2, -0.5, -3]} text="Frame n+2" color={tickColor} size={11} show={showFN2} />

      <mesh position={[PAST, 1.5, -3]}><boxGeometry args={[0.02, 3, 0.02]} /><meshStandardMaterial color={axisColor} /></mesh>
      <Label3D position={[PAST, 3.2, -3]} text="↑ |X(k)| dB"      color={axisColor} size={12} />

      <mesh position={[PAST, 0, 0.5]}><boxGeometry args={[0.02, 0.02, 7]} /><meshStandardMaterial color={axisColor} /></mesh>
      <Label3D position={[PAST, 0, 4.5]} text="Frecuencia (Hz) →" color={axisColor} size={12} />

      {[FN, FN1].map(x => (
        <mesh key={x} position={[x, 1.5, 0.5]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[7, 3]} />
          <meshStandardMaterial color="#c4b5fd" transparent opacity={0.04} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      ))}
      {showFN2 && (
        <mesh position={[FN2, 1.5, 0.5]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[7, 3]} />
          <meshStandardMaterial color="#c4b5fd" transparent opacity={0.04} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN 3D SCENE
   ══════════════════════════════════════════════════════════════ */
function Scene({ step }) {
  // ── Opacidades tracks Frame n ──────────────────────────────
  const strongOp = step >= 1 ? 1.0 : 0.65;
  const weakOp   = step >= 1 ? 0.45 : 0.65;

  // ── Ronda 1: n → n+1 ──────────────────────────────────────
  const sz1Strong = step === 2 || step === 3 ? 0.07 : 0;
  const sz1Weak   = step === 4 ? 0.06 : 0;
  const arc1Op    = step >= 3 && step < 6 ? 1 : 0;
  const com1Op    = step >= 6 ? 1 : 0;          // tubo sólido FN→FN1
  const deathTailOp = step >= 5 ? 0.7 : 0;

  const p1Glow = step >= 3 ? 1.5 : 0;
  const p2Glow = step >= 5 ? 1.5 : 0;
  const p3Glow = step >= 5 ? 1.5 : 0;

  // ── Ronda 2: n+1 → n+2 ────────────────────────────────────
  const fn2Op   = step >= 7 ? 1 : 0;            // stems n+2 aparecen
  // Paso 8: zonas de búsqueda desde n+1
  const sz2All  = step === 8 ? 0.07 : 0;
  // Paso 9: arcos de match n+1→n+2
  const arc2Op  = step === 9 ? 1 : 0;
  // Paso 9+: tubos comprometidos n+1→n+2
  const com2Op  = step >= 9 ? 1 : 0;

  // Colores de los stems en n+2: grises hasta que hay match (paso 9)
  const q1Color  = step >= 9 ? '#2563eb' : '#888';
  const q23Color = step >= 9 ? '#16a34a' : '#888';
  const qGlow    = step >= 9 ? 1.5 : 0;

  return (
    <>
      <color attach="background" args={['#f7f5f0']} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 8, 5]} intensity={0.6} />
      <directionalLight position={[-3, 4, -2]} intensity={0.2} />
      <gridHelper args={[14, 14, '#e0ddd4', '#eae7df']} position={[0, 0, 0.5]} />

      <Axes showFN2={step >= 7} />

      {/* ── Frame n ─────────────────────────────────────────── */}
      <Stem x={FN} z={STRONG.z} y={STRONG.y} color={STRONG.color} opacity={strongOp} />
      <Stem x={FN} z={WEAK.z}   y={WEAK.y}   color={WEAK.color}   opacity={weakOp} />
      <TrackTube z={STRONG.z} y={STRONG.y} color={STRONG.color} opacity={strongOp} />
      <TrackTube z={WEAK.z}   y={WEAK.y}   color={WEAK.color}   opacity={weakOp} />

      {/* ── Death tail: decaimiento A→0 en el tiempo ────────── */}
      <DeathTail peak={WEAK} color={WEAK.color} opacity={deathTailOp} />
      <DeathMark position={[FN, WEAK.y + 0.45, WEAK.z]} show={step >= 5} />

      {/* ── Frame n+1 ───────────────────────────────────────── */}
      <Stem x={FN1} z={P1.z} y={P1.y} color={step >= 3 ? '#2563eb' : '#888'} glow={p1Glow} />
      <Stem x={FN1} z={P2.z} y={P2.y} color={step >= 5 ? '#16a34a' : '#888'} glow={p2Glow} />
      <Stem x={FN1} z={P3.z} y={P3.y} color={step >= 5 ? '#16a34a' : '#888'} glow={p3Glow} />

      {/* ── Frame n+2 ───────────────────────────────────────── */}
      <Stem x={FN2} z={Q1.z} y={Q1.y} color={q1Color}  opacity={fn2Op} glow={qGlow} />
      <Stem x={FN2} z={Q2.z} y={Q2.y} color={q23Color} opacity={fn2Op} glow={qGlow} />
      <Stem x={FN2} z={Q3.z} y={Q3.y} color={q23Color} opacity={fn2Op} glow={qGlow} />

      {/* ── Zonas búsqueda ronda 1 ──────────────────────────── */}
      <SearchZone fromX={FN} toX={FN1} z={STRONG.z} y={STRONG.y} color={STRONG.color} opacity={sz1Strong} />
      <SearchZone fromX={FN} toX={FN1} z={WEAK.z}   y={WEAK.y}   color={WEAK.color}   opacity={sz1Weak} />

      {/* ── Zonas búsqueda ronda 2 (paso 8) ────────────────── */}
      <SearchZone fromX={FN1} toX={FN2} z={P1.z} y={P1.y} color="#2563eb" opacity={sz2All} />
      <SearchZone fromX={FN1} toX={FN2} z={P2.z} y={P2.y} color="#16a34a" opacity={sz2All} />
      <SearchZone fromX={FN1} toX={FN2} z={P3.z} y={P3.y} color="#16a34a" opacity={sz2All} />

      {/* ── Arcos match ronda 1 (pasos 3-5) ─────────────────── */}
      <MatchCurve fromX={FN} fromPeak={STRONG} toX={FN1} toPeak={P1} color="#2563eb" opacity={arc1Op} />

      {/* ── Arcos match ronda 2 (paso 9) ────────────────────── */}
      <MatchCurve fromX={FN1} fromPeak={P1} toX={FN2} toPeak={Q1} color="#2563eb"  opacity={arc2Op} />
      <MatchCurve fromX={FN1} fromPeak={P2} toX={FN2} toPeak={Q2} color="#16a34a" opacity={arc2Op} />
      <MatchCurve fromX={FN1} fromPeak={P3} toX={FN2} toPeak={Q3} color="#16a34a" opacity={arc2Op} />

      {/* ── Tubos comprometidos ronda 1 (paso 6) ────────────── */}
      <CommittedTrack fromX={FN} fromPeak={STRONG} toX={FN1} toPeak={P1} color="#2563eb" opacity={com1Op} />

      {/* ── Tubos comprometidos ronda 2 (paso 9) ────────────── */}
      <CommittedTrack fromX={FN1} fromPeak={P1} toX={FN2} toPeak={Q1} color="#2563eb"  opacity={com2Op} />
      <CommittedTrack fromX={FN1} fromPeak={P2} toX={FN2} toPeak={Q2} color="#16a34a" opacity={com2Op} />
      <CommittedTrack fromX={FN1} fromPeak={P3} toX={FN2} toPeak={Q3} color="#16a34a" opacity={com2Op} />

      {/* ── Labels de paso ──────────────────────────────────── */}
      <Label3D position={[0, 3.5, 0]} text="1 · Ordenar tracks por magnitud ↓"              color="#7c3aed" size={14} bold show={step === 1} />
      <Label3D position={[0, 3.5, 0]} text="2 · Buscar picos dentro de ±Δf_max"             color="#2563eb" size={14} bold show={step === 2} />
      <Label3D position={[0, 3.5, 0]} text="3 · MATCH — track fuerte toma P₁"               color="#16a34a" size={14} bold show={step === 3} />
      <Label3D position={[0, 3.5, 0]} text="4 · P₁ ya tomado — track débil sin candidato"   color="#ef4444" size={14} bold show={step === 4} />
      <Label3D position={[0, 3.5, 0]} text="5 · DEATH · amplitud decae a 0 en el tiempo"    color="#7c3aed" size={14} bold show={step === 5} />
      <Label3D position={[0, 3.5, 0]} text="6 · Trayectorias comprometidas en Frame n+1"    color="#2563eb" size={14} bold show={step === 6} />
      <Label3D position={[1, 3.5, 0]} text="7 · Frame n+2 detectado — el algoritmo repite"  color="#6b7280" size={14} bold show={step === 7} />
      <Label3D position={[1, 3.5, 0]} text="8 · Ordenar + buscar desde los 3 tracks vivos"  color="#7c3aed" size={14} bold show={step === 8} />
      <Label3D position={[1, 3.5, 0]} text="9 · 3 matches — sin deaths ni births esta vez"  color="#16a34a" size={14} bold show={step === 9} />

      {/* Track labels */}
      <Label3D position={[FN-1, STRONG.y+0.3, STRONG.z]} text="Track FUERTE" color="#2563eb" size={11} show={step >= 1} />
      <Label3D position={[FN-1, WEAK.y+0.3,   WEAK.z]}   text="track débil"  color="#f59e0b" size={10} show={step >= 1 && step < 5} />

      {/* Tolerancia ronda 1 */}
      <Label3D position={[(FN+FN1)/2, STRONG.y+0.5, STRONG.z+DF]} text="±Δf_max" color="#2563eb" size={10} show={step === 2 || step === 3} />
      <Label3D position={[(FN+FN1)/2, WEAK.y+0.5,   WEAK.z+DF]}   text="±Δf_max" color="#f59e0b" size={10} show={step === 4} />

      {/* Tolerancia ronda 2 */}
      <Label3D position={[(FN1+FN2)/2, P1.y+0.5, P1.z+DF]} text="±Δf_max" color="#2563eb" size={10} show={step === 8} />
      <Label3D position={[(FN1+FN2)/2, P2.y+0.5, P2.z+DF]} text="±Δf_max" color="#16a34a" size={10} show={step === 8} />

      {/* Robo */}
      <Label3D position={[FN1+0.6, P1.y+0.3, P1.z]} text="✗ Ya tomado" color="#ef4444" size={12} bold show={step === 4} />

      {/* Death / Birth ronda 1 */}
      <Label3D position={[FN+0.3, WEAK.y-0.7, WEAK.z]} text="💀 DEATH" color="#ef4444" size={16} bold show={step === 5} />
      <Label3D position={[FN1+0.5, P2.y+0.3, P2.z]}    text="✦ BIRTH"  color="#16a34a" size={13} bold show={step >= 5 && step < 7} />
      <Label3D position={[FN1+0.5, P3.y+0.3, P3.z]}    text="✦ BIRTH"  color="#16a34a" size={13} bold show={step >= 5 && step < 7} />

      {/* Confirmado ronda 1 */}
      <Label3D position={[FN1+0.5, P1.y+0.4, P1.z]} text="✓" color="#2563eb" size={14} bold show={step === 6} />

      {/* Picos n+1 sin label en pasos avanzados */}
      <Label3D position={[FN1, P1.y+0.35, P1.z]} text="P₁" color="#666" size={11} show={step < 3} />
      <Label3D position={[FN1, P2.y+0.35, P2.z]} text="P₂" color="#666" size={11} show={step < 5} />
      <Label3D position={[FN1, P3.y+0.35, P3.z]} text="P₃" color="#666" size={11} show={step < 5} />

      {/* Picos n+2 */}
      <Label3D position={[FN2, Q1.y+0.35, Q1.z]} text="Q₁" color="#888" size={11} show={step >= 7 && step < 9} />
      <Label3D position={[FN2, Q2.y+0.35, Q2.z]} text="Q₂" color="#888" size={11} show={step >= 7 && step < 9} />
      <Label3D position={[FN2, Q3.y+0.35, Q3.z]} text="Q₃" color="#888" size={11} show={step >= 7 && step < 9} />

      {/* Match confirmado ronda 2 */}
      <Label3D position={[FN2+0.5, Q1.y+0.3, Q1.z]} text="✓" color="#2563eb"  size={14} bold show={step >= 9} />
      <Label3D position={[FN2+0.5, Q2.y+0.3, Q2.z]} text="✓" color="#16a34a" size={14} bold show={step >= 9} />
      <Label3D position={[FN2+0.5, Q3.y+0.3, Q3.z]} text="✓" color="#16a34a" size={14} bold show={step >= 9} />

      <OrbitControls enablePan={false} minDistance={5} maxDistance={20}
        autoRotate autoRotateSpeed={0.2} target={[0, 1.2, 0.5]} />
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   STEP DESCRIPTIONS
   ══════════════════════════════════════════════════════════════ */
const STEPS = [
  { title: 'Escena Inicial', color: '#9e9eb8',
    desc: 'Dos tracks activos en Frame n, tres picos en Frame n+1. MQ debe decidir cómo conectarlos.' },
  { title: '1 · Ordenar por Magnitud', color: '#7c3aed',
    desc: 'Los tracks se ordenan de mayor a menor magnitud. El track fuerte (azul) se procesa primero — Regla de Oro.' },
  { title: '2 · Búsqueda (Δf_max)', color: '#2563eb',
    desc: 'Desde el track fuerte se proyecta ±Δf_max. Solo los picos dentro de la banda son candidatos válidos.' },
  { title: '3 · Match', color: '#16a34a',
    desc: 'P₁ cae dentro de la tolerancia → track fuerte se empareja. La trayectoria se extiende al siguiente frame.' },
  { title: '4 · Robo Evitado', color: '#ef4444',
    desc: 'El track débil busca candidato, pero P₁ ya está en claimed. Sin la ordenación, lo habría robado.' },
  { title: '5 · Death & Birth', color: '#a78bfa',
    desc: 'DEATH: amplitud decae A→0 en el tiempo (tubo naranja). P₂ y P₃, sin match previo, nacen como tracks nuevos.' },
  { title: '6 · Frame n+1 resuelto', color: '#2563eb',
    desc: 'Trayectoria azul comprometida. P₂ y P₃ son tracks nacientes. Frame n+1 pasa a ser el nuevo "Frame n".' },
  { title: '7 · Frame n+2 detectado', color: '#6b7280',
    desc: 'Nuevos picos Q₁, Q₂, Q₃ detectados. El mismo bucle MQ se repite desde los 3 tracks activos.' },
  { title: '8 · Ordenar + Buscar', color: '#7c3aed',
    desc: 'Los 3 tracks se ordenan (P₁ > P₂ > P₃). Cada uno proyecta su zona de búsqueda ±Δf_max hacia n+2.' },
  { title: '9 · Todos con Match', color: '#16a34a',
    desc: 'Los 3 tracks encuentran candidato. Sin deaths ni births — así crecen los "espaguetis" del SMS.' },
];

/* ══════════════════════════════════════════════════════════════
   PSEUDO-CODE DATA
   ══════════════════════════════════════════════════════════════ */
const PSEUDO = [
  { key: 'outer',   text: 'for frame, peaks in frames:' },
  { key: 'claimed', text: '  claimed = set()' },
  { key: 'sort',    text: '  active.sort(key=mag, desc=True)' },
  { key: 'blank1',  text: null },
  { key: 'inner',   text: '  for track in active:' },
  { key: 'nearest', text: '    best = nearest(peaks, track.freq, max_df, claimed)' },
  { key: 'ifmatch', text: '    if best is not None:' },
  { key: 'match',   text: '      track.extend(best)         # ✓ MATCH' },
  { key: 'clm',     text: '      claimed.add(best)' },
  { key: 'else',    text: '    else:' },
  { key: 'death',   text: '      finish(track)             # ✕ DEATH' },
  { key: 'blank2',  text: null },
  { key: 'bloop',   text: '  for i, p in enumerate(peaks):' },
  { key: 'bif',     text: '    if i not in claimed:' },
  { key: 'birth',   text: '      active.append(new(p))     # ✦ BIRTH' },
];

const STEP_HL = {
  0: [],
  1: ['sort'],
  2: ['nearest'],
  3: ['ifmatch', 'match', 'clm'],
  4: ['nearest', 'ifmatch'],
  5: ['else', 'death', 'bloop', 'bif', 'birth'],
  6: ['outer'],
  7: ['outer'],
  8: ['sort', 'nearest'],
  9: ['ifmatch', 'match', 'clm'],
};

/* ══════════════════════════════════════════════════════════════
   PSEUDO-CODE PANEL
   ══════════════════════════════════════════════════════════════ */
function PseudoCode({ step, hlColor }) {
  const hl = new Set(STEP_HL[step] || []);
  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      fontSize: 11,
      lineHeight: 1.45,
      padding: '10px 12px',
      borderRadius: 14,
      background: '#f0ede6',
      border: '1px solid #e0ddd4',
      overflowY: 'auto',
    }}>
      {PSEUDO.map(line => {
        if (line.text === null) return <div key={line.key} style={{ height: 5 }} />;
        const isHL = hl.has(line.key);
        const hi = line.text.indexOf('#');
        const code = hi !== -1 ? line.text.slice(0, hi) : line.text;
        const cmt  = hi !== -1 ? line.text.slice(hi) : null;
        return (
          <div key={line.key} style={{
            padding: '1px 8px 1px 6px',
            borderRadius: 4,
            backgroundColor: isHL ? `${hlColor}1a` : 'transparent',
            borderLeft: `3px solid ${isHL ? hlColor : 'transparent'}`,
            transition: 'background-color 0.4s, border-color 0.4s',
            whiteSpace: 'pre',
          }}>
            <span style={{ color: isHL ? hlColor : '#7a7a9a', fontWeight: isHL ? 700 : 400, transition: 'color 0.4s' }}>
              {code}
            </span>
            {cmt && (
              <span style={{ color: isHL ? `${hlColor}bb` : '#b0b0c8', fontWeight: 400, fontStyle: 'italic' }}>
                {cmt}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

const BTN_LABELS = [
  'Siguiente: Ordenar',
  'Siguiente: Buscar',
  'Siguiente: Match',
  'Siguiente: Robo Evitado',
  'Siguiente: Death & Birth',
  'Siguiente: Ver Frame n+1 resuelto',
  'Siguiente: Frame n+2',
  'Siguiente: Ordenar y Buscar',
  'Siguiente: Matches',
];

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function SlideTracking() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => { setShow(true); }, []);

  const info = STEPS[step];

  return (
    <div className="w-full max-w-[95vw] mx-auto px-4 py-2">
      <div className={`mb-2 ${show ? 'anim-fade-up' : 'opacity-0'}`}>
        <span className="font-sans text-xs tracking-[0.2em] uppercase text-ink-faint">04 · Tracking</span>
        <h2 className="font-serif text-4xl sm:text-3xl font-500 text-ink mt-1">
          Rastreo de Picos <em>(McAulay-Quatieri)</em>
        </h2>
        <p className="font-sans text-sm text-ink-muted">
          De picos STFT discretos → <strong className="text-ink">trayectorias sinusoidales continuas</strong>
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-stretch mt-2">
        {/* 3D Canvas */}
        <div className={`w-full lg:w-[62%] canvas-3d ${show ? 'anim-fade-up delay-2' : 'opacity-0'}`}
          style={{ height: '440px' }}>
          <Canvas camera={{ position: [6, 5, 8], fov: 40 }} dpr={[1, 2]}>
            <Scene step={step} />
          </Canvas>
        </div>

        {/* Side panel */}
        <div className={`w-full lg:w-[38%] flex flex-col gap-2 ${show ? 'anim-fade-up delay-4' : 'opacity-0'}`}>

          {/* Step info card */}
          <div className="px-3 py-2.5 rounded-2xl border border-border bg-white shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: info.color }} />
              <p className="font-sans text-sm font-bold leading-tight" style={{ color: info.color }}>{info.title}</p>
            </div>
            <p className="font-sans text-xs text-ink-light leading-relaxed">{info.desc}</p>
          </div>

          {/* Pseudocode panel */}
          <PseudoCode step={step} hlColor={info.color} />

          {/* Progress */}
          <div className="flex gap-1 items-center px-1">
            {STEPS.map((_, i) => (
              <div key={i} className="transition-all duration-300 rounded-full"
                style={{ width: i === step ? 18 : 6, height: 6, backgroundColor: i <= step ? info.color : '#e0ddd4', opacity: i <= step ? 1 : 0.4 }} />
            ))}
            <span className="ml-auto font-mono text-xs text-ink-faint">{step + 1}/{STEPS.length}</span>
          </div>

          {step < 9 ? (
            <button onClick={() => setStep(s => s + 1)}
              className="w-full px-6 py-3 bg-accent-blue text-white rounded-xl font-sans text-sm font-bold shadow-sm hover:bg-accent-blue/90 hover:shadow-md transition-all active:scale-[0.97] flex items-center justify-center gap-2">
              <span>{BTN_LABELS[step]}</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button onClick={() => setStep(0)}
              className="w-full px-6 py-3 bg-ink/10 text-ink rounded-xl font-sans text-sm font-bold hover:bg-ink/15 transition-all active:scale-[0.97] flex items-center justify-center gap-2">
              <span>↺ Reiniciar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
