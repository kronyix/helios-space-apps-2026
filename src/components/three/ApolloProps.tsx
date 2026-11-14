import { useMemo } from 'react';
import * as THREE from 'three';
import type { HotspotData } from '../../data/types';

/**
 * Procedural stand-ins for the two EASEP instruments the Apollo 11 crew set up
 * near Eagle (the LM model does not include them). Proportions follow NASA photo
 * AS11-40-5948; they are art-directed placeholders, not survey-accurate models.
 */
function cornerCubeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6f6a5c';
  g.fillRect(0, 0, 256, 256);
  const n = 10;
  const s = 256 / n;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const cx = x * s + s / 2;
      const cy = y * s + s / 2;
      const grd = g.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, s * 0.45);
      grd.addColorStop(0, '#d9e3ea');
      grd.addColorStop(0.6, '#4c5a66');
      grd.addColorStop(1, '#1b2027');
      g.fillStyle = grd;
      g.beginPath();
      g.arc(cx, cy, s * 0.42, 0, Math.PI * 2);
      g.fill();
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Lrrr({ position }: { position: THREE.Vector3 }) {
  const tex = useMemo(cornerCubeTexture, []);
  return (
    <group position={[position.x, 0, position.z]} rotation-y={-0.5}>
      {/* support struts */}
      {[-0.16, 0.16].map((x) => (
        <mesh key={x} position={[x, 0.07, 0]} castShadow>
          <boxGeometry args={[0.02, 0.14, 0.18]} />
          <meshStandardMaterial color="#b9b5ab" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <group position={[0, 0.16, 0]} rotation-x={-0.55}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.46, 0.03, 0.46]} />
          <meshStandardMaterial color="#a8a497" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.0155, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.42, 0.42]} />
          <meshStandardMaterial map={tex} metalness={0.9} roughness={0.15} />
        </mesh>
      </group>
    </group>
  );
}

function Psep({ position }: { position: THREE.Vector3 }) {
  return (
    <group position={[position.x, 0, position.z]} rotation-y={0.4}>
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.1, 0.12, 0.24, 6]} />
        <meshStandardMaterial color="#c9a227" metalness={0.85} roughness={0.32} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.32, 0.2, 0]} rotation-z={side * 0.06} castShadow receiveShadow>
          <boxGeometry args={[0.42, 0.012, 0.26]} />
          <meshStandardMaterial color="#1d2a44" metalness={0.5} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[0, 0.27, 0]} castShadow>
        <cylinderGeometry args={[0.004, 0.004, 0.12]} />
        <meshStandardMaterial color="#ddd" />
      </mesh>
    </group>
  );
}

export function ApolloSurfaceProps({ hotspots }: { hotspots: HotspotData[] }) {
  const lrrr = hotspots.find((h) => h.id === 'lrrr');
  const psep = hotspots.find((h) => h.id === 'psep');
  return (
    <>
      {lrrr && <Lrrr position={new THREE.Vector3(...lrrr.position)} />}
      {psep && <Psep position={new THREE.Vector3(...psep.position)} />}
    </>
  );
}
