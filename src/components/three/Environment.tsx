import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as THREE from 'three';
import { Stars } from '@react-three/drei';
import { fbm, mulberry32 } from '../../lib/noise';
import { AtmosphereMaterial, SkyMaterial } from './materials';
import type { CelestialBody } from '../../data/types';

/** Art direction per body. Mars: warm dusty haze, soft shadows. Moon: one hard sun, black sky, crisp shadows. */
export const ENV = {
  mars: {
    ground: ['#4e2213', '#ad4c26', '#d67c46'], // Dark basalt, ferric dust, outcrop ochre
    fog: '#cf8a5f',
    skyTop: '#764731',
    skyHorizon: '#dca074',
    sun: new THREE.Vector3(-6, 3.2, 3.5),
    sunColor: '#ffe1bf',
    sunIntensity: 2.8,
    hemi: ['#e8af82', '#4d2312', 0.8] as const,
    relief: 0.58,
    rock: '#6a341e',
    blueberry: '#363342', // Hematite spherules
  },
  moon: {
    ground: ['#484643', '#77746e', '#9b9891'], // Mare basalt, regolith midtone, ejecta rim bright
    fog: '#000000',
    skyTop: '#000000',
    skyHorizon: '#000000',
    sun: new THREE.Vector3(-7, 2.5, 2),
    sunColor: '#ffffff',
    sunIntensity: 4.8,
    hemi: ['#8fb6e6', '#050505', 0.05] as const, // Subtle cool Earthshine fill
    relief: 0.44,
    rock: '#5e5c58',
  },
} as const;

const CLEAR_R = 2.1;

// Lunar crater catalogue: [cx, cz, radius, depth, rimHeight]
const MOON_CRATERS: readonly [number, number, number, number, number][] = [
  [-7.2, -6.5, 3.6, 0.75, 0.32],
  [12.5, -13.0, 6.4, 1.25, 0.48],
  [5.2, 5.8, 2.2, 0.45, 0.22],
  [-4.8, 4.6, 1.1, 0.25, 0.12],
  [6.8, -4.2, 1.4, 0.28, 0.14],
  [-9.5, 3.2, 1.8, 0.38, 0.18],
  [11.0, 7.5, 2.6, 0.52, 0.25],
];

export function terrainHeight(x: number, z: number, body: CelestialBody) {
  const e = ENV[body];
  const d = Math.hypot(x, z);
  const ramp = THREE.MathUtils.smoothstep(d, CLEAR_R, CLEAR_R + 5.5);

  if (body === 'moon') {
    // Multi-octave mare regolith undulations
    const baseNoise = fbm(x * 0.08 + 10, z * 0.08 + 3, 5, 9) - 0.5;
    const fineRoughness = (fbm(x * 0.6, z * 0.6, 3, 23) - 0.5) * 0.06;
    let h = baseNoise * e.relief * 5.2 * ramp + fineRoughness;

    // Realistic morphological impact craters (bowl depression + raised ejecta rim)
    for (const [cx, cz, r, depth, rimH] of MOON_CRATERS) {
      const dist = Math.hypot(x - cx, z - cz);
      const normDist = dist / r;

      if (normDist < 1.0) {
        // Parabolic inner crater bowl
        const bowl = -depth * (1.0 - normDist * normDist);
        h += bowl * ramp;
      } else if (normDist < 2.0) {
        // Raised crater rim lip with exponential outward falloff
        const rimProfile = Math.exp(-Math.pow((normDist - 1.0) / 0.32, 2.0));
        h += rimH * rimProfile * ramp;
      }
    }
    return h;
  }

  // Mars: Wind-rippled plains, sedimentary outcrop terraces, and shallow hollows
  const macroNoise = fbm(x * 0.075 + 14, z * 0.075 + 6, 5, 3) - 0.5;
  const ripples = Math.sin(x * 0.72 + z * 0.45) * 0.045 * Math.cos(x * 0.2 - z * 0.35);
  // Sedimentary stepped outcrop terrace effect
  const terrace = (Math.sin(macroNoise * 14) * 0.08) * THREE.MathUtils.smoothstep(d, 4, 12);
  const fineDust = (fbm(x * 0.55, z * 0.55, 3, 17) - 0.5) * 0.05;

  let h = (macroNoise * e.relief * 5.8 + terrace + ripples) * ramp + fineDust;

  // Shallow crater depressions (like Meridiani Planum hollows)
  for (const [cx, cz, r] of [
    [-8, -7, 4.8],
    [9, 8, 4.2],
    [6, -11, 5.5],
  ] as const) {
    const dist = Math.hypot(x - cx, z - cz) / r;
    if (dist < 1.4) {
      h += (dist < 1.0 ? -0.42 * (1.0 - dist * dist) : 0.18 * Math.sin(((dist - 1.0) / 0.4) * Math.PI)) * ramp;
    }
  }

  return h;
}

