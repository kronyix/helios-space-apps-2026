import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as THREE from 'three';
import { Stars } from '@react-three/drei';
import { fbm, mulberry32 } from '../../lib/noise';
import { SkyMaterial } from './materials';
import type { CelestialBody } from '../../data/types';

/** Art direction per body. Mars: warm dusty haze, soft shadows. Moon: one hard sun, black sky. */
export const ENV = {
  mars: {
    ground: ['#8a4526', '#b5643a', '#6b3018'],
    fog: '#c98d63',
    skyTop: '#7f5a43',
    skyHorizon: '#d9a57a',
    sun: new THREE.Vector3(-6, 3.2, 3.5),
    sunColor: '#ffd9b0',
    sunIntensity: 2.6,
    hemi: ['#e6b48a', '#4a2414', 0.75] as const,
    relief: 0.55,
    rock: '#6e3a22',
  },
  moon: {
    ground: ['#777571', '#8f8c86', '#5d5b57'],
    fog: '#000000',
    skyTop: '#000000',
    skyHorizon: '#000000',
    sun: new THREE.Vector3(-7, 2.4, 2),
    sunColor: '#ffffff',
    sunIntensity: 4.2,
    hemi: ['#9db4d6', '#1a1a1a', 0.08] as const,
    relief: 0.32,
    rock: '#6a6864',
  },
} as const;

const CLEAR_R = 2.1;

export function terrainHeight(x: number, z: number, body: CelestialBody) {
  const e = ENV[body];
  const d = Math.hypot(x, z);
  const n = fbm(x * 0.09 + 10, z * 0.09 + 3, 5, body === 'mars' ? 3 : 9) - 0.5;
  const fine = fbm(x * 0.7, z * 0.7, 3, 21) - 0.5;
  // Flatten the work area so hardware sits on the ground, ramp relief outward.
  const ramp = THREE.MathUtils.smoothstep(d, CLEAR_R, CLEAR_R + 6);
  let h = n * e.relief * 6 * ramp + fine * 0.05;
  if (body === 'moon') {
    // A couple of shallow craters.
    for (const [cx, cz, r] of [
      [-7, -6, 3.2],
      [8, -10, 4.5],
      [5, 6, 1.8],
    ] as const) {
      const dd = Math.hypot(x - cx, z - cz) / r;
      if (dd < 1.4) h += dd < 1 ? -0.45 * (1 - dd * dd) : 0.25 * Math.sin(((dd - 1) / 0.4) * Math.PI);
    }
  }
  return h;
}

function makeDetailTexture(body: CelestialBody) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const v = fbm(x / 9, y / 9, 4, body === 'mars' ? 5 : 11);
      const grain = Math.random() * 0.25;
      const k = Math.floor((v * 0.75 + grain) * 255);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = k;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(24, 24);
  return t;
}

export function Terrain({ body, segments }: { body: CelestialBody; segments: number }) {
  const { geometry, bump } = useMemo(() => {
    const e = ENV[body];
    const geo = new THREE.PlaneGeometry(60, 60, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const cA = new THREE.Color(e.ground[0]);
    const cB = new THREE.Color(e.ground[1]);
    const cC = new THREE.Color(e.ground[2]);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z, body);
      pos.setY(i, h);
      const m = fbm(x * 0.25 + 40, z * 0.25, 3, 7);
      tmp.copy(cA).lerp(cB, THREE.MathUtils.smoothstep(m, 0.35, 0.75)).lerp(cC, THREE.MathUtils.clamp(-h * 1.2, 0, 0.6));
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return { geometry: geo, bump: makeDetailTexture(body) };
  }, [body, segments]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1} metalness={0} bumpMap={bump} bumpScale={body === 'moon' ? 1.4 : 0.8} />
    </mesh>
  );
}

