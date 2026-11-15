/**
 * Signal Delay — R3F scene (Phase 2).
 * Reads shared engine terrain & store without mutating simulation state.
 * Keeps engine rules, heightmap, sand grid, and rock footprints identical.
 */
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as THREE from 'three';
import { fbm, mulberry32 } from '../../lib/noise';
import { registerRenderer } from '../../lib/debug';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { ENV } from './Environment';
import { contactPoints, RULES } from '../../games/roverDrive/engine';
import { heightAt, normalAt, sandAt } from '../../games/roverDrive/terrain';
import { poseAt, usePrediction, useRoverStore, type CamMode } from '../../games/roverDrive/store';
import {
  getExecProgress,
  isPlanOrbitDefault,
  MAX_PLAN_PITCH,
  MAX_PLAN_YAW,
  MIN_PLAN_PITCH,
  planOrbit,
  resetPlanOrbit,
  TIER_SPECS,
  useRoverUiStore,
  type TierSpec,
} from '../../games/roverDrive/ui/uiStore';
import type { PathPoint, Terrain } from '../../games/roverDrive/types';

const DRACO = '/draco/';
const MODEL = '/models/opportunity.glb';
const FOG_HEX = '#dba372';
const SKY_TOP_HEX = '#5b3728';
const SKY_HORIZON_HEX = '#dba372';
const MARS_DUST_HEX = '#c68553';

// Low warm sun (~28 deg elevation) for rich ridge/crater relief shadows
const SUN_DIR = new THREE.Vector3(-0.78, 0.47, 0.41).normalize();

/** Live rover pose shared across rover, cameras, lights, dust, and wheel tracks (zero allocations). */
const live = {
  pos: new THREE.Vector3(),
  quat: new THREE.Quaternion(),
  heading: 0,
  moving: false,
  speed: 0,
  ready: false,
  nightness: 0,
};

const SUN_NIGHT_DIR = new THREE.Vector3(-0.62, 0.14, 0.52).normalize();
const _sunVec = new THREE.Vector3();
const _cDayTop = new THREE.Color(SKY_TOP_HEX);
const _cDuskTop = new THREE.Color('#38202d');
const _cNightTop = new THREE.Color('#0c1224');
const _cDayHor = new THREE.Color(SKY_HORIZON_HEX);
const _cDuskHor = new THREE.Color('#c86b3c');
const _cNightHor = new THREE.Color('#24171f');
const _cDaySun = new THREE.Color('#ffd9ad');
const _cDuskSun = new THREE.Color('#ff8e4e');
const _cNightSun = new THREE.Color('#7a92c6');
const _cDayHemiSky = new THREE.Color('#9ec0e6');
const _cNightHemiSky = new THREE.Color('#3d4f7c');
const _cDayHemiGnd = new THREE.Color('#3b180b');
const _cNightHemiGnd = new THREE.Color('#130906');
const _cTmpA = new THREE.Color();
const _cTmpB = new THREE.Color();

function sampleNightness(reduced: boolean): number {
  const st = useRoverStore.getState();
  if (st.phase === 'uplink') {
    const u = getExecProgress(st);
    return reduced ? 0.85 : THREE.MathUtils.smoothstep(u, 0.05, 0.92);
  }
  if (st.phase === 'executing') {
    const u = getExecProgress(st);
    return reduced ? 0 : 1 - THREE.MathUtils.smoothstep(u, 0.08, 0.65);
  }
  return 0;
}

// Reusable scratch vectors/matrices (never allocate in useFrame)
const _f = new THREE.Vector3();
const _s = new THREE.Vector3();
const _u = new THREE.Vector3();
const _x = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _ct = new THREE.Vector3();
const _look = new THREE.Vector3();
const _proj = new THREE.Vector3();
const _beamStart = new THREE.Vector3();
const _beamEnd = new THREE.Vector3();
const _beamDir = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------
// Procedural Textures (grain albedo, detail normal, radial soft disc)

function makeGrainTexture() {
  const n = 256;
  const data = new Uint8Array(n * n * 4);
  const rnd = mulberry32(9);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      // Tileable-ish seamless domain wrap approximation + fine grit
      const nx = Math.cos((x / n) * Math.PI * 2) * 1.8;
      const ny = Math.sin((x / n) * Math.PI * 2) * 1.8;
      const nz = Math.cos((y / n) * Math.PI * 2) * 1.8;
      const nw = Math.sin((y / n) * Math.PI * 2) * 1.8;
      const f = fbm(nx + nz * 0.4 + 4, ny + nw * 0.4 + 4, 3, 19);
      const streak = Math.sin((x * 2 + y) * 0.098) * 0.05;
      const v = Math.min(255, Math.max(196, Math.round(212 + 43 * (0.62 * f + 0.38 * rnd() + streak))));
      const i = (y * n + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, n, n);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(40, 40);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function makeDetailNormalTexture() {
  const n = 256;
  const h = new Float32Array(n * n);
  const rnd = mulberry32(43);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const ripple = Math.sin(((x + y * 0.75) / n) * Math.PI * 12) * 0.25;
      const grit = (rnd() - 0.5) * 0.35;
      const macro = fbm((x / n) * 8, (y / n) * 8, 3, 31) * 0.55;
      h[y * n + x] = ripple + grit + macro;
    }
  }
  const data = new Uint8Array(n * n * 4);
  const strength = 2.1;
  for (let y = 0; y < n; y++) {
    const ym = (y - 1 + n) % n;
    const yp = (y + 1) % n;
    for (let x = 0; x < n; x++) {
      const xm = (x - 1 + n) % n;
      const xp = (x + 1) % n;
      const dx = (h[y * n + xp] - h[y * n + xm]) * strength;
      const dy = (h[yp * n + x] - h[ym * n + x]) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * n + x) * 4;
      data[i] = Math.round(((-dx / len) * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, n, n);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(44, 44);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function makeSoftDiscTexture(softEdge = true) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, softEdge ? 2 : 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, softEdge ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.7)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Sky, Lighting & Seamless Horizon Skirt

function SkyDome({ reduced }: { reduced: boolean }) {
  const { scene } = useThree();
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(SKY_TOP_HEX) },
        uHorizon: { value: new THREE.Color(SKY_HORIZON_HEX) },
        uSunDir: { value: SUN_DIR.clone() },
        uSunColor: { value: new THREE.Color('#fff2d6') },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        varying vec3 vWorldDir;
        void main() {
          vec3 d = normalize(vWorldDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(uHorizon, uTop, pow(h, 0.58));
          float sunDot = max(0.0, dot(d, normalize(uSunDir)));
          // Warm Mie atmospheric glow + soft Martian solar disc
          col += uSunColor * (pow(sunDot, 12.0) * 0.24 + pow(sunDot, 160.0) * 0.55 + smoothstep(0.9982, 0.9994, sunDot) * 1.15);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
  }, []);

  useFrame(() => {
    const n = sampleNightness(reduced);
    live.nightness = n;

    // 3-stop morning -> dusk -> night sky/fog lerp
    if (n <= 0.5) {
      const k = n * 2;
      _cTmpA.copy(_cDayTop).lerp(_cDuskTop, k);
      _cTmpB.copy(_cDayHor).lerp(_cDuskHor, k);
      material.uniforms.uSunColor.value.copy(_cDaySun).lerp(_cDuskSun, k);
    } else {
      const k = (n - 0.5) * 2;
      _cTmpA.copy(_cDuskTop).lerp(_cNightTop, k);
      _cTmpB.copy(_cDuskHor).lerp(_cNightHor, k);
      material.uniforms.uSunColor.value.copy(_cDuskSun).lerp(_cNightSun, k);
    }

    material.uniforms.uTop.value.copy(_cTmpA);
    material.uniforms.uHorizon.value.copy(_cTmpB);
    material.uniforms.uSunDir.value.copy(SUN_DIR).lerp(SUN_NIGHT_DIR, n).normalize();

    if (scene.background instanceof THREE.Color) {
      scene.background.copy(_cTmpB);
    }
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.copy(_cTmpB);
    }
  });

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh material={material} renderOrder={-2}>
      <sphereGeometry args={[380, 32, 18]} />
    </mesh>
  );
}