/** Generates high-detail procedural bump and micro-texture maps for planetary surfaces */
function makeDetailTexture(body: CelestialBody) {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);

  if (body === 'moon') {
    // Lunar regolith: micro-impact craters + jagged shattered mineral grain
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = fbm(x / 14, y / 14, 5, 11);
        const microNoise = (Math.random() - 0.5) * 0.3;
        // Occasional micro-crater pits
        const pitHash = (x * 123 + y * 456) % 197;
        const pit = pitHash < 3 ? -0.4 : 0;
        const val = Math.floor(THREE.MathUtils.clamp((v * 0.75 + 0.15 + microNoise + pit) * 255, 0, 255));

        const i = (y * size + x) * 4;
        img.data[i] = val;
        img.data[i + 1] = val;
        img.data[i + 2] = val;
        img.data[i + 3] = 255;
      }
    }
  } else {
    // Mars: Aeolian dust streaks + ferric sand grain
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const streak = Math.sin((x * 1.5 + y) / 8) * 0.12;
        const v = fbm(x / 16, y / 16, 4, 5);
        const grain = (Math.random() - 0.5) * 0.22;
        const val = Math.floor(THREE.MathUtils.clamp((v * 0.7 + streak + grain + 0.15) * 255, 0, 255));

        const i = (y * size + x) * 4;
        img.data[i] = val;
        img.data[i + 1] = val;
        img.data[i + 2] = val;
        img.data[i + 3] = 255;
      }
    }
  }

  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(32, 32);
  return t;
}

/** Procedural Earth texture for the Moon diorama sky (laser ranging origin) */
function makeEarthTexture() {
  const w = 512;
  const h = 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;

  // Deep ocean base
  const oceanGrad = g.createLinearGradient(0, 0, 0, h);
  oceanGrad.addColorStop(0, '#0c2446');
  oceanGrad.addColorStop(0.5, '#164885');
  oceanGrad.addColorStop(1, '#0e2b52');
  g.fillStyle = oceanGrad;
  g.fillRect(0, 0, w, h);

  const img = g.getImageData(0, 0, w, h);
  const data = img.data;

  // Continents, desert, forest, and swirling cloud layer
  for (let y = 0; y < h; y++) {
    const lat = (y / h - 0.5) * Math.PI;
    const cosLat = Math.cos(lat);
    for (let x = 0; x < w; x++) {
      const lon = (x / w) * Math.PI * 2;
      const nx = Math.cos(lon) * cosLat;
      const ny = Math.sin(lat);
      const nz = Math.sin(lon) * cosLat;

      const n = fbm(nx * 1.7 + 10, ny * 1.7 + 5, 5, 42);
      const isLand = n > 0.51;
      const i = (y * w + x) * 4;

      if (isLand) {
        const elev = (n - 0.51) / 0.49;
        const isPole = Math.abs(lat) > 1.15;
        if (isPole) {
          data[i] = 235;
          data[i + 1] = 245;
          data[i + 2] = 255;
        } else if (elev > 0.55) {
          data[i] = 140;
          data[i + 1] = 125;
          data[i + 2] = 105;
        } else if (Math.abs(lat) < 0.35 && elev < 0.28) {
          data[i] = 42;
          data[i + 1] = 88;
          data[i + 2] = 45;
        } else {
          data[i] = 135;
          data[i + 1] = 118;
          data[i + 2] = 80;
        }
      }

      // Swirling white clouds
      const cloudN = fbm(nx * 2.4 + nz * 0.8 + 8, ny * 2.4 - 3, 4, 91);
      if (cloudN > 0.55) {
        const dens = Math.min(1, (cloudN - 0.55) * 3.4);
        data[i] = Math.round(THREE.MathUtils.lerp(data[i], 255, dens * 0.92));
        data[i + 1] = Math.round(THREE.MathUtils.lerp(data[i + 1], 255, dens * 0.92));
        data[i + 2] = Math.round(THREE.MathUtils.lerp(data[i + 2], 255, dens * 0.92));
      }
    }
  }

  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function Terrain({ body, segments }: { body: CelestialBody; segments: number }) {
  const { geometry, bump } = useMemo(() => {
    const e = ENV[body];
    const geo = new THREE.PlaneGeometry(64, 64, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);

    const cBase = new THREE.Color(e.ground[0]);
    const cMid = new THREE.Color(e.ground[1]);
    const cBright = new THREE.Color(e.ground[2]);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z, body);
      pos.setY(i, h);

      if (body === 'moon') {
        // Moon: dark mare basalt vs bright crater ejecta lip rays
        const m = fbm(x * 0.22 + 40, z * 0.22, 4, 7);
        // Highlight raised crater rims and steeper slopes
        const rimHighlight = THREE.MathUtils.clamp((h - 0.15) * 1.5, 0, 1);
        tmp.copy(cBase)
          .lerp(cMid, THREE.MathUtils.smoothstep(m, 0.35, 0.7))
          .lerp(cBright, rimHighlight * 0.85);
      } else {
        // Mars: reddish iron oxide regolith, darker basalt sand in hollows, brighter sulfurous bedrock ledges
        const m = fbm(x * 0.22 + 35, z * 0.22, 3, 5);
        const hollowDarkening = THREE.MathUtils.clamp(-h * 1.4, 0, 0.7);
        const outcropBright = THREE.MathUtils.clamp((h - 0.25) * 1.2, 0, 0.5);
        tmp.copy(cMid)
          .lerp(cBase, hollowDarkening)
          .lerp(cBright, outcropBright)
          .lerp(cMid, THREE.MathUtils.smoothstep(m, 0.4, 0.8) * 0.3);
      }

      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return { geometry: geo, bump: makeDetailTexture(body) };
  }, [body, segments]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        vertexColors
        roughness={body === 'moon' ? 0.98 : 0.92}
        metalness={0.0}
        bumpMap={bump}
        bumpScale={body === 'moon' ? 1.6 : 0.95}
      />
    </mesh>
  );
}