/** Instanced rocks at three scales; keeps the work area clear. */
export function Rocks({ body, count }: { body: CelestialBody; count: number }) {
  const sets = useMemo(() => {
    const rnd = mulberry32(body === 'mars' ? 42 : 7);
    const scales = [
      { n: Math.round(count * 0.72), min: 0.025, max: 0.07, rMin: CLEAR_R * 0.55, rMax: 14 },
      { n: Math.round(count * 0.22), min: 0.08, max: 0.2, rMin: CLEAR_R + 0.3, rMax: 18 },
      { n: Math.max(4, Math.round(count * 0.06)), min: 0.3, max: 0.75, rMin: CLEAR_R + 2.5, rMax: 22 },
    ];
    return scales.map((s) => {
      const m: THREE.Matrix4[] = [];
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      for (let i = 0; i < s.n; i++) {
        const a = rnd() * Math.PI * 2;
        const r = s.rMin + Math.sqrt(rnd()) * (s.rMax - s.rMin);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const sc = s.min + rnd() * (s.max - s.min);
        e.set(rnd() * 3, rnd() * 3, rnd() * 3);
        q.setFromEuler(e);
        const y = terrainHeight(x, z, body) + sc * 0.25;
        m.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sc * (0.8 + rnd() * 0.6), sc * (0.5 + rnd() * 0.4), sc)));
      }
      return m;
    });
  }, [body, count]);

  return (
    <>
      {sets.map((mats, i) => (
        <instancedMesh
          key={i}
          args={[undefined, undefined, mats.length]}
          castShadow={i > 0}
          receiveShadow
          ref={(im) => {
            if (!im) return;
            mats.forEach((mm, j) => im.setMatrixAt(j, mm));
            im.instanceMatrix.needsUpdate = true;
          }}
        >
          <dodecahedronGeometry args={[1, i === 2 ? 1 : 0]} />
          <meshStandardMaterial color={ENV[body].rock} roughness={0.95} flatShading />
        </instancedMesh>
      ))}
    </>
  );
}

export function Sky({ body }: { body: CelestialBody }) {
  const e = ENV[body];
  if (body === 'moon') {
    return (
      <>
        <color attach="background" args={['#000000']} />
        <Stars radius={80} depth={20} count={1800} factor={2.5} saturation={0} fade speed={0} />
        {/* Earth hangs in the lunar sky (it is the laser game's origin). */}
        <mesh position={[-16, 11, -34]}>
          <sphereGeometry args={[1.5, 48, 32]} />
          <meshStandardMaterial color="#3d6fb3" emissive="#1c3558" emissiveIntensity={0.35} roughness={0.6} />
        </mesh>
      </>
    );
  }
  return (
    <>
      <color attach="background" args={[e.skyHorizon]} />
      <fog attach="fog" args={[e.fog, 7, 34]} />
      <mesh scale={70}>
        <sphereGeometry args={[1, 32, 16]} />
        <SkyMaterial top={e.skyTop} horizon={e.skyHorizon} sunDir={e.sun} sunColor="#fff0d8" />
      </mesh>
    </>
  );
}

export function Lights({ body, shadowSize }: { body: CelestialBody; shadowSize: number }) {
  const e = ENV[body];
  return (
    <>
      <hemisphereLight args={[e.hemi[0], e.hemi[1], e.hemi[2]]} />
      {body === 'moon' && <directionalLight position={[5, 3, 6]} intensity={0.06} color="#9db4d6" />}
      <directionalLight
        castShadow
        position={e.sun}
        intensity={e.sunIntensity}
        color={e.sunColor}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={body === 'mars' ? 6 : 1}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
      />
    </>
  );
}

/**
 * Image-based lighting for metals (Kapton foil, rotor carbon, rover deck) without
 * downloading an HDR: a prefiltered procedural room, kept faint so the art-directed
 * sun stays the key light. The Moon gets less (black sky, little bounce).
 */
export function ReflectionEnv({ body }: { body: CelestialBody }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const rt = pmrem.fromScene(room, 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = body === 'moon' ? 0.22 : 0.4;
    room.dispose();
    pmrem.dispose();
    return () => {
      scene.environment = null;
      rt.dispose();
    };
  }, [gl, scene, body]);
  return null;
}
