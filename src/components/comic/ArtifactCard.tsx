import { Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { MissionData } from '../../data/types';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { hasWebGL } from '../../lib/device';
import { IconLock } from '../ui/Icons';

/** Procedural artifact geometry per mission (no extra downloads). */
function ArtifactMesh({ id, accent, reduced }: { id: string; accent: string; reduced: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((s, dt) => {
    if (!ref.current) return;
    if (!reduced) ref.current.rotation.y += dt * 0.5;
    ref.current.position.y = reduced ? 0 : Math.sin(s.clock.elapsedTime * 1.2) * 0.05;
  });

  const blade = useMemo(() => {
    const sh = new THREE.Shape();
    sh.moveTo(0, -0.08);
    sh.bezierCurveTo(0.6, -0.12, 1.1, -0.06, 1.25, -0.02);
    // Broken tip: a jagged end.
    sh.lineTo(1.18, 0.02);
    sh.lineTo(1.27, 0.05);
    sh.lineTo(1.12, 0.09);
    sh.bezierCurveTo(0.7, 0.1, 0.3, 0.12, 0, 0.08);
    sh.lineTo(0, -0.08);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 });
    g.center();
    return g;
  }, []);

  return (
    <group ref={ref}>
      {id === 'opportunity' && (
        <mesh>
          <icosahedronGeometry args={[0.62, 5]} />
          <meshStandardMaterial color="#5d5f63" metalness={0.75} roughness={0.42} flatShading={false} />
        </mesh>
      )}
      {id === 'apollo11' && (
        <mesh rotation={[0.6, 0.3, 0.2]}>
          {/* Corner cube: three mutually perpendicular faces meeting at a point. */}
          <coneGeometry args={[0.7, 0.85, 3, 1]} />
          <meshPhysicalMaterial color="#dfe9f2" metalness={0} roughness={0.04} transmission={0.85} thickness={0.6} ior={1.46} clearcoat={1} />
        </mesh>
      )}
      {id === 'ingenuity' && (
        <mesh geometry={blade} rotation={[0.4, 0, 0.3]} scale={1.2}>
          <meshStandardMaterial color="#1d1f22" metalness={0.35} roughness={0.38} />
        </mesh>
      )}
      <pointLight position={[1.4, 0.6, 1.2]} intensity={6} color={accent} />
    </group>
  );
}

export default function ArtifactCard({ mission, unlocked }: { mission: MissionData; unlocked: boolean }) {
  const reduced = useReducedMotion();
  const card = useRef<HTMLDivElement>(null);
  const [gl] = useState(hasWebGL);
  const accent = mission.theme === 'silver' ? '#e9c46a' : mission.theme === 'jezero' ? '#9fd0ff' : '#f6a764';
  const a = mission.artifact;

  const onMove = (e: React.PointerEvent) => {
    if (reduced || !card.current) return;
    const r = card.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    card.current.style.setProperty('--rx', `${(-y * 10).toFixed(2)}deg`);
    card.current.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`);
    card.current.style.setProperty('--gx', `${((x + 0.5) * 100).toFixed(1)}%`);
  };

  return (
    <div
      ref={card}
      className="artifact-card"
      data-unlocked={unlocked || undefined}
      onPointerMove={onMove}
      onPointerLeave={() => {
        card.current?.style.setProperty('--rx', '0deg');
        card.current?.style.setProperty('--ry', '0deg');
      }}
    >
      <div className="artifact-card__stage" aria-hidden={!unlocked}>
        {unlocked && gl ? (
          <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.2, 2.6], fov: 35 }} gl={{ antialias: true, alpha: true }}>
            <Suspense fallback={null}>
              <ambientLight intensity={0.35} />
              <directionalLight position={[-2, 3, 2]} intensity={2.4} />
              <directionalLight position={[2, -1, -2]} intensity={1.2} color={accent} />
              <ArtifactMesh id={mission.id} accent={accent} reduced={reduced} />
            </Suspense>
          </Canvas>
        ) : (
          <div className="grid h-full place-items-center text-fg-3">
            {unlocked ? (
              <span className="font-mono text-xs tracking-[0.2em]">{a.designation}</span>
            ) : (
              <span className="flex flex-col items-center gap-3">
                <IconLock size={34} />
                <span className="font-mono text-[11px] tracking-[0.22em]">ENCRYPTED</span>
              </span>
            )}
          </div>
        )}
        <div className="artifact-card__scan" />
      </div>
      <div className="artifact-card__body">
        <p className="kicker">{unlocked ? 'Artifact recovered' : 'Artifact locked'}</p>
        <h3 className="mt-1 font-display text-[24px] font-semibold leading-tight">{a.name}</h3>
        <p className="mt-1 font-mono text-[11px] tracking-[0.14em] text-fg-3">{a.designation}</p>
        <p className="mt-3 text-[14.5px] leading-relaxed text-fg-2">
          {unlocked ? a.description : `Pass the ${mission.miniGame.title} field test to recover this artifact.`}
        </p>
      </div>
    </div>
  );
}