/** Instanced rocks at three distinct scales + Martian Hematite Blueberries */
export function Rocks({ body, count }: { body: CelestialBody; count: number }) {
  const { boulderSets, blueberryMatrix } = useMemo(() => {
    const rnd = mulberry32(body === 'mars' ? 42 : 7);

    // Multi-scale boulders
    const scales = [
      { n: Math.round(count * 0.72), min: 0.025, max: 0.075, rMin: CLEAR_R * 0.55, rMax: 15 },
      { n: Math.round(count * 0.22), min: 0.08, max: 0.24, rMin: CLEAR_R + 0.3, rMax: 20 },
      { n: Math.max(5, Math.round(count * 0.06)), min: 0.32, max: 0.85, rMin: CLEAR_R + 2.6, rMax: 24 },
    ];

    const sets = scales.map((s) => {
      const mats: THREE.Matrix4[] = [];
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
        const y = terrainHeight(x, z, body) + sc * (body === 'moon' ? 0.2 : 0.25);
        // Angular scaling for shattered lunar breccia vs wind-shaped ventifacts
        const sx = sc * (body === 'moon' ? 0.7 + rnd() * 0.7 : 0.8 + rnd() * 0.5);
        const sy = sc * (body === 'moon' ? 0.45 + rnd() * 0.4 : 0.5 + rnd() * 0.4);
        const sz = sc;
        mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz)));
      }
      return mats;
    });

    // Mars specific: Hematite "Blueberries" scattered around the rover work area
    const blueberries: THREE.Matrix4[] = [];
    if (body === 'mars') {
      const bCount = 110;
      const q = new THREE.Quaternion();
      for (let i = 0; i < bCount; i++) {
        const a = rnd() * Math.PI * 2;
        const r = CLEAR_R * 0.65 + Math.sqrt(rnd()) * 6.5;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const sc = 0.02 + rnd() * 0.025; // small spherules ~2-4cm scale
        const y = terrainHeight(x, z, body) + sc * 0.6;
        blueberries.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sc, sc, sc)));
      }
    }

    return { boulderSets: sets, blueberryMatrix: blueberries };
  }, [body, count]);

  return (
    <>
      {boulderSets.map((mats, i) => (
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
          {/* Moon uses angular icosahedron for sharp impact breccia; Mars uses weathered dodecahedron */}
          {body === 'moon' ? <icosahedronGeometry args={[1, 0]} /> : <dodecahedronGeometry args={[1, i === 2 ? 1 : 0]} />}
          <meshStandardMaterial
            color={ENV[body].rock}
            roughness={body === 'moon' ? 0.98 : 0.92}
            metalness={0.0}
            flatShading
          />
        </instancedMesh>
      ))}

      {/* Mars Opportunity Hematite Spherules */}
      {body === 'mars' && blueberryMatrix.length > 0 && (
        <instancedMesh
          args={[undefined, undefined, blueberryMatrix.length]}
          castShadow
          receiveShadow
          ref={(im) => {
            if (!im) return;
            blueberryMatrix.forEach((mm, j) => im.setMatrixAt(j, mm));
            im.instanceMatrix.needsUpdate = true;
          }}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color={ENV.mars.blueberry} roughness={0.35} metalness={0.65} />
        </instancedMesh>
      )}
    </>
  );
}