function NightStars() {
  const matRef = useRef<THREE.PointsMaterial>(null);
  const ptsRef = useRef<THREE.Points>(null);

  const geo = useMemo(() => {
    const n = 160;
    const pos = new Float32Array(n * 3);
    const rnd = mulberry32(2004);
    for (let i = 0; i < n; i++) {
      const theta = rnd() * Math.PI * 2;
      const phi = Math.acos(0.18 + rnd() * 0.82); // upper sky hemisphere only
      const r = 345;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  useEffect(() => () => geo.dispose(), [geo]);

  useFrame(() => {
    const op = THREE.MathUtils.clamp((live.nightness - 0.35) / 0.65, 0, 1) * 0.72;
    if (ptsRef.current) ptsRef.current.visible = op > 0.02;
    if (matRef.current) matRef.current.opacity = op;
  });

  return (
    <points ref={ptsRef} geometry={geo} visible={false} renderOrder={-1} frustumCulled={false}>
      <pointsMaterial ref={matRef} color="#dce8ff" size={1.6} sizeAttenuation={false} transparent opacity={0} depthWrite={false} fog={false} />
    </points>
  );
}

function HorizonSkirt({ t }: { t: Terrain }) {
  const geometry = useMemo(() => {
    const angSegs = 144;
    const radSegs = 20;
    const half = t.size / 2;
    const outerR = 340;
    const count = (radSegs + 1) * (angSegs + 1);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const idx: number[] = [];

    const cNear = new THREE.Color('#8e4021');
    const cMid = new THREE.Color('#ad5a32');
    const cRidge = new THREE.Color('#c78254');
    const tmp = new THREE.Color();

    for (let r = 0; r <= radSegs; r++) {
      const u = r / radSegs;
      // Ease out radially so vertex density is higher near terrain boundary
      const radialT = u * u * (0.4 + 0.6 * u);
      for (let a = 0; a <= angSegs; a++) {
        const theta = (a / angSegs) * Math.PI * 2;
        const ca = Math.cos(theta);
        const sa = Math.sin(theta);
        const sqScale = half / Math.max(Math.abs(ca), Math.abs(sa));
        const bx = ca * sqScale;
        const bz = sa * sqScale;
        const ox = ca * outerR;
        const oz = sa * outerR;

        const x = bx + (ox - bx) * radialT;
        const z = bz + (oz - bz) * radialT;

        // Clamp within playable edge to match border height exactly with zero seam
        const edgeH = heightAt(t, bx, bz) - 0.04;
        const farNoise = (fbm(x * 0.011 + 20, z * 0.011 + 20, 4, t.seed + 13) - 0.45) * 9;
        // 360-degree distant caldera/mesa ridgeline silhouette between 110 m and 270 m
        const dist = Math.hypot(x, z);
        const ridgeBand = Math.exp(-Math.pow((dist - 195) / 68, 2));
        const ridgeNoise = Math.max(0, fbm(ca * 3.1 + 5, sa * 3.1 + 5, 5, t.seed + 91) - 0.34);
        const ridgeH = ridgeBand * ridgeNoise * 27;
        const y = THREE.MathUtils.lerp(edgeH, farNoise + ridgeH - 0.4, THREE.MathUtils.smoothstep(u, 0, 0.35));

        const vi = r * (angSegs + 1) + a;
        pos[vi * 3] = x;
        pos[vi * 3 + 1] = y;
        pos[vi * 3 + 2] = z;

        tmp.copy(cNear).lerp(cMid, Math.min(1, u * 1.4)).lerp(cRidge, THREE.MathUtils.clamp((ridgeH / 16) + u * 0.45, 0, 1));
        col[vi * 3] = tmp.r;
        col[vi * 3 + 1] = tmp.g;
        col[vi * 3 + 2] = tmp.b;
      }
    }

    for (let r = 0; r < radSegs; r++) {
      for (let a = 0; a < angSegs; a++) {
        const i0 = r * (angSegs + 1) + a;
        const i1 = i0 + 1;
        const i2 = i0 + (angSegs + 1);
        const i3 = i2 + 1;
        idx.push(i0, i1, i2, i1, i3, i2);
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [t]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={0.98} metalness={0} />
    </mesh>
  );
}

function ReflectionEnv() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const rt = pmrem.fromScene(room, 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.5;
    room.dispose();
    pmrem.dispose();
    return () => {
      scene.environment = null;
      rt.dispose();
    };
  }, [gl, scene]);
  return null;
}

function SunAndLights({ shadowSize }: { shadowSize: number }) {
  const { scene } = useThree();
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const rimPos = useMemo(() => new THREE.Vector3(-SUN_DIR.x, 0.65, -SUN_DIR.z).multiplyScalar(40), []);

  useFrame(() => {
    const n = live.nightness;
    _sunVec.copy(SUN_DIR).lerp(SUN_NIGHT_DIR, n).normalize();

    const l = sunRef.current;
    if (l) {
      l.position.copy(live.pos).addScaledVector(_sunVec, 36);
      l.target.position.copy(live.pos);
      l.target.updateMatrixWorld();
      l.intensity = THREE.MathUtils.lerp(3.1, 0.44, n);
      if (n <= 0.5) {
        l.color.copy(_cDaySun).lerp(_cDuskSun, n * 2);
      } else {
        l.color.copy(_cDuskSun).lerp(_cNightSun, (n - 0.5) * 2);
      }
    }

    const h = hemiRef.current;
    if (h) {
      h.intensity = THREE.MathUtils.lerp(0.88, 0.34, n);
      h.color.copy(_cDayHemiSky).lerp(_cNightHemiSky, n);
      h.groundColor.copy(_cDayHemiGnd).lerp(_cNightHemiGnd, n);
    }

    if (rimRef.current) {
      rimRef.current.intensity = THREE.MathUtils.lerp(0.28, 0.16, n);
    }

    scene.environmentIntensity = THREE.MathUtils.lerp(0.5, 0.22, n);
  });

  const shadows = shadowSize > 0;
  return (
    <>
      <hemisphereLight ref={hemiRef} args={['#9ec0e6', '#3b180b', 0.88]} />
      <directionalLight ref={rimRef} position={rimPos} intensity={0.28} color="#82a8d8" />
      <directionalLight
        key={shadowSize}
        ref={sunRef}
        castShadow={shadows}
        intensity={3.1}
        color="#ffd9ad"
        shadow-mapSize={[shadowSize || 512, shadowSize || 512]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-camera-near={1}
        shadow-camera-far={90}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Terrain, Scale Reference & Hazard Lens

function TerrainMesh({ t, spec }: { t: Terrain; spec: TierSpec }) {
  const hazardLens = useRoverUiStore((s) => s.hazardLens);

  const { geometry, baseColors, hazardColors } = useMemo(() => {
    const g = new THREE.PlaneGeometry(t.size, t.size, t.res - 1, t.res - 1);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const nVerts = pos.count;
    const base = new Float32Array(nVerts * 3);
    const hazard = new Float32Array(nVerts * 3);

    const cHollow = new THREE.Color('#421a0f');
    const cMid = new THREE.Color('#a44b24');
    const cHigh = new THREE.Color('#d17341');
    const cBedrock = new THREE.Color('#281109');
    const cRim = new THREE.Color('#e49f66');
    const cFloor = new THREE.Color('#230c05');
    const cSandCrest = new THREE.Color('#f2c38c');
    const cSandTrough = new THREE.Color('#c9874e');
    const cSandEdge = new THREE.Color('#ffe8bf');
    const cOutcropApron = new THREE.Color('#e2cfad');

    const cWarn = new THREE.Color('#ffab1a');
    const cStop = new THREE.Color('#ff351c');
    const cSandHatchA = new THREE.Color('#ffd35c');
    const cSandHatchB = new THREE.Color('#6a2f10');
    const tmp = new THREE.Color();
    const hTmp = new THREE.Color();

    const rippleAngleCos = Math.cos(0.75);
    const rippleAngleSin = Math.sin(0.75);

    for (let i = 0; i < nVerts; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = heightAt(t, x, z);
      pos.setY(i, h);

      const [, ny] = normalAt(t, x, z);
      const slopeDeg = (Math.acos(Math.min(1, Math.max(-1, ny))) * 180) / Math.PI;
      const s = sandAt(t, x, z);

      // Base Martian regolith variation
      const f1 = fbm(x * 0.07 + 8, z * 0.07 + 8, 3, 21);
      const f2 = fbm(x * 0.022, z * 0.022, 2, 5);
      tmp.copy(cHollow).lerp(cMid, 0.38 + 0.52 * f1).lerp(cHigh, Math.max(0, (f2 - 0.42) * 1.45));

      // Steep bedrock darkening
      const bedrockW = THREE.MathUtils.smoothstep(slopeDeg, 13, 30);
      if (bedrockW > 0) tmp.lerp(cBedrock, bedrockW * 0.72);

      // Crater bowl & bright ejecta rim
      if (t.crater) {
        const cr = Math.hypot(x - t.crater.x, z - t.crater.z) / t.crater.radius;
        if (cr < 1.0) {
          const depthW = (1 - cr * cr) * 0.72;
          const strata = Math.sin(cr * 18) * 0.06;
          tmp.lerp(cFloor, Math.min(1, Math.max(0, depthW + strata)));
        } else if (cr < 1.38) {
          const rimW = Math.exp(-Math.pow((cr - 1.02) / 0.16, 2));
          tmp.lerp(cRim, rimW * 0.75);
        }
      }

      // Unmistakable soft sand traps + wind-ripple bands + sharp 50% slip edge contour
      if (s > 0.04) {
        const u = x * rippleAngleCos - z * rippleAngleSin;
        const rippleWave = 0.5 + 0.5 * Math.sin((u / 2.6) * Math.PI * 2);
        hTmp.copy(cSandTrough).lerp(cSandCrest, rippleWave);
        const sandBlend = s >= RULES.softSandMask ? 0.88 + 0.12 * s : s * 0.9;
        tmp.lerp(hTmp, sandBlend);

        // Crisp pale contour along the 50% slip boundary
        const rimGlow = Math.exp(-Math.pow((s - RULES.softSandMask) / 0.055, 2));
        if (rimGlow > 0.05) tmp.lerp(cSandEdge, rimGlow * 0.65);
      }

      // Sulfate apron around outcrop
      const dt = Math.hypot(x - t.target.x, z - t.target.z);
      if (dt < t.target.radius + 1.8) {
        tmp.lerp(cOutcropApron, Math.min(1, (t.target.radius + 1.8 - dt) / 1.8) * 0.78);
      }

      base[i * 3] = tmp.r;
      base[i * 3 + 1] = tmp.g;
      base[i * 3 + 2] = tmp.b;

      // Hazard lens buffer: desaturated base + red/amber slope + hatched soft-sand zones
      const luma = tmp.r * 0.299 + tmp.g * 0.587 + tmp.b * 0.114;
      hTmp.setRGB(
        THREE.MathUtils.lerp(tmp.r, luma, 0.5) * 0.64,
        THREE.MathUtils.lerp(tmp.g, luma, 0.5) * 0.64,
        THREE.MathUtils.lerp(tmp.b, luma, 0.5) * 0.64,
      );
      if (s >= RULES.softSandMask) {
        const hatch = (Math.floor((x + z) * 1.45) & 1) === 0;
        hTmp.lerp(hatch ? cSandHatchA : cSandHatchB, 0.86);
      }
      if (slopeDeg > RULES.tiltStopDeg) {
        hTmp.lerp(cStop, 0.92);
      } else if (slopeDeg > RULES.tiltWarnDeg) {
        const tWarn = THREE.MathUtils.clamp((slopeDeg - RULES.tiltWarnDeg) / (RULES.tiltStopDeg - RULES.tiltWarnDeg), 0.45, 1);
        hTmp.lerp(cWarn, tWarn * 0.88);
      }

      hazard[i * 3] = hTmp.r;
      hazard[i * 3 + 1] = hTmp.g;
      hazard[i * 3 + 2] = hTmp.b;
    }

    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(base), 3));
    g.computeVertexNormals();
    return { geometry: g, baseColors: base, hazardColors: hazard };
  }, [t]);

  const { grainMap, normalMap } = useMemo(() => {
    if (!spec.detailTex) return { grainMap: null, normalMap: null };
    return { grainMap: makeGrainTexture(), normalMap: makeDetailNormalTexture() };
  }, [spec.detailTex]);

  useEffect(() => {
    const colAttr = geometry.getAttribute('color') as THREE.BufferAttribute;
    const arr = colAttr.array as Float32Array;
    arr.set(hazardLens ? hazardColors : baseColors);
    colAttr.needsUpdate = true;
  }, [geometry, hazardLens, baseColors, hazardColors]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(
    () => () => {
      grainMap?.dispose();
      normalMap?.dispose();
    },
    [grainMap, normalMap],
  );

  const shadows = spec.shadowSize > 0;
  return (
    <mesh geometry={geometry} receiveShadow={shadows}>
      <meshStandardMaterial
        key={spec.detailTex ? 'detail' : 'flat'}
        vertexColors
        map={grainMap ?? undefined}
        normalMap={normalMap ?? undefined}
        normalScale={spec.detailTex ? new THREE.Vector2(0.42, 0.42) : undefined}
        roughness={0.94}
        metalness={0}
      />
    </mesh>
  );
}

/** Ground landing pad & 1 m scale ticks at start + target perimeter reference marks. */
function ScalePads({ t }: { t: Terrain }) {
  const startY = heightAt(t, t.start.x, t.start.z) + 0.03;
  const targetY = heightAt(t, t.target.x, t.target.z) + 0.04;
  return (
    <group>
      {/* Start lander reference ring (radius = 1.0 m -> 2 m diameter scale) */}
      <group position={[t.start.x, startY, t.start.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.96, 1.04, 32]} />
          <meshBasicMaterial color="#ffe4bd" transparent opacity={0.42} depthWrite={false} />
        </mesh>
        {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((ang, i) => (
          <mesh key={i} position={[Math.cos(ang) * 1.15, 0, Math.sin(ang) * 1.15]} rotation={[-Math.PI / 2, 0, -ang]}>
            <planeGeometry args={[0.24, 0.06]} />
            <meshBasicMaterial color="#ffe4bd" transparent opacity={0.45} depthWrite={false} />
          </mesh>
        ))}
      </group>

      {/* Outcrop perimeter cardinal ticks */}
      <group position={[t.target.x, targetY, t.target.z]}>
        {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((ang, i) => (
          <mesh
            key={i}
            position={[Math.cos(ang) * (RULES.scanRangeM + 0.3), 0, Math.sin(ang) * (RULES.scanRangeM + 0.3)]}
            rotation={[-Math.PI / 2, 0, -ang]}
          >
            <planeGeometry args={[0.32, 0.08]} />
            <meshBasicMaterial color="#9fe2ff" transparent opacity={0.65} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rocks (4 sculpted archetypes) + Decorative Pebbles

function buildRockArchetype(kind: 0 | 1 | 2 | 3): THREE.BufferGeometry {
  let geo: THREE.BufferGeometry;
  if (kind === 0) {
    geo = new THREE.DodecahedronGeometry(1, 0);
  } else if (kind === 1) {
    geo = new THREE.CylinderGeometry(0.82, 1.0, 0.52, 7, 1);
  } else if (kind === 2) {
    geo = new THREE.IcosahedronGeometry(1, 1);
  } else {
    // Cluster of two fused boulders in one BufferGeometry
    const gA = new THREE.DodecahedronGeometry(0.76, 0).translate(-0.24, 0.06, -0.1);
    const gB = new THREE.DodecahedronGeometry(0.62, 0).translate(0.32, -0.05, 0.2);
    const aPos = gA.getAttribute('position') as THREE.BufferAttribute;
    const bPos = gB.getAttribute('position') as THREE.BufferAttribute;
    const mergedPos = new Float32Array((aPos.count + bPos.count) * 3);
    mergedPos.set(aPos.array as Float32Array, 0);
    mergedPos.set(bPos.array as Float32Array, aPos.count * 3);
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
    if (gA.index && gB.index) {
      const idxA = gA.index.array;
      const idxB = gB.index.array;
      const idx = new Uint16Array(idxA.length + idxB.length);
      idx.set(idxA, 0);
      for (let i = 0; i < idxB.length; i++) idx[idxA.length + i] = idxB[i] + aPos.count;
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    gA.dispose();
    gB.dispose();
  }

  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const rnd = mulberry32(kind * 97 + 13);
  for (let i = 0; i < pos.count; i++) {
    let px = pos.getX(i);
    let py = pos.getY(i);
    let pz = pos.getZ(i);
    // Keep horizontal radius <= 1.02 so visual rock matches collision radius closely
    const n = fbm(px * 1.4 + kind * 5, pz * 1.4 + py, 2, kind + 3);
    const radialScale = kind === 1 ? 0.92 + n * 0.14 : 0.85 + n * 0.22;
    px *= radialScale;
    pz *= radialScale;
    py *= 0.82 + rnd() * 0.18;
    pos.setXYZ(i, px, py, pz);

    // Baked underside ambient occlusion gradient (bottom dark 0.42 -> sunlit top 1.04)
    const ao = THREE.MathUtils.clamp(0.45 + (py + 0.9) * 0.34, 0.4, 1.05);
    col[i * 3] = ao;
    col[i * 3 + 1] = ao * 0.96;
    col[i * 3 + 2] = ao * 0.92;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

function RockField({ t, spec }: { t: Terrain; spec: TierSpec }) {
  const shadows = spec.shadowSize > 0;
  const geos = useMemo(() => [buildRockArchetype(0), buildRockArchetype(1), buildRockArchetype(2), buildRockArchetype(3)], []);
  const pebbleGeo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);

  useEffect(
    () => () => {
      geos.forEach((g) => g.dispose());
      pebbleGeo.dispose();
    },
    [geos, pebbleGeo],
  );

  const rockBuckets = useMemo(() => {
    const capped = t.rocks.slice(0, spec.rocks);
    const buckets: { idx: number; radius: number; x: number; z: number }[][] = [[], [], [], []];
    capped.forEach((r, i) => buckets[i % 4].push({ idx: i, ...r }));
    return buckets;
  }, [t.rocks, spec.rocks]);

  const ref0 = useRef<THREE.InstancedMesh>(null);
  const ref1 = useRef<THREE.InstancedMesh>(null);
  const ref2 = useRef<THREE.InstancedMesh>(null);
  const ref3 = useRef<THREE.InstancedMesh>(null);
  const pebRef = useRef<THREE.InstancedMesh>(null);
  const refs = [ref0, ref1, ref2, ref3];

  useEffect(() => {
    const rnd = mulberry32(t.seed + 77);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const col = new THREE.Color();

    rockBuckets.forEach((bucket, bIdx) => {
      const mesh = refs[bIdx].current;
      if (!mesh) return;
      bucket.forEach((r, i) => {
        e.set((rnd() - 0.5) * 0.35, rnd() * Math.PI * 2, (rnd() - 0.5) * 0.35);
        q.setFromEuler(e);
        // Horizontal scale tracks r.radius closely to match hitsRock collision footprint
        const sx = r.radius * (0.94 + rnd() * 0.1);
        const sz = r.radius * (0.94 + rnd() * 0.1);
        const sy = r.radius * (bIdx === 1 ? 0.52 + rnd() * 0.25 : 0.6 + rnd() * 0.32);
        s.set(sx, sy, sz);
        // Sink base slightly into regolith so rocks never float on slopes
        p.set(r.x, heightAt(t, r.x, r.z) + sy * 0.22, r.z);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
        col.set(ENV.mars.rock).multiplyScalar(0.76 + rnd() * 0.44);
        mesh.setColorAt(i, col);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    });
  }, [t, rockBuckets]);

  useEffect(() => {
    const mesh = pebRef.current;
    if (!mesh || spec.pebbles <= 0 || t.rocks.length === 0) return;
    const rnd = mulberry32(t.seed + 313);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const col = new THREE.Color();

    for (let i = 0; i < spec.pebbles; i++) {
      let x = 0;
      let z = 0;
      if (i < spec.pebbles * 0.65) {
        const host = t.rocks[i % t.rocks.length];
        const ang = rnd() * Math.PI * 2;
        const dist = host.radius + 0.15 + rnd() * 1.4;
        x = host.x + Math.cos(ang) * dist;
        z = host.z + Math.sin(ang) * dist;
      } else {
        const half = t.size / 2 - 2;
        x = (rnd() * 2 - 1) * half;
        z = (rnd() * 2 - 1) * half;
      }
      const sc = 0.04 + rnd() * 0.08;
      e.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
      q.setFromEuler(e);
      s.set(sc * (0.8 + rnd() * 0.4), sc * 0.55, sc * (0.8 + rnd() * 0.4));
      p.set(x, heightAt(t, x, z) + s.y * 0.25, z);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      col.set('#5e2d18').multiplyScalar(0.8 + rnd() * 0.45);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [t, spec.pebbles]);

  return (
    <group>
      {rockBuckets.map(
        (bucket, idx) =>
          bucket.length > 0 && (
            <instancedMesh
              key={`${idx}-${bucket.length}`}
              ref={refs[idx]}
              args={[geos[idx], undefined, bucket.length]}
              castShadow={shadows}
              receiveShadow={shadows}
            >
              <meshStandardMaterial vertexColors flatShading roughness={0.9} metalness={0.04} />
            </instancedMesh>
          ),
      )}

      {spec.pebbles > 0 && (
        <instancedMesh
          key={`pebbles-${spec.pebbles}`}
          ref={pebRef}
          args={[pebbleGeo, undefined, spec.pebbles]}
          castShadow={false}
          receiveShadow={shadows}
        >
          <meshStandardMaterial flatShading roughness={0.94} metalness={0.02} />
        </instancedMesh>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Outcrop, Hematite Blueberries (Instanced), Light Beacon & Off-screen Cue

function Outcrop({ t, reduced }: { t: Terrain; reduced: boolean }) {
  const size = useThree((s) => s.size);
  const ringRef = useRef<THREE.Mesh>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const diamondRef = useRef<THREE.Mesh>(null);
  const berriesRef = useRef<THREE.InstancedMesh>(null);
  const cueLastUpdate = useRef(0);
  const prevCue = useRef({ visible: false, xPct: 50, yPct: 24, angleDeg: 0, distM: 0 });

  const y = heightAt(t, t.target.x, t.target.z);

  const berryOffsets = useMemo(() => {
    const rnd = mulberry32(5);
    return Array.from({ length: 40 }, () => {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * (t.target.radius - 0.55);
      return [t.target.x + Math.cos(a) * r, t.target.z + Math.sin(a) * r, 0.042 + rnd() * 0.025] as const;
    });
  }, [t]);

  useEffect(() => {
    const mesh = berriesRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    berryOffsets.forEach(([x, z, rad], i) => {
      p.set(x, y + 0.25, z);
      s.setScalar(rad);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [berryOffsets, y]);

  useFrame(({ clock, camera }) => {
    const el = clock.elapsedTime;
    if (ringRef.current) {
      const k = reduced ? 1 : 1 + 0.09 * Math.sin(el * 2.4);
      ringRef.current.scale.setScalar(k);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = reduced ? 0.65 : 0.45 + 0.28 * Math.sin(el * 2.4 + 1);
    }

    // Long-range visibility beacon: stronger from far away, gentle near target
    const camDist = camera.position.distanceTo(_beamEnd.set(t.target.x, y + 1.5, t.target.z));
    if (beamRef.current) {
      const distAlpha = THREE.MathUtils.clamp((camDist - 7) / 34, 0.08, 0.34);
      const pulse = reduced ? 1 : 0.88 + 0.12 * Math.sin(el * 2.1);
      (beamRef.current.material as THREE.MeshBasicMaterial).opacity = distAlpha * pulse;
    }
    if (diamondRef.current) {
      if (!reduced) {
        diamondRef.current.rotation.y = el * 1.1;
        diamondRef.current.position.y = y + 5.6 + Math.sin(el * 2.2) * 0.32;
      }
      const dAlpha = THREE.MathUtils.clamp((camDist - 5) / 22, 0.25, 0.92);
      (diamondRef.current.material as THREE.MeshBasicMaterial).opacity = dAlpha;
    }

    // Off-screen directional cue projection (throttled ~12 Hz, zero React spam)
    const nowMs = performance.now();
    if (nowMs - cueLastUpdate.current < 80) return;
    cueLastUpdate.current = nowMs;

    const st = useRoverStore.getState();
    const ui = useRoverUiStore.getState();
    if (st.phase === 'briefing' || st.view !== '3d' || size.width <= 0 || size.height <= 0) {
      if (prevCue.current.visible) {
        prevCue.current.visible = false;
        ui.setOutcropCue({ visible: false, xPct: 50, yPct: 24, angleDeg: 0, distM: 0 });
      }
      return;
    }

    _proj.set(t.target.x, y + 2.2, t.target.z).project(camera);
    const behind = _proj.z > 1;
    let ndcX = behind ? -_proj.x : _proj.x;
    let ndcY = behind ? -_proj.y : _proj.y;

    const inside = !behind && Math.abs(ndcX) <= 0.84 && Math.abs(ndcY) <= 0.74;
    const distM = Math.hypot(t.target.x - live.pos.x, t.target.z - live.pos.z);

    if (inside) {
      if (prevCue.current.visible) {
        prevCue.current.visible = false;
        ui.setOutcropCue({ visible: false, xPct: 50, yPct: 24, angleDeg: 0, distM });
      }
      return;
    }

    // Clamp to safe viewport margin between HUD top bar and bottom command dock
    let len = Math.max(1e-4, Math.hypot(ndcX, ndcY));
    let ux = ndcX / len;
    let uy = ndcY / len;
    // When target is behind camera, push arrow to left/right edge so it never sits over the rover
    if (behind && Math.abs(ux) < 0.52) {
      ux = ux >= 0 ? 0.65 : -0.65;
      len = Math.hypot(ux, uy);
      ux /= len;
      uy /= len;
    }
    const tx = Math.abs(ux) > 1e-4 ? 0.82 / Math.abs(ux) : 99;
    const ty = Math.abs(uy) > 1e-4 ? 0.64 / Math.abs(uy) : 99;
    const scale = Math.min(tx, ty);
    ndcX = ux * scale;
    ndcY = uy * scale;

    const portrait = size.width < size.height;
    const xPct = Math.round(THREE.MathUtils.clamp((ndcX * 0.5 + 0.5) * 100, portrait ? 22 : 12, portrait ? 78 : 88));
    const yPct = Math.round(THREE.MathUtils.clamp((-ndcY * 0.5 + 0.5) * 100, portrait ? 19 : 13, portrait ? 44 : 66));
    const angleDeg = Math.round((Math.atan2(ux, uy) * 180) / Math.PI);
    const roundedDist = Math.round(distM);

    const prev = prevCue.current;
    if (!prev.visible || prev.xPct !== xPct || prev.yPct !== yPct || Math.abs(prev.angleDeg - angleDeg) >= 3 || prev.distM !== roundedDist) {
      const next = { visible: true, xPct, yPct, angleDeg, distM: roundedDist };
      prevCue.current = next;
      ui.setOutcropCue(next);
    }
  });

  return (
    <group>
      {/* Stepped sedimentary sulfate outcrop slab */}
      <mesh position={[t.target.x, y + 0.04, t.target.z]} receiveShadow>
        <cylinderGeometry args={[t.target.radius - 0.1, t.target.radius + 0.25, 0.2, 10]} />
        <meshStandardMaterial color="#cbb389" roughness={0.88} flatShading />
      </mesh>
      <mesh position={[t.target.x + 0.15, y + 0.12, t.target.z - 0.1]} receiveShadow>
        <cylinderGeometry args={[t.target.radius * 0.72, t.target.radius * 0.82, 0.18, 9]} />
        <meshStandardMaterial color="#dfd0b0" roughness={0.84} flatShading />
      </mesh>
      <mesh position={[t.target.x - 0.12, y + 0.18, t.target.z + 0.08]} receiveShadow>
        <cylinderGeometry args={[t.target.radius * 0.44, t.target.radius * 0.52, 0.14, 8]} />
        <meshStandardMaterial color="#efe3c8" roughness={0.82} flatShading />
      </mesh>

      {/* Single InstancedMesh for all 40 metallic hematite blueberries (1 draw call) */}
      <instancedMesh ref={berriesRef} args={[undefined, undefined, berryOffsets.length]}>
        <sphereGeometry args={[1, 7, 5]} />
        <meshStandardMaterial color="#3c3f52" roughness={0.28} metalness={0.76} />
      </instancedMesh>

      {/* 3 m SCAN range perimeter ring */}
      <mesh ref={ringRef} position={[t.target.x, y + 0.28, t.target.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[RULES.scanRangeM - 0.12, RULES.scanRangeM + 0.08, 64]} />
        <meshBasicMaterial color="#9fe2ff" transparent opacity={0.6} depthWrite={false} fog={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Tall translucent light-column beacon visible across 80+ m */}
      <mesh ref={beamRef} position={[t.target.x, y + 11.4, t.target.z]} renderOrder={3}>
        <cylinderGeometry args={[0.16, 0.62, 22, 14, 1, true]} />
        <meshBasicMaterial
          color="#9fe2ff"
          transparent
          opacity={0.26}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Floating diamond target crystal */}
      <mesh ref={diamondRef} position={[t.target.x, y + 5.6, t.target.z]} renderOrder={3}>
        <octahedronGeometry args={[0.58, 0]} />
        <meshBasicMaterial color="#b8ecff" transparent opacity={0.82} depthWrite={false} fog={false} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Rover (Upgraded NASA MER PBR Materials + Dust Tinting + Contact Shadow)

interface DustMatEntry {
  mat: THREE.MeshStandardMaterial;
  baseColor: THREE.Color;
  baseRoughness: number;
}

const MAT_TUNING: Record<string, { color: string; roughness: number; metalness: number }> = {
  SolarArrays: { color: '#1b3f74', roughness: 0.22, metalness: 0.78 },
  Gold: { color: '#e6b244', roughness: 0.28, metalness: 0.88 },
  Gold2: { color: '#d89d34', roughness: 0.32, metalness: 0.86 },
  Copper: { color: '#c87646', roughness: 0.34, metalness: 0.82 },
  White: { color: '#f4efe6', roughness: 0.45, metalness: 0.08 },
  LightGrayMetal: { color: '#c0bbb2', roughness: 0.4, metalness: 0.72 },
  Gray: { color: '#948e86', roughness: 0.48, metalness: 0.65 },
  lambert1: { color: '#a8a299', roughness: 0.46, metalness: 0.6 },
  Black: { color: '#242221', roughness: 0.68, metalness: 0.22 },
};

function useRoverModel() {
  const { scene } = useGLTF(MODEL, DRACO);
  const { pivot, dustEntries, clonedMats } = useMemo(() => {
    const root = scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    // Model's long axis is X (~1.6 m engine footprint)
    const s = 1.6 / size.x;
    root.scale.setScalar(s);
    const b2 = new THREE.Box3().setFromObject(root);
    const c = b2.getCenter(new THREE.Vector3());
    root.position.set(-c.x, -b2.min.y, -c.z);

    const entries: DustMatEntry[] = [];
    const created: THREE.Material[] = [];

    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const nextMats = mats.map((orig) => {
        const cloned = orig.clone() as THREE.MeshStandardMaterial;
        const spec = MAT_TUNING[orig.name];
        if (spec) {
          cloned.color.set(spec.color);
          cloned.roughness = spec.roughness;
          cloned.metalness = spec.metalness;
        } else {
          cloned.roughness = Math.min(0.65, cloned.roughness ?? 0.5);
          cloned.metalness = Math.max(0.25, cloned.metalness ?? 0.4);
        }
        cloned.envMapIntensity = 1.15;
        cloned.needsUpdate = true;
        created.push(cloned);
        entries.push({
          mat: cloned,
          baseColor: cloned.color.clone(),
          baseRoughness: cloned.roughness,
        });
        return cloned;
      });
      m.material = Array.isArray(m.material) ? nextMats : nextMats[0];
    });

    const p = new THREE.Group();
    p.add(root);
    p.rotation.y = Math.PI / 2;
    return { pivot: p, dustEntries: entries, clonedMats: created };
  }, [scene]);

  useEffect(
    () => () => {
      clonedMats.forEach((m) => m.dispose());
    },
    [clonedMats],
  );

  return { pivot, dustEntries };
}

function bodyQuat(t: Terrain, x: number, z: number, heading: number, out: THREE.Quaternion) {
  const c = contactPoints(x, z, heading);
  const h = (p: readonly number[]) => heightAt(t, p[0], p[1]);
  const front = (h(c.fl) + h(c.fr)) / 2;
  const back = (h(c.bl) + h(c.br)) / 2;
  const sideA = (h(c.fl) + h(c.bl)) / 2;
  const sideB = (h(c.fr) + h(c.br)) / 2;
  _f.set(Math.sin(heading) * 2 * RULES.wheelBaseHalf, front - back, Math.cos(heading) * 2 * RULES.wheelBaseHalf).normalize();
  _s.set(-Math.cos(heading) * 2 * RULES.trackHalf, sideA - sideB, Math.sin(heading) * 2 * RULES.trackHalf).normalize();
  _u.crossVectors(_f, _s).normalize();
  if (_u.y < 0) _u.negate();
  _x.crossVectors(_u, _f).normalize();
  _m.makeBasis(_x, _u, _f);
  return out.setFromRotationMatrix(_m);
}

const MARS_DUST_COLOR = new THREE.Color(MARS_DUST_HEX);

function Rover({ t, reduced }: { t: Terrain; reduced: boolean }) {
  const { pivot, dustEntries } = useRoverModel();
  const group = useRef<THREE.Group>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const lastPos = useRef(new THREE.Vector3());
  const lastDust = useRef(-1);
  const shadowDisc = useMemo(() => makeSoftDiscTexture(true), []);

  useEffect(() => () => shadowDisc.dispose(), [shadowDisc]);

  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const st = useRoverStore.getState();

    // Update dust accumulation tint across rover materials only when changed
    const dust = st.game.rover.dust;
    if (Math.abs(dust - lastDust.current) > 0.005) {
      lastDust.current = dust;
      for (let i = 0; i < dustEntries.length; i++) {
        const e = dustEntries[i];
        e.mat.color.copy(e.baseColor).lerp(MARS_DUST_COLOR, dust * 0.45);
        e.mat.roughness = Math.min(0.98, e.baseRoughness + dust * 0.35);
      }
    }

    let p: Pick<PathPoint, 'x' | 'z' | 'heading'>;
    if (st.phase === 'executing' && st.report) {
      p = poseAt(st.report.actual.path, st.timeline, getExecProgress(st));
    } else {
      p = st.game.rover;
    }

    const y = heightAt(t, p.x, p.z);
    const contacts = contactPoints(p.x, p.z, p.heading);
    const avg =
      (heightAt(t, contacts.fl[0], contacts.fl[1]) +
        heightAt(t, contacts.fr[0], contacts.fr[1]) +
        heightAt(t, contacts.bl[0], contacts.bl[1]) +
        heightAt(t, contacts.br[0], contacts.br[1])) /
      4;

    const distSq = live.ready ? lastPos.current.distanceToSquared(g.position) : 0;
    const step = Math.max(dt, 1e-3);
    const speed = st.phase === 'executing' ? Math.sqrt(distSq) / step : 0;
    const moving = st.phase === 'executing' && distSq > 1e-7;
    const bob = !reduced && moving ? Math.sin(clock.elapsedTime * 22) * 0.012 * (0.5 + sandAt(t, p.x, p.z)) : 0;
    lastPos.current.copy(g.position);

    g.position.set(p.x, Math.max(y, avg) + 0.02 + bob, p.z);
    bodyQuat(t, p.x, p.z, p.heading, _q);
    const k = !live.ready || reduced ? 1 : 1 - Math.exp(-dt * 12);
    g.quaternion.slerp(_q, k);

    // Pulsing high-gain antenna beacon during uplink & Martian night
    if (beaconRef.current) {
      const active = st.phase === 'uplink' || live.nightness > 0.12;
      beaconRef.current.visible = active;
      if (active) {
        const pulse = reduced ? 1 : 0.65 + 0.35 * Math.sin(clock.elapsedTime * 7);
        const s = 0.8 + 0.45 * pulse;
        beaconRef.current.scale.setScalar(s);
        (beaconRef.current.material as THREE.MeshBasicMaterial).opacity =
          Math.max(st.phase === 'uplink' ? 0.9 : 0, live.nightness * 0.9) * pulse;
      }
    }

    live.pos.copy(g.position);
    live.quat.copy(g.quaternion);
    live.heading = p.heading;
    live.moving = moving;
    live.speed = speed;
    live.ready = true;
  });

  useEffect(() => () => void (live.ready = false), []);

  return (
    <group ref={group}>
      <primitive object={pivot} />
      {/* High-gain antenna radio telemetry glow for uplink & dusk/night */}
      <mesh ref={beaconRef} position={[-0.22, 1.04, -0.18]} visible={false} renderOrder={4}>
        <sphereGeometry args={[0.075, 10, 8]} />
        <meshBasicMaterial color="#9fe2ff" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} />
      </mesh>
      {/* Soft contact shadow quad grounds wheels cleanly even on low tier */}
      <mesh position={[0, 0.028, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <planeGeometry args={[1.65, 2.05]} />
        <meshBasicMaterial
          map={shadowDisc}
          color="#160904"
          transparent
          opacity={0.48}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Wheel Tracks (Persistent Ring-Buffer Ribbon Mesh, 1 Draw Call)

function WheelTracks({ t, maxQuads }: { t: Terrain; maxQuads: number }) {
  const run = useRoverStore((s) => s.run);
  const lastSample = useRef(new THREE.Vector3());
  const hasSample = useRef(false);
  const head = useRef(0);
  const count = useRef(0);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(maxQuads * 4 * 3);
    const col = new Float32Array(maxQuads * 4 * 3);
    const idx = new Uint16Array(maxQuads * 6);
    for (let q = 0; q < maxQuads; q++) {
      const v = q * 4;
      const o = q * 6;
      idx[o] = v;
      idx[o + 1] = v + 1;
      idx[o + 2] = v + 2;
      idx[o + 3] = v + 2;
      idx[o + 4] = v + 1;
      idx[o + 5] = v + 3;
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.setDrawRange(0, 0);
    return g;
  }, [maxQuads]);

  useEffect(() => () => geo.dispose(), [geo]);

  // Clear tracks only when starting a fresh mission run
  useEffect(() => {
    head.current = 0;
    count.current = 0;
    hasSample.current = false;
    geo.setDrawRange(0, 0);
  }, [run, geo]);

  const cSoil = useMemo(() => new THREE.Color('#34160b'), []);
  const cSand = useMemo(() => new THREE.Color('#8f592c'), []);
  const tmpCol = useMemo(() => new THREE.Color(), []);

  useFrame(() => {
    if (!live.ready) return;
    if (!hasSample.current) {
      lastSample.current.copy(live.pos);
      hasSample.current = true;
      return;
    }
    if (!live.moving) return;

    const dx = live.pos.x - lastSample.current.x;
    const dz = live.pos.z - lastSample.current.z;
    const stepLen = Math.hypot(dx, dz);
    if (stepLen < 0.24) return;

    const posAttr = geo.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const colArr = colAttr.array as Float32Array;

    const ax = lastSample.current.x;
    const az = lastSample.current.z;
    const bx = live.pos.x;
    const bz = live.pos.z;
    const nx = -dz / stepLen;
    const nz = dx / stepLen;
    const trackHalf = RULES.trackHalf * 0.94;
    const treadHalf = 0.085;
    const s = sandAt(t, bx, bz);
    tmpCol.copy(cSoil).lerp(cSand, Math.min(1, s * 1.15));

    // Emit left & right wheel track quads
    for (const side of [-1, 1] as const) {
      const qi = head.current;
      head.current = (head.current + 1) % maxQuads;
      count.current = Math.min(maxQuads, count.current + 1);

      const off = side * trackHalf;
      const cxA = ax + nx * off;
      const czA = az + nz * off;
      const cxB = bx + nx * off;
      const czB = bz + nz * off;

      const x0 = cxA - nx * treadHalf;
      const z0 = czA - nz * treadHalf;
      const x1 = cxA + nx * treadHalf;
      const z1 = czA + nz * treadHalf;
      const x2 = cxB - nx * treadHalf;
      const z2 = czB - nz * treadHalf;
      const x3 = cxB + nx * treadHalf;
      const z3 = czB + nz * treadHalf;

      const vBase = qi * 12;
      posArr[vBase] = x0;
      posArr[vBase + 1] = heightAt(t, x0, z0) + 0.026;
      posArr[vBase + 2] = z0;

      posArr[vBase + 3] = x1;
      posArr[vBase + 4] = heightAt(t, x1, z1) + 0.026;
      posArr[vBase + 5] = z1;

      posArr[vBase + 6] = x2;
      posArr[vBase + 7] = heightAt(t, x2, z2) + 0.026;
      posArr[vBase + 8] = z2;

      posArr[vBase + 9] = x3;
      posArr[vBase + 10] = heightAt(t, x3, z3) + 0.026;
      posArr[vBase + 11] = z3;

      for (let k = 0; k < 4; k++) {
        const ci = vBase + k * 3;
        colArr[ci] = tmpCol.r;
        colArr[ci + 1] = tmpCol.g;
        colArr[ci + 2] = tmpCol.b;
      }
    }

    lastSample.current.copy(live.pos);
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    geo.setDrawRange(0, count.current * 6);
  });

  return (
    <mesh geometry={geo} frustumCulled={false} renderOrder={1}>
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.72}
        depthWrite={false}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Ghost Path Ribbon + Chevrons & Driven Trail

const RIBBON_OK = new THREE.Color('#fff0d4');
const RIBBON_BAD = new THREE.Color('#ff4f33');

function GhostPath({ t }: { t: Terrain }) {
  const phase = useRoverStore((s) => s.phase);
  const pred = usePrediction();
  const show = phase === 'planning' || phase === 'uplink';

  const { geometry, end, halted } = useMemo(() => {
    const pts = pred.path;
    const pos: number[] = [];
    const col: number[] = [];
    const idx: number[] = [];
    const haltPt = pred.haltedAt !== null || pred.end.status === 'lost';
    let vtx = 0;

    const pushQuad = (ax: number, az: number, bx: number, bz: number, halfW: number, nx: number, nz: number, c: THREE.Color) => {
      const yA = heightAt(t, ax, az) + 0.12;
      const yB = heightAt(t, bx, bz) + 0.12;
      pos.push(
        ax - nx * halfW, yA, az - nz * halfW,
        ax + nx * halfW, yA, az + nz * halfW,
        bx - nx * halfW, yB, bz - nz * halfW,
        bx + nx * halfW, yB, bz + nz * halfW,
      );
      for (let k = 0; k < 4; k++) col.push(c.r, c.g, c.b);
      idx.push(vtx, vtx + 1, vtx + 2, vtx + 2, vtx + 1, vtx + 3);
      vtx += 4;
    };

    const pushChevron = (cx: number, cz: number, fx: number, fz: number, nx: number, nz: number, c: THREE.Color) => {
      const cy = heightAt(t, cx, cz) + 0.14;
      const arm = 0.28;
      const tipX = cx + fx * 0.22;
      const tipZ = cz + fz * 0.22;
      const backL_X = cx - fx * 0.14 - nx * arm;
      const backL_Z = cz - fz * 0.14 - nz * arm;
      const backR_X = cx - fx * 0.14 + nx * arm;
      const backR_Z = cz - fz * 0.14 + nz * arm;
      const waistX = cx - fx * 0.02;
      const waistZ = cz - fz * 0.02;
      pos.push(
        tipX, cy, tipZ,
        backL_X, heightAt(t, backL_X, backL_Z) + 0.14, backL_Z,
        waistX, cy, waistZ,
        backR_X, heightAt(t, backR_X, backR_Z) + 0.14, backR_Z,
      );
      for (let k = 0; k < 4; k++) col.push(c.r, c.g, c.b);
      idx.push(vtx, vtx + 1, vtx + 2, vtx, vtx + 2, vtx + 3);
      vtx += 4;
    };

    let distAcc = 0;
    let nextChevron = 1.8;

    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      if (len < 1e-4) continue;
      const fx = dx / len;
      const fz = dz / len;
      const nx = -fz;
      const nz = fx;
      const bad = b.sand > RULES.softSandMask || b.tilt > RULES.tiltWarnDeg || (haltPt && i >= pts.length - 6);
      const c = bad ? RIBBON_BAD : RIBBON_OK;
      const period = bad ? 0.34 : 0.85;
      const duty = bad ? 0.19 : 0.56;
      const halfW = bad ? 0.13 : 0.08;

      const phaseDist = distAcc % period;
      if (phaseDist < duty) {
        pushQuad(a.x, a.z, b.x, b.z, halfW, nx, nz, c);
      }
      distAcc += len;
      if (distAcc >= nextChevron) {
        pushChevron(b.x, b.z, fx, fz, nx, nz, c);
        nextChevron += 2.3;
      }
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    return { geometry: g, end: pts[pts.length - 1], halted: haltPt };
  }, [pred, t]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  if (!show || pred.path.length < 2) return null;

  return (
    <group>
      <mesh geometry={geometry} renderOrder={2}>
        <meshBasicMaterial vertexColors transparent opacity={0.95} depthTest={false} fog={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[end.x, heightAt(t, end.x, end.z) + 0.55, end.z]} rotation={[0, end.heading, 0]} renderOrder={2}>
        <boxGeometry args={[1.2, 0.9, 1.6]} />
        <meshBasicMaterial color={halted ? '#ff6e54' : '#ffe6bf'} wireframe transparent opacity={0.62} depthTest={false} fog={false} />
      </mesh>
    </group>
  );
}

/** Driven trail (actual cyan ribbon + planned dashed reference + divergence connectors + 2s fade). */
function Trail({ t, reduced }: { t: Terrain; reduced: boolean }) {
  const phase = useRoverStore((s) => s.phase);
  const report = useRoverStore((s) => s.report);
  const lastDownlinkAt = useRoverUiStore((s) => s.lastDownlinkAt);
  const groupRef = useRef<THREE.Group>(null);

  const geos = useMemo(() => {
    if (!report) return null;
    const mk = (pts: PathPoint[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, heightAt(t, p.x, p.z) + 0.11, p.z]), 3));
      return g;
    };

    // Divergence connector ticks between predicted and actual trajectories (> 0.35 m apart)
    const predPts = report.predicted.path;
    const actPts = report.actual.path;
    const connPos: number[] = [];
    if (predPts.length >= 2 && actPts.length >= 2) {
      const samples = 12;
      for (let s = 1; s <= samples; s++) {
        const f = s / samples;
        const a = predPts[Math.min(predPts.length - 1, Math.round(f * (predPts.length - 1)))];
        const b = actPts[Math.min(actPts.length - 1, Math.round(f * (actPts.length - 1)))];
        if (Math.hypot(a.x - b.x, a.z - b.z) > 0.35) {
          connPos.push(a.x, heightAt(t, a.x, a.z) + 0.13, a.z, b.x, heightAt(t, b.x, b.z) + 0.13, b.z);
        }
      }
    }
    const connGeo = new THREE.BufferGeometry();
    connGeo.setAttribute('position', new THREE.Float32BufferAttribute(connPos, 3));

    return { actual: mk(actPts), planned: mk(predPts), conn: connGeo, hasConn: connPos.length > 0 };
  }, [report, t]);

  useEffect(() => () => void (geos?.actual.dispose(), geos?.planned.dispose(), geos?.conn.dispose()), [geos]);

  const lines = useMemo(() => {
    if (!geos) return null;
    const planned = new THREE.Line(
      geos.planned,
      new THREE.LineDashedMaterial({ color: '#ffe6bf', dashSize: 0.35, gapSize: 0.3, transparent: true, opacity: 0.65, depthTest: false, fog: false }),
    );
    planned.computeLineDistances();
    const actual = new THREE.Line(
      geos.actual,
      new THREE.LineBasicMaterial({ color: '#7fd8ff', transparent: true, opacity: 1, depthTest: false, fog: false }),
    );
    const conn = new THREE.LineSegments(
      geos.conn,
      new THREE.LineBasicMaterial({ color: '#ff8a73', transparent: true, opacity: 0.72, depthTest: false, fog: false }),
    );
    planned.renderOrder = actual.renderOrder = conn.renderOrder = 2;
    return { planned, actual, conn };
  }, [geos]);

  useEffect(
    () => () => {
      (lines?.planned.material as THREE.Material | undefined)?.dispose();
      (lines?.actual.material as THREE.Material | undefined)?.dispose();
      (lines?.conn.material as THREE.Material | undefined)?.dispose();
    },
    [lines],
  );

  useFrame(() => {
    if (!lines || !report) return;
    const st = useRoverStore.getState();
    const n = report.actual.path.length;
    const u = st.phase === 'executing' ? getExecProgress(st) : 1;
    const total = st.timeline[st.timeline.length - 1] ?? 0;
    let i = 0;
    while (i < st.timeline.length && st.timeline[i] <= u * total) i++;
    lines.actual.geometry.setDrawRange(0, Math.max(0, Math.min(n, i)));

    // 2.0s soft fade when returning from downlink -> planning
    let alpha = 1;
    if (st.phase === 'planning') {
      const elapsed = performance.now() - useRoverUiStore.getState().lastDownlinkAt;
      alpha = !reduced && lastDownlinkAt > 0 && elapsed < 2000 ? 1 - elapsed / 2000 : 0;
    }
    if (groupRef.current) groupRef.current.visible = alpha > 0.02;
    (lines.planned.material as THREE.LineDashedMaterial).opacity = 0.65 * alpha;
    (lines.actual.material as THREE.LineBasicMaterial).opacity = alpha;
    (lines.conn.material as THREE.LineBasicMaterial).opacity = 0.72 * alpha;
  });

  const keepForFade = phase === 'planning' && !reduced && lastDownlinkAt > 0 && performance.now() - lastDownlinkAt < 2000;
  if (!lines || (phase !== 'executing' && phase !== 'downlink' && phase !== 'won' && phase !== 'lost' && !keepForFade)) {
    return null;
  }
  return (
    <group ref={groupRef}>
      <primitive object={lines.planned} visible={phase !== 'executing'} />
      <primitive object={lines.actual} />
      {geos?.hasConn && <primitive object={lines.conn} visible={phase !== 'executing'} />}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Dust Plumes, Ambient Motes & SCAN FX

function Dust({ t, reduced, maxCount }: { t: Terrain; reduced: boolean; maxCount: number }) {
  const pts = useRef<THREE.Points>(null);
  const state = useMemo(
    () => ({ vel: new Float32Array(maxCount * 3), life: new Float32Array(maxCount), next: 0, acc: 0 }),
    [maxCount],
  );
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(maxCount * 3).fill(-999);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, [maxCount]);
  const sprite = useMemo(() => makeSoftDiscTexture(true), []);

  useEffect(() => () => (geo.dispose(), sprite.dispose()), [geo, sprite]);

  useFrame((_, dt) => {
    if (reduced || maxCount <= 0) return;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const step = Math.min(dt, 0.05);
    const sand = sandAt(t, live.pos.x, live.pos.z);

    if (live.moving) {
      const slipBoost = sand > 0.45 ? 1.8 : 1;
      const speedBoost = Math.min(2.2, 0.6 + live.speed * 0.35);
      state.acc += step * (50 + 135 * sand) * slipBoost * speedBoost;
      const fx = Math.sin(live.heading);
      const fz = Math.cos(live.heading);
      while (state.acc >= 1) {
        state.acc -= 1;
        const i = state.next;
        state.next = (state.next + 1) % maxCount;
        const side = Math.random() < 0.5 ? -1 : 1;
        arr[i * 3] = live.pos.x - fx * 0.65 + fz * 0.52 * side;
        arr[i * 3 + 1] = live.pos.y + 0.08;
        arr[i * 3 + 2] = live.pos.z - fz * 0.65 - fx * 0.52 * side;
        state.vel[i * 3] = -fx * (0.28 + sand * 0.35) + (Math.random() - 0.5) * 0.45;
        state.vel[i * 3 + 1] = 0.25 + Math.random() * (0.3 + sand * 0.4);
        state.vel[i * 3 + 2] = -fz * (0.28 + sand * 0.35) + (Math.random() - 0.5) * 0.45;
        state.life[i] = 1.25;
      }
    }

    let any = false;
    for (let i = 0; i < maxCount; i++) {
      if (state.life[i] <= 0) continue;
      any = true;
      state.life[i] -= step;
      if (state.life[i] <= 0) {
        arr[i * 3 + 1] = -999;
        continue;
      }
      arr[i * 3] += state.vel[i * 3] * step;
      arr[i * 3 + 1] += state.vel[i * 3 + 1] * step;
      arr[i * 3 + 2] += state.vel[i * 3 + 2] * step;
      state.vel[i * 3 + 1] *= 0.96;
    }
    if (any || live.moving) pos.needsUpdate = true;
    if (pts.current) pts.current.visible = any;
  });

  if (reduced || maxCount <= 0) return null;
  return (
    <points ref={pts} geometry={geo} frustumCulled={false}>
      <pointsMaterial map={sprite} color="#dc9f6e" size={0.38} sizeAttenuation transparent opacity={0.46} depthWrite={false} />
    </points>
  );
}

function AmbientMotes({ reduced, count }: { reduced: boolean; count: number }) {
  const ref = useRef<THREE.Points>(null);
  const { geo, speeds, phases } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const sp = new Float32Array(count);
    const ph = new Float32Array(count);
    const rnd = mulberry32(88);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * 32;
      pos[i * 3 + 1] = 0.3 + rnd() * 5.2;
      pos[i * 3 + 2] = (rnd() - 0.5) * 32;
      sp[i] = 0.5 + rnd() * 0.7;
      ph[i] = rnd() * Math.PI * 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geo: g, speeds: sp, phases: ph };
  }, [count]);

  const sprite = useMemo(() => makeSoftDiscTexture(false), []);
  useEffect(() => () => (geo.dispose(), sprite.dispose()), [geo, sprite]);

  useFrame(({ clock }, dt) => {
    if (reduced || count <= 0 || !ref.current || !live.ready) return;
    const attr = geo.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const el = clock.elapsedTime;
    const step = Math.min(dt, 0.05);
    for (let i = 0; i < count; i++) {
      const k = i * 3;
      arr[k] += speeds[i] * step;
      arr[k + 1] += Math.sin(el + phases[i]) * 0.08 * step;
      // Keep dust motes drifting inside a 32 m box centered on the rover
      if (arr[k] - live.pos.x > 16) arr[k] -= 32;
      else if (arr[k] - live.pos.x < -16) arr[k] += 32;
      if (arr[k + 2] - live.pos.z > 16) arr[k + 2] -= 32;
      else if (arr[k + 2] - live.pos.z < -16) arr[k + 2] += 32;
      if (arr[k + 1] < live.pos.y + 0.1) arr[k + 1] = live.pos.y + 0.4 + (i % 5) * 0.8;
    }
    attr.needsUpdate = true;
  });

  if (reduced || count <= 0) return null;
  return (
    <points ref={ref} geometry={geo} frustumCulled={false}>
      <pointsMaterial map={sprite} color="#f0bc8e" size={0.14} sizeAttenuation transparent opacity={0.34} depthWrite={false} />
    </points>
  );
}

/** Animated mast-to-ground/outcrop scan cone + pulse ring + win sparkles. */
function ScanFx({ t, reduced }: { t: Terrain; reduced: boolean }) {
  const beamRef = useRef<THREE.Mesh>(null);
  const pulseRef = useRef<THREE.Mesh>(null);
  const sparkleRef = useRef<THREE.Points>(null);

  const sparkleGeo = useMemo(() => {
    const n = 28;
    const pos = new Float32Array(n * 3);
    const rnd = mulberry32(404);
    const oy = heightAt(t, t.target.x, t.target.z);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const r = rnd() * t.target.radius * 0.9;
      pos[i * 3] = t.target.x + Math.cos(a) * r;
      pos[i * 3 + 1] = oy + 0.35 + rnd() * 1.4;
      pos[i * 3 + 2] = t.target.z + Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [t]);

  const sprite = useMemo(() => makeSoftDiscTexture(true), []);
  useEffect(() => () => (sparkleGeo.dispose(), sprite.dispose()), [sparkleGeo, sprite]);

  useFrame(({ clock }) => {
    const st = useRoverStore.getState();
    const r = st.report;
    let scanning = false;
    let success = true;

    if (st.phase === 'executing' && r) {
      const p = poseAt(r.actual.path, st.timeline, getExecProgress(st));
      const cmd = p.cmd >= 0 ? r.queue[p.cmd] : undefined;
      if (cmd?.type === 'scan') {
        scanning = true;
        success = !r.actual.events.includes('scan_range');
      }
    } else if ((st.phase === 'downlink' || st.phase === 'won') && r) {
      const didScanOk = r.actual.events.includes('scan_ok');
      const didScanFail = r.actual.events.includes('scan_range');
      if (didScanOk) {
        scanning = true;
        success = true;
      } else if (didScanFail && st.phase === 'downlink') {
        scanning = true;
        success = false;
      }
    }

    if (beamRef.current) {
      beamRef.current.visible = scanning;
      if (scanning) {
        const fx = Math.sin(live.heading);
        const fz = Math.cos(live.heading);
        _beamStart.set(live.pos.x + fx * 0.35, live.pos.y + 0.98, live.pos.z + fz * 0.35);
        const targetDist = Math.hypot(t.target.x - live.pos.x, t.target.z - live.pos.z);
        if (targetDist <= RULES.scanRangeM + 1.5) {
          _beamEnd.set(t.target.x, heightAt(t, t.target.x, t.target.z) + 0.15, t.target.z);
        } else {
          _beamEnd.set(live.pos.x + fx * 2.2, heightAt(t, live.pos.x + fx * 2.2, live.pos.z + fz * 2.2) + 0.08, live.pos.z + fz * 2.2);
        }
        _beamDir.subVectors(_beamEnd, _beamStart);
        const dist = Math.max(0.4, _beamDir.length());
        beamRef.current.position.copy(_beamStart).addScaledVector(_beamDir, 0.5);
        _beamDir.normalize();
        beamRef.current.quaternion.setFromUnitVectors(_upAxis, _beamDir);
        beamRef.current.scale.set(1, dist, 1);
        const mat = beamRef.current.material as THREE.MeshBasicMaterial;
        mat.color.set(success ? '#7fd8ff' : '#ff6e54');
        mat.opacity = reduced ? 0.32 : 0.24 + 0.14 * Math.sin(clock.elapsedTime * 10);
      }
    }

    if (pulseRef.current) {
      pulseRef.current.visible = scanning;
      if (scanning) {
        const pulse = reduced ? 0.65 : (clock.elapsedTime * 1.4) % 1;
        pulseRef.current.position.set(live.pos.x, live.pos.y + 0.08, live.pos.z);
        pulseRef.current.scale.setScalar(0.6 + pulse * RULES.scanRangeM);
        const mat = pulseRef.current.material as THREE.MeshBasicMaterial;
        mat.color.set(success ? '#7fd8ff' : '#ff6e54');
        mat.opacity = (1 - pulse) * 0.68;
      }
    }

    if (sparkleRef.current) {
      const showSparkle = scanning && success && (st.phase === 'won' || (r?.actual.events.includes('scan_ok') ?? false));
      sparkleRef.current.visible = showSparkle;
      if (showSparkle && !reduced) {
        sparkleRef.current.rotation.y = clock.elapsedTime * 0.45;
      }
    }
  });

  return (
    <group>
      <mesh ref={beamRef} visible={false} renderOrder={4}>
        <cylinderGeometry args={[0.04, 0.45, 1, 16, 1, true]} />
        <meshBasicMaterial
          color="#7fd8ff"
          transparent
          opacity={0.32}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fog={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={pulseRef} visible={false} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <ringGeometry args={[0.88, 1.0, 48]} />
        <meshBasicMaterial color="#7fd8ff" transparent opacity={0.6} depthWrite={false} fog={false} side={THREE.DoubleSide} />
      </mesh>
      <points ref={sparkleRef} visible={false} geometry={sparkleGeo} frustumCulled={false}>
        <pointsMaterial
          map={sprite}
          color="#b8f0ff"
          size={0.28}
          sizeAttenuation
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Camera Rig, Adaptive Tier Monitor & Perf Stats

const FOV: Record<CamMode | 'brief', number> = { chase: 50, hazcam: 78, map: 48, brief: 42 };

function CameraRig({ t, reduced, paused }: { t: Terrain; reduced: boolean; paused: boolean }) {
  const { gl, camera, scene, size, invalidate } = useThree();
  const persp = camera as THREE.PerspectiveCamera;
  const resetOrbitVersion = useRoverUiStore((s) => s.resetOrbitVersion);
  const begin = useRef(performance.now());
  const settled = useRef(false);
  const prevMode = useRef<CamMode | 'brief'>('brief');

  useEffect(() => {
    resetPlanOrbit();
    invalidate();
  }, [resetOrbitVersion, invalidate]);

  // Interactive orbit (drag), zoom (pinch/wheel), double-tap/double-click reset on canvas ONLY in Plan view
  useEffect(() => {
    const dom = gl.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let lastPinchDist = 0;
    let lastTapAt = 0;

    const canOrbit = () => {
      const st = useRoverStore.getState();
      return !paused && st.phase !== 'briefing' && st.cam === 'map';
    };

    const pinchDist = () => {
      const vals = Array.from(pointers.values());
      if (vals.length < 2) return 0;
      return Math.hypot(vals[0].x - vals[1].x, vals[0].y - vals[1].y);
    };

    const onDown = (e: PointerEvent) => {
      if (!canOrbit()) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        lastPinchDist = pinchDist();
      } else if (pointers.size === 1 && e.pointerType !== 'mouse') {
        const now = performance.now();
        if (now - lastTapAt < 320) {
          useRoverUiStore.getState().triggerResetOrbit();
          lastTapAt = 0;
        } else {
          lastTapAt = now;
        }
      }
    };

    const onMove = (e: PointerEvent) => {
      if (!canOrbit() || !pointers.has(e.pointerId)) return;
      const prev = pointers.get(e.pointerId)!;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size >= 2) {
        const d = pinchDist();
        if (lastPinchDist > 4 && d > 4) {
          const factor = lastPinchDist / d;
          planOrbit.zoom = THREE.MathUtils.clamp(planOrbit.zoom * factor, 0.6, 1.65);
          useRoverUiStore.getState().setOrbitModified(!isPlanOrbitDefault());
          invalidate();
        }
        lastPinchDist = d;
      } else if (pointers.size === 1) {
        planOrbit.yaw = THREE.MathUtils.clamp(planOrbit.yaw - dx * 0.0055, -MAX_PLAN_YAW, MAX_PLAN_YAW);
        planOrbit.pitch = THREE.MathUtils.clamp(planOrbit.pitch + dy * 0.0048, MIN_PLAN_PITCH, MAX_PLAN_PITCH);
        useRoverUiStore.getState().setOrbitModified(!isPlanOrbitDefault());
        invalidate();
      }
    };

    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) lastPinchDist = 0;
    };

    const onWheel = (e: WheelEvent) => {
      if (!canOrbit()) return;
      e.preventDefault();
      const mul = e.deltaY > 0 ? 1.09 : 0.92;
      planOrbit.zoom = THREE.MathUtils.clamp(planOrbit.zoom * mul, 0.6, 1.65);
      useRoverUiStore.getState().setOrbitModified(!isPlanOrbitDefault());
      invalidate();
    };

    const onDblClick = () => {
      if (!canOrbit()) return;
      useRoverUiStore.getState().triggerResetOrbit();
    };

    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('dblclick', onDblClick);
    return () => {
      dom.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('dblclick', onDblClick);
    };
  }, [gl, paused, invalidate]);

  useFrame((_, dt) => {
    if (!live.ready) return;
    const st = useRoverStore.getState();
    const mode: CamMode | 'brief' = st.phase === 'briefing' ? 'brief' : st.cam;
    const r = live.pos;
    const fx = Math.sin(live.heading);
    const fz = Math.cos(live.heading);
    const portrait = size.width < size.height;

    let directorMode: CamMode | 'brief' = mode;

    if (mode === 'brief') {
      const el = reduced ? 0 : (performance.now() - begin.current) / 1000;
      const a = el * 0.08 + 2.25;
      const dist = portrait ? 6.8 : 6.4;
      const cx = r.x + Math.cos(a) * dist;
      const cz = r.z + Math.sin(a) * dist;
      const cy = Math.max(heightAt(t, cx, cz) + 1.1, r.y + (portrait ? 1.8 : 2.1));
      _ct.set(cx, cy, cz);
      _look.set(r.x, r.y - (portrait ? 1.45 : 0.15), r.z);
    } else if (st.phase === 'uplink' && !reduced) {
      // Uplink cinematic rise to 3/4 view under the night sky
      const u = getExecProgress(st);
      const lift = THREE.MathUtils.smoothstep(u, 0, 0.9);
      const ang = live.heading + Math.PI * 0.78 + lift * 0.42;
      const dist = 5.6 + lift * 2.8;
      const cx = r.x + Math.sin(ang) * dist;
      const cz = r.z + Math.cos(ang) * dist;
      const cy = Math.max(heightAt(t, cx, cz) + 1.5, r.y + 2.1 + lift * 2.5);
      _ct.set(cx, cy, cz);
      _look.set(r.x + fx * 1.2, r.y + 0.65, r.z + fz * 1.2);
    } else if (st.phase === 'executing' && mode === 'chase' && !reduced && st.report) {
      // Camera director: chase with look-ahead, brief <=1s Hazcam cut on hazard, soft push-in on SCAN
      const u = getExecProgress(st);
      const p = poseAt(st.report.actual.path, st.timeline, u);
      const cmd = p.cmd >= 0 ? st.report.queue[p.cmd] : undefined;
      const evs = st.report.actual.events;

      let faultU = -1;
      if (evs.includes('tilt_warning') || evs.includes('tilt_stop')) {
        const pts = st.report.actual.path;
        const tot = st.timeline[st.timeline.length - 1] ?? 1;
        const idx = pts.findIndex((pt) => pt.tilt > RULES.tiltWarnDeg);
        faultU = idx >= 0 && tot > 0 ? THREE.MathUtils.clamp(st.timeline[idx] / tot, 0.14, 0.86) : 0.65;
      } else if (evs.includes('rock_stop') || evs.includes('turn_blocked')) {
        faultU = 0.78;
      }

      const faultCutWindow = Math.min(0.11, 0.85 / Math.max(2.5, st.clock?.dur ?? 5));
      if (faultU > 0 && Math.abs(u - faultU) < faultCutWindow) {
        directorMode = 'hazcam';
        _ct.set(r.x + fx * 0.85, r.y + 0.75, r.z + fz * 0.85);
        _look.set(r.x + fx * 7, heightAt(t, r.x + fx * 7, r.z + fz * 7), r.z + fz * 7);
      } else if (cmd?.type === 'scan') {
        const ox = t.target.x;
        const oz = t.target.z;
        const oy = heightAt(t, ox, oz);
        const sideX = -fz;
        const sideZ = fx;
        _ct.set(r.x - fx * 3.8 + sideX * 2.2, r.y + 2.1, r.z - fz * 3.8 + sideZ * 2.2);
        _ct.y = Math.max(_ct.y, heightAt(t, _ct.x, _ct.z) + 1.2);
        _look.set((r.x + ox) * 0.5, (r.y + oy) * 0.5 + 0.5, (r.z + oz) * 0.5);
      } else {
        _ct.set(r.x - fx * 6.8, r.y + 3.3, r.z - fz * 6.8);
        _ct.y = Math.max(_ct.y, heightAt(t, _ct.x, _ct.z) + 1.5);
        _look.set(r.x + fx * 3.8, r.y + 0.65, r.z + fz * 3.8);
      }
    } else if (mode === 'chase') {
      _ct.set(r.x - fx * 7, r.y + 3.4, r.z - fz * 7);
      _ct.y = Math.max(_ct.y, heightAt(t, _ct.x, _ct.z) + 1.5);
      _look.set(r.x + fx * 3, r.y + 0.6, r.z + fz * 3);
    } else if (mode === 'hazcam') {
      _ct.set(r.x + fx * 0.85, r.y + 0.75, r.z + fz * 0.85);
      _look.set(r.x + fx * 7, heightAt(t, r.x + fx * 7, r.z + fz * 7), r.z + fz * 7);
    } else {
      // Plan view: exact Phase 2 pose when orbit is at default, plus yaw/pitch/zoom offsets
      const dx = t.target.x - r.x;
      const dz = t.target.z - r.z;
      const d = Math.max(1, Math.hypot(dx, dz));
      const ux = dx / d;
      const uz = dz / d;
      const baseH = Math.min(24, Math.max(11, 8 + d * 0.18));
      const h = portrait ? baseH * 1.12 : baseH;
      const horiz = h * 0.7;
      const nudge = portrait ? -h * 0.14 : -h * 0.12;
      const lx = r.x + ux * nudge;
      const lz = r.z + uz * nudge;

      const baseRadius = Math.hypot(h, horiz) * planOrbit.zoom;
      const cyY = baseRadius * Math.sin(planOrbit.pitch);
      const horizR = baseRadius * Math.cos(planOrbit.pitch);
      const cyaw = Math.cos(planOrbit.yaw);
      const syaw = Math.sin(planOrbit.yaw);
      const rx = ux * cyaw - uz * syaw;
      const rz = ux * syaw + uz * cyaw;

      _ct.set(lx - rx * horizR, r.y + cyY, lz - rz * horizR);
      _ct.y = Math.max(_ct.y, heightAt(t, _ct.x, _ct.z) + 3);
      _look.set(lx, r.y, lz);
    }

    const modeChanged = prevMode.current !== directorMode;
    prevMode.current = directorMode;
    const instant = reduced || !settled.current || (mode === 'brief' && !modeChanged);
    const k = instant ? 1 : 1 - Math.exp(-dt * (directorMode === 'hazcam' ? 10 : 4.2));
    persp.position.lerp(_ct, k);
    persp.lookAt(_look);

    const targetFov = FOV[directorMode];
    if (persp.fov !== targetFov) {
      persp.fov = instant ? targetFov : THREE.MathUtils.lerp(persp.fov, targetFov, Math.min(1, dt * 6));
      if (Math.abs(persp.fov - targetFov) < 0.05) persp.fov = targetFov;
      persp.updateProjectionMatrix();
    }

    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      const far = mode === 'map' ? 215 : 155;
      const near = mode === 'map' ? 55 : 28;
      fog.far = instant ? far : THREE.MathUtils.lerp(fog.far, far, Math.min(1, dt * 3));
      fog.near = instant ? near : THREE.MathUtils.lerp(fog.near, near, Math.min(1, dt * 3));
    }
    settled.current = true;
  });

  return null;
}

function SceneController({ paused }: { paused: boolean }) {
  const { gl, invalidate } = useThree();
  const windowRef = useRef({ elapsed: 0, frames: 0, cooldown: 2.0 });
  const perfRef = useRef({ lastPush: performance.now(), frames: 0 });

  useEffect(() => {
    const u1 = useRoverStore.subscribe(() => invalidate());
    const u2 = useRoverUiStore.subscribe(() => invalidate());
    return () => {
      u1();
      u2();
    };
  }, [invalidate]);

  const isSoftwareGl = useMemo(() => {
    try {
      const ctx = gl.getContext();
      const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
      const rendererName = dbg ? String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(ctx.getParameter(ctx.RENDERER));
      return /swiftshader|llvmpipe|software/i.test(rendererName);
    } catch {
      return false;
    }
  }, [gl]);

  const showPerf = useMemo(
    () => typeof window !== 'undefined' && (new URLSearchParams(window.location.search).has('perf') || new URLSearchParams(window.location.search).has('fps')),
    [],
  );

  useFrame((_, dt) => {
    const clampedDt = Math.min(dt, 0.1);
    if (!paused) {
      const w = windowRef.current;
      w.elapsed += clampedDt;
      w.frames++;
      if (w.elapsed >= 2.0) {
        const avgMs = (w.elapsed * 1000) / Math.max(1, w.frames);
        const ui = useRoverUiStore.getState();
        if (!ui.qualityLocked && !isSoftwareGl && ui.qualityTier !== 'low' && w.cooldown <= 0 && avgMs > 22) {
          ui.downgradeQualityTier();
          w.cooldown = 3.0;
        } else {
          w.cooldown = Math.max(0, w.cooldown - w.elapsed);
        }
        w.elapsed = 0;
        w.frames = 0;
      }
    }

    if (showPerf) {
      const pr = perfRef.current;
      pr.frames++;
      const now = performance.now();
      const span = now - pr.lastPush;
      if (span >= 450) {
        const fps = Math.round((pr.frames * 1000) / span);
        useRoverUiStore.getState().setPerfStats({
          fps,
          calls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
        });
        pr.frames = 0;
        pr.lastPush = now;
      }
    }
  });

  return null;
}

// ---------------------------------------------------------------------------

export default function RoverDriveScene({ paused }: { paused: boolean }) {
  const reduced = useReducedMotion();
  const t = useRoverStore((s) => s.game.terrain);
  const phase = useRoverStore((s) => s.phase);
  const qualityTier = useRoverUiStore((s) => s.qualityTier);
  const spec = TIER_SPECS[qualityTier];

  const cleanupContextRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupContextRef.current?.(), []);

  return (
    <Canvas
      shadows={spec.shadowSize > 0 ? { type: THREE.PCFShadowMap } : false}
      frameloop={paused ? 'never' : reduced && phase === 'planning' ? 'demand' : 'always'}
      dpr={[1, spec.dpr]}
      camera={{ fov: 45, near: 0.1, far: 800, position: [0, 90, -60] }}
      gl={{
        antialias: qualityTier !== 'low',
        powerPreference: 'high-performance',
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.12,
      }}
      onCreated={({ gl }) => {
        registerRenderer(gl);
        const onLost = (e: Event) => {
          e.preventDefault();
          useRoverStore.getState().setView('2d');
        };
        gl.domElement.addEventListener('webglcontextlost', onLost);
        cleanupContextRef.current = () => gl.domElement.removeEventListener('webglcontextlost', onLost);
      }}
      aria-hidden="true"
    >
      <color attach="background" args={[FOG_HEX]} />
      <fog attach="fog" args={[FOG_HEX, 28, 155]} />
      <ReflectionEnv />
      <SkyDome reduced={reduced} />
      <NightStars />
      <SunAndLights shadowSize={spec.shadowSize} />
      <TerrainMesh t={t} spec={spec} />
      <HorizonSkirt t={t} />
      <ScalePads t={t} />
      <RockField t={t} spec={spec} />
      <Outcrop t={t} reduced={reduced} />
      <WheelTracks t={t} maxQuads={spec.trackQuads} />
      <GhostPath t={t} />
      <Trail t={t} reduced={reduced} />
      <Dust t={t} reduced={reduced} maxCount={spec.dust} />
      <AmbientMotes reduced={reduced} count={spec.motes} />
      <ScanFx t={t} reduced={reduced} />
      <Suspense fallback={null}>
        <Rover t={t} reduced={reduced} />
      </Suspense>
      <CameraRig t={t} reduced={reduced} paused={paused} />
      <SceneController paused={paused} />
    </Canvas>
  );
}

useGLTF.preload(MODEL, DRACO);