/** Subtle lightweight drifting atmospheric dust particles on Mars */
function MarsAtmosphericDust({ count = 180 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);

  const [positions, offsets] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const offs = new Float32Array(count * 3);
    const rnd = mulberry32(101);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * 36;
      pos[i * 3 + 1] = 0.2 + rnd() * 4.5;
      pos[i * 3 + 2] = (rnd() - 0.5) * 36;

      offs[i * 3] = 0.4 + rnd() * 0.6; // drift speed
      offs[i * 3 + 1] = rnd() * Math.PI * 2; // phase
    }
    return [pos, offs];
  }, [count]);

  useFrame((_, dt) => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const p = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      p[idx] += offsets[idx] * dt * 0.8; // wind drift along X
      p[idx + 1] += Math.sin(offsets[idx + 1] + p[idx] * 0.5) * 0.08 * dt; // vertical bob
      if (p[idx] > 18) p[idx] = -18;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#e4a87a"
        size={0.06}
        transparent
        opacity={0.45}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export function Sky({ body }: { body: CelestialBody }) {
  const e = ENV[body];
  const earthTex = useMemo(() => (body === 'moon' ? makeEarthTexture() : null), [body]);

  if (body === 'moon') {
    return (
      <>
        <color attach="background" args={['#000000']} />
        <Stars radius={85} depth={25} count={2400} factor={2.8} saturation={0} fade speed={0} />

        {/* Earth in the lunar sky with continents, oceans, clouds, and atmospheric rim glow */}
        <group position={[-16, 11, -34]} rotation={[0.3, 0.8, -0.2]}>
          {/* Earth Body */}
          <mesh castShadow={false}>
            <sphereGeometry args={[1.65, 48, 32]} />
            <meshStandardMaterial
              map={earthTex ?? undefined}
              roughness={0.45}
              metalness={0.1}
            />
          </mesh>
          {/* Glowing Rayleigh atmospheric rim shell */}
          <mesh scale={1.05}>
            <sphereGeometry args={[1.65, 32, 24]} />
            <AtmosphereMaterial color="#6fa8ee" sunDir={e.sun} intensity={1.6} power={2.6} />
          </mesh>
        </group>
      </>
    );
  }

  return (
    <>
      <color attach="background" args={[e.skyHorizon]} />
      <fog attach="fog" args={[e.fog, 8, 44]} />
      <mesh scale={75}>
        <sphereGeometry args={[1, 32, 16]} />
        <SkyMaterial top={e.skyTop} horizon={e.skyHorizon} sunDir={e.sun} sunColor="#fff2dc" />
      </mesh>
      <MarsAtmosphericDust count={160} />
    </>
  );
}

export function Lights({ body, shadowSize }: { body: CelestialBody; shadowSize: number }) {
  const e = ENV[body];
  return (
    <>
      <hemisphereLight args={[e.hemi[0], e.hemi[1], e.hemi[2]]} />

      {/* Moon: Subtle cool blue Earthshine fill directed from Earth's position [-16, 11, -34] */}
      {body === 'moon' && (
        <directionalLight
          position={[16, -11, 34]}
          intensity={0.06}
          color="#8bb1dc"
        />
      )}

      {/* Primary Directional Sun Light */}
      <directionalLight
        castShadow
        position={e.sun}
        intensity={e.sunIntensity}
        color={e.sunColor}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-radius={body === 'mars' ? 5.5 : 1.0} // Soft atmospheric shadows on Mars, crisp vacuum shadows on Moon
        shadow-camera-left={-6.5}
        shadow-camera-right={6.5}
        shadow-camera-top={6.5}
        shadow-camera-bottom={-6.5}
        shadow-camera-near={0.5}
        shadow-camera-far={32}
      />
    </>
  );
}

/**
 * Image-based reflection environment for metals (gold foil, carbon fiber, solar cells)
 */
export function ReflectionEnv({ body }: { body: CelestialBody }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const rt = pmrem.fromScene(room, 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = body === 'moon' ? 0.24 : 0.42;
    room.dispose();
    pmrem.dispose();
    return () => {
      scene.environment = null;
      rt.dispose();
    };
  }, [gl, scene, body]);
  return null;
}
