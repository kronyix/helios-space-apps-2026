/**
 * Signal Delay — R3F scene. Reads the rover store; never mutates game state.
 * Terrain, rocks and rover pose all come from the shared engine terrain.
 */
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { fbm, mulberry32 } from '../../lib/noise';
import { registerRenderer } from '../../lib/debug';
import { isCoarsePointer, isSmallScreen } from '../../lib/device';
import { dur, easeInOutCubic } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { ENV } from './Environment';
import { contactPoints, RULES } from '../../games/roverDrive/engine';
import { heightAt, sandAt } from '../../games/roverDrive/terrain';
import { clockProgress, poseAt, usePrediction, useRoverStore, type CamMode } from '../../games/roverDrive/store';
import type { PathPoint, Terrain } from '../../games/roverDrive/types';

const DRACO = '/draco/';
const MODEL = '/models/opportunity.glb';
const SKY_TOP = new THREE.Color('#6e4430');
const SKY_HORIZON = new THREE.Color('#dba477');
const FOG = '#cf9466';
const SUN_DIR = new THREE.Vector3(-0.75, 0.42, 0.5).normalize();

/** Live rover pose shared by the rover, camera rig, dust and lights (no React state per frame). */
const live = {
  pos: new THREE.Vector3(),
  quat: new THREE.Quaternion(),
  heading: 0,
  moving: false,
  ready: false,
};

// ---------------------------------------------------------------------------
// Terrain

function grainTexture() {
  const n = 128;
  const data = new Uint8Array(n * n * 4);
  const rnd = mulberry32(9);
  for (let i = 0; i < n * n; i++) {
    const x = i % n;
    const y = Math.floor(i / n);
    const v = 200 + 55 * (0.6 * fbm(x / 9, y / 9, 3, 3) + 0.4 * rnd());
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = Math.min(255, v);
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, n, n);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(48, 48);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function TerrainMesh({ t, shadows }: { t: Terrain; shadows: boolean }) {
  const { geometry, map } = useMemo(() => {
    const g = new THREE.PlaneGeometry(t.size, t.size, t.res - 1, t.res - 1);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const [dark, mid, ochre] = ENV.mars.ground.map((c) => new THREE.Color(c));
    const sandC = new THREE.Color('#e0a774');
    const outcrop = new THREE.Color('#d9c4a2');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, heightAt(t, x, z));
      const n = fbm(x * 0.08, z * 0.08, 3, 21);
      c.copy(dark).lerp(mid, 0.45 + 0.35 * n).lerp(ochre, Math.max(0, fbm(x * 0.02, z * 0.02, 2, 5) - 0.45));
      const s = sandAt(t, x, z);
      if (s > 0) c.lerp(sandC, s * 0.75);
      const dt = Math.hypot(x - t.target.x, z - t.target.z);
      if (dt < t.target.radius + 1.5) c.lerp(outcrop, Math.min(1, (t.target.radius + 1.5 - dt) / 1.5) * 0.8);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return { geometry: g, map: grainTexture() };
  }, [t]);
  useEffect(() => () => (geometry.dispose(), map.dispose()), [geometry, map]);
  return (
    <mesh geometry={geometry} receiveShadow={shadows}>
      <meshStandardMaterial vertexColors map={map} roughness={0.97} metalness={0} />
    </mesh>
  );
}

function RockField({ t, shadows }: { t: Terrain; shadows: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.DodecahedronGeometry(1, 0), []);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const rnd = mulberry32(t.seed + 77);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const col = new THREE.Color();
    t.rocks.forEach((r, i) => {
      e.set(rnd() * 0.6, rnd() * Math.PI * 2, rnd() * 0.6);
      q.setFromEuler(e);
      s.set(r.radius, r.radius * (0.55 + rnd() * 0.3), r.radius * (0.85 + rnd() * 0.3));
      p.set(r.x, heightAt(t, r.x, r.z) + r.radius * 0.2, r.z);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      col.set(ENV.mars.rock).multiplyScalar(0.75 + rnd() * 0.45);
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [t]);
  return (
    <instancedMesh ref={ref} args={[geo, undefined, t.rocks.length]} castShadow={shadows} receiveShadow={shadows}>
      <meshStandardMaterial flatShading roughness={0.9} />
    </instancedMesh>
  );
}

function Outcrop({ t, reduced }: { t: Terrain; reduced: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  const y = heightAt(t, t.target.x, t.target.z);
  const berries = useMemo(() => {
    const rnd = mulberry32(5);
    return Array.from({ length: 40 }, () => {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * (t.target.radius - 0.6);
      return [t.target.x + Math.cos(a) * r, t.target.z + Math.sin(a) * r] as const;
    });
  }, [t]);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const k = reduced ? 1 : 1 + 0.12 * Math.sin(clock.elapsedTime * 2.4);
    ring.current.scale.setScalar(k);
    (ring.current.material as THREE.MeshBasicMaterial).opacity = reduced ? 0.7 : 0.45 + 0.3 * Math.sin(clock.elapsedTime * 2.4 + 1);
  });
  return (
    <group>
      <mesh position={[t.target.x, y + 0.05, t.target.z]} receiveShadow>
        <cylinderGeometry args={[t.target.radius - 0.3, t.target.radius, 0.3, 9]} />
        <meshStandardMaterial color="#dccaa6" roughness={0.85} flatShading />
      </mesh>
      {berries.map(([x, z], i) => (
        <mesh key={i} position={[x, y + 0.22, z]}>
          <sphereGeometry args={[0.05, 6, 4]} />
          <meshStandardMaterial color={ENV.mars.blueberry} roughness={0.4} metalness={0.5} />
        </mesh>
      ))}
      <mesh ref={ring} position={[t.target.x, y + 0.35, t.target.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[RULES.scanRangeM - 0.12, RULES.scanRangeM + 0.08, 56]} />
        <meshBasicMaterial color="#9fe2ff" transparent opacity={0.6} depthWrite={false} fog={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function SkyDome() {
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(300, 32, 16);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const cols = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const k = Math.max(0, pos.getY(i) / 300);
      c.copy(SKY_HORIZON).lerp(SKY_TOP, Math.pow(k, 0.6));
      cols.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} renderOrder={-1}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Rover

function useRoverModel() {
  const { scene } = useGLTF(MODEL, DRACO);
  return useMemo(() => {
    const root = scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    // The model's long axis is x (z is the solar-wing span). Scale to ~1.6 m long.
    const s = 1.6 / size.x;
    root.scale.setScalar(s);
    const b2 = new THREE.Box3().setFromObject(root);
    const c = b2.getCenter(new THREE.Vector3());
    root.position.set(-c.x, -b2.min.y, -c.z);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    const pivot = new THREE.Group();
    pivot.add(root);
    // Model faces -x; turn it so the mast points along local +z (engine forward).
    pivot.rotation.y = Math.PI / 2;
    return pivot;
  }, [scene]);
}

const _f = new THREE.Vector3();
const _s = new THREE.Vector3();
const _u = new THREE.Vector3();
const _x = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();

function bodyQuat(t: Terrain, x: number, z: number, heading: number, out: THREE.Quaternion) {
  const c = contactPoints(x, z, heading);
  const h = (p: readonly number[]) => heightAt(t, p[0], p[1]);
  const front = (h(c.fl) + h(c.fr)) / 2;
  const back = (h(c.bl) + h(c.br)) / 2;
  const sideA = (h(c.fl) + h(c.bl)) / 2;
  const sideB = (h(c.fr) + h(c.br)) / 2;
  _f.set(Math.sin(heading) * 2 * RULES.wheelBaseHalf, front - back, Math.cos(heading) * 2 * RULES.wheelBaseHalf).normalize();
  // contactPoints' "l" side sits at -r where r = (cos h, -sin h)
  _s.set(-Math.cos(heading) * 2 * RULES.trackHalf, sideA - sideB, Math.sin(heading) * 2 * RULES.trackHalf).normalize();
  _u.crossVectors(_f, _s).normalize();
  if (_u.y < 0) _u.negate();
  _x.crossVectors(_u, _f).normalize();
  _m.makeBasis(_x, _u, _f);
  return out.setFromRotationMatrix(_m);
}

function Rover({ t, reduced }: { t: Terrain; reduced: boolean }) {
  const model = useRoverModel();
  const group = useRef<THREE.Group>(null);
  const lastPos = useRef(new THREE.Vector3());
  useFrame(({ clock }, dt) => {
    const g = group.current;
    if (!g) return;
    const st = useRoverStore.getState();
    let p: Pick<PathPoint, 'x' | 'z' | 'heading'>;
    if (st.phase === 'executing' && st.report) {
      p = poseAt(st.report.actual.path, st.timeline, clockProgress(st));
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
    const moving = st.phase === 'executing' && lastPos.current.distanceToSquared(g.position) > 1e-7;
    const bob = !reduced && moving ? Math.sin(clock.elapsedTime * 22) * 0.012 * (0.5 + sandAt(t, p.x, p.z)) : 0;
    lastPos.current.copy(g.position);
    g.position.set(p.x, Math.max(y, avg) + 0.02 + bob, p.z);
    bodyQuat(t, p.x, p.z, p.heading, _q);
    const k = !live.ready || reduced ? 1 : 1 - Math.exp(-dt * 12);
    g.quaternion.slerp(_q, k);
    live.pos.copy(g.position);
    live.quat.copy(g.quaternion);
    live.heading = p.heading;
    live.moving = moving;
    live.ready = true;
  });
  useEffect(() => () => void (live.ready = false), []);
  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Paths

const OK = new THREE.Color('#ffe6bf');
const BAD = new THREE.Color('#ff4f33');

function GhostPath({ t }: { t: Terrain }) {
  const phase = useRoverStore((s) => s.phase);
  const pred = usePrediction();
  const show = phase === 'planning' || phase === 'uplink';
  const { geometry, end } = useMemo(() => {
    const pts = pred.path;
    const pos: number[] = [];
    const col: number[] = [];
    const haltPt = pred.haltedAt !== null || pred.end.status === 'lost';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const bad = b.sand > 0.5 || b.tilt > RULES.tiltWarnDeg || (haltPt && i >= pts.length - 6);
      const c = bad ? BAD : OK;
      pos.push(a.x, heightAt(t, a.x, a.z) + 0.12, a.z, b.x, heightAt(t, b.x, b.z) + 0.12, b.z);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const ls = new THREE.LineSegments(g);
    ls.computeLineDistances();
    return { geometry: g, end: pts[pts.length - 1] };
  }, [pred, t]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (!show || pred.path.length < 2) return null;
  return (
    <group>
      <lineSegments geometry={geometry}>
        <lineDashedMaterial vertexColors dashSize={0.45} gapSize={0.28} transparent opacity={0.95} depthTest={false} fog={false} />
      </lineSegments>
      <mesh position={[end.x, heightAt(t, end.x, end.z) + 0.6, end.z]} rotation={[0, end.heading, 0]}>
        <boxGeometry args={[1.2, 0.9, 1.6]} />
        <meshBasicMaterial color="#ffe6bf" wireframe transparent opacity={0.55} depthTest={false} fog={false} />
      </mesh>
    </group>
  );
}

/** Driven trail (actual) plus, after the drive, the plan for comparison. */
function Trail({ t }: { t: Terrain }) {
  const phase = useRoverStore((s) => s.phase);
  const report = useRoverStore((s) => s.report);
  const geos = useMemo(() => {
    if (!report) return null;
    const mk = (pts: PathPoint[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, heightAt(t, p.x, p.z) + 0.1, p.z]), 3));
      return g;
    };
    return { actual: mk(report.actual.path), planned: mk(report.predicted.path) };
  }, [report, t]);
  useEffect(() => () => void (geos?.actual.dispose(), geos?.planned.dispose()), [geos]);
  const lines = useMemo(() => {
    if (!geos) return null;
    const planned = new THREE.Line(
      geos.planned,
      new THREE.LineDashedMaterial({ color: '#ffe6bf', dashSize: 0.35, gapSize: 0.3, transparent: true, opacity: 0.6, depthTest: false, fog: false }),
    );
    planned.computeLineDistances();
    const actual = new THREE.Line(geos.actual, new THREE.LineBasicMaterial({ color: '#7fd8ff', depthTest: false, fog: false }));
    planned.renderOrder = actual.renderOrder = 2;
    return { planned, actual };
  }, [geos]);
  useEffect(
    () => () => {
      (lines?.planned.material as THREE.Material | undefined)?.dispose();
      (lines?.actual.material as THREE.Material | undefined)?.dispose();
    },
    [lines],
  );
  useFrame(() => {
    if (!lines || !report) return;
    const st = useRoverStore.getState();
    const n = report.actual.path.length;
    const u = st.phase === 'executing' ? clockProgress(st) : 1;
    const total = st.timeline[st.timeline.length - 1] ?? 0;
    let i = 0;
    while (i < st.timeline.length && st.timeline[i] <= u * total) i++;
    lines.actual.geometry.setDrawRange(0, Math.max(0, Math.min(n, i)));
  });
  if (!lines || (phase !== 'executing' && phase !== 'downlink' && phase !== 'won' && phase !== 'lost')) return null;
  return (
    <group>
      <primitive object={lines.planned} visible={phase !== 'executing'} />
      <primitive object={lines.actual} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Dust (pooled, ≤200 particles)

const DUST_N = 200;
function Dust({ t, reduced }: { t: Terrain; reduced: boolean }) {
  const pts = useRef<THREE.Points>(null);
  const state = useMemo(() => ({ vel: new Float32Array(DUST_N * 3), life: new Float32Array(DUST_N), next: 0, acc: 0 }), []);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(DUST_N * 3).fill(-999);
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return g;
  }, []);
  const sprite = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }, []);
  useEffect(() => () => (geo.dispose(), sprite.dispose()), [geo, sprite]);
  useFrame((_, dt) => {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const step = Math.min(dt, 0.05);
    if (live.moving && !reduced) {
      state.acc += step * (60 + 140 * sandAt(t, live.pos.x, live.pos.z));
      const fx = Math.sin(live.heading);
      const fz = Math.cos(live.heading);
      while (state.acc >= 1) {
        state.acc -= 1;
        const i = state.next;
        state.next = (state.next + 1) % DUST_N;
        const side = Math.random() < 0.5 ? -1 : 1;
        arr[i * 3] = live.pos.x - fx * 0.7 + fz * 0.5 * side;
        arr[i * 3 + 1] = live.pos.y + 0.08;
        arr[i * 3 + 2] = live.pos.z - fz * 0.7 - fx * 0.5 * side;
        state.vel[i * 3] = -fx * 0.3 + (Math.random() - 0.5) * 0.4;
        state.vel[i * 3 + 1] = 0.25 + Math.random() * 0.35;
        state.vel[i * 3 + 2] = -fz * 0.3 + (Math.random() - 0.5) * 0.4;
        state.life[i] = 1.3;
      }
    }
    let any = false;
    for (let i = 0; i < DUST_N; i++) {
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
      state.vel[i * 3 + 1] *= 0.97;
    }
    if (any || live.moving) pos.needsUpdate = true;
    if (pts.current) pts.current.visible = any;
  });
  return (
    <points ref={pts} geometry={geo} frustumCulled={false}>
      <pointsMaterial map={sprite} color="#d79b6c" size={0.35} sizeAttenuation transparent opacity={0.45} depthWrite={false} />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Lights & cameras

const SHADOW_HALF = 9;
const SHADOW_MAP = 1024;
const SHADOW_TEXEL = (2 * SHADOW_HALF) / SHADOW_MAP;
// Light-space basis for SUN_DIR: the shadow camera is snapped to whole texels across it.
const _sunRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), SUN_DIR).normalize();
const _sunUp = new THREE.Vector3().crossVectors(SUN_DIR, _sunRight).normalize();
const _snap = new THREE.Vector3();

function SunLight({ shadows }: { shadows: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    // Follow the rover in whole shadow-map texels; sub-texel moves make shadow edges shimmer.
    const p = live.pos;
    const u = Math.round(p.dot(_sunRight) / SHADOW_TEXEL) * SHADOW_TEXEL;
    const v = Math.round(p.dot(_sunUp) / SHADOW_TEXEL) * SHADOW_TEXEL;
    const w = p.dot(SUN_DIR);
    _snap.copy(_sunRight).multiplyScalar(u).addScaledVector(_sunUp, v).addScaledVector(SUN_DIR, w);
    l.position.copy(_snap).addScaledVector(SUN_DIR, 30);
    l.target.position.copy(_snap);
    l.target.updateMatrixWorld();
  });
  return (
    <>
      <hemisphereLight args={[ENV.mars.hemi[0], ENV.mars.hemi[1], 0.75]} />
      <directionalLight
        ref={light}
        castShadow={shadows}
        intensity={2.4}
        color="#ffd2a1"
        shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.03}
        shadow-camera-left={-SHADOW_HALF}
        shadow-camera-right={SHADOW_HALF}
        shadow-camera-top={SHADOW_HALF}
        shadow-camera-bottom={-SHADOW_HALF}
        shadow-camera-near={1}
        shadow-camera-far={70}
      />
    </>
  );
}

const _cp = new THREE.Vector3();
const _ct = new THREE.Vector3();
const _look = new THREE.Vector3();
/** Smoothed look-at point: snapping it while the position eases made mode switches cut in one frame. */
const _lookNow = new THREE.Vector3();

const FOV: Record<CamMode | 'brief', number> = { chase: 50, hazcam: 78, map: 42, brief: 45 };

function CameraRig({ t, reduced }: { t: Terrain; reduced: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  const begin = useRef(performance.now());
  const settled = useRef(false);
  const lastMode = useRef<CamMode | 'brief' | null>(null);
  const switchedAt = useRef(0);
  useFrame((state, dt) => {
    if (!live.ready) return;
    const st = useRoverStore.getState();
    const mode: CamMode | 'brief' = st.phase === 'briefing' ? 'brief' : st.cam;
    const r = live.pos;
    const fx = Math.sin(live.heading);
    const fz = Math.cos(live.heading);
    if (mode === 'brief') {
      const el = (performance.now() - begin.current) / 1000;
      const a = el * 0.06 + 2.2;
      const orbit = _cp.set(r.x + Math.cos(a) * 18, r.y + 7, r.z + Math.sin(a) * 18);
      // Cinematic dive from high over the plain down to the start pad.
      const k = reduced ? 1 : easeInOutCubic(Math.min(1, el / (dur.cinematic * 2)));
      _ct.set(r.x + 30, r.y + 90, r.z - 40).lerp(orbit, k);
      _look.copy(r).setY(r.y + 0.6);
    } else if (mode === 'chase') {
      _ct.set(r.x - fx * 7, r.y + 3.4, r.z - fz * 7);
      _ct.y = Math.max(_ct.y, heightAt(t, _ct.x, _ct.z) + 1.5);
      _look.set(r.x + fx * 3, r.y + 0.6, r.z + fz * 3);
    } else if (mode === 'hazcam') {
      _ct.set(r.x + fx * 0.85, r.y + 0.75, r.z + fz * 0.85);
      _look.set(r.x + fx * 7, heightAt(t, r.x + fx * 7, r.z + fz * 7), r.z + fz * 7);
    } else {
      const dx = t.target.x - r.x;
      const dz = t.target.z - r.z;
      const d = Math.hypot(dx, dz);
      // Frame rover + target, nudged so the rover sits above the command dock.
      const cx = r.x + dx * 0.4;
      const cz = r.z + dz * 0.4;
      const h = Math.min(70, 24 + d * 0.62);
      _ct.set(cx, h, cz - h * 0.55);
      _look.set(cx, 0, cz - h * 0.12);
    }
    if (mode !== lastMode.current) {
      lastMode.current = mode;
      switchedAt.current = state.clock.elapsedTime;
    }
    // Right after a mode switch, glide (≈1.2 s) instead of snapping, then tighten up to follow the rover.
    const glide = Math.min(1, (state.clock.elapsedTime - switchedAt.current) / 1.2);
    const ease = 0.35 + 0.65 * glide * glide;
    const instant = reduced || !settled.current;
    const k = instant ? 1 : mode === 'brief' ? 1 : 1 - Math.exp(-dt * (mode === 'hazcam' ? 10 : 3.5) * ease);
    camera.position.lerp(_ct, k);
    if (instant || mode === 'brief') _lookNow.copy(_look);
    else _lookNow.lerp(_look, 1 - Math.exp(-dt * (mode === 'hazcam' ? 12 : 5) * ease));
    camera.lookAt(_lookNow);
    if (camera.fov !== FOV[mode]) {
      camera.fov = instant ? FOV[mode] : THREE.MathUtils.lerp(camera.fov, FOV[mode], Math.min(1, dt * 6));
      if (Math.abs(camera.fov - FOV[mode]) < 0.05) camera.fov = FOV[mode];
      camera.updateProjectionMatrix();
    }
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      // Derived from the camera's actual distance (not the mode), so fog never steps
      // while the camera is still travelling between views: map ≈ 60–170, chase ≈ 18–85.
      const d = camera.position.distanceTo(r);
      fog.near = THREE.MathUtils.clamp(d * 0.6 + 12, 18, 60);
      fog.far = THREE.MathUtils.clamp(d * 1.4 + 60, 85, 170);
    }
    settled.current = true;
  });
  return null;
}

// ---------------------------------------------------------------------------

export default function RoverDriveScene({ paused }: { paused: boolean }) {
  const reduced = useReducedMotion();
  const t = useRoverStore((s) => s.game.terrain);
  const mobile = isCoarsePointer() || isSmallScreen();
  const shadows = !mobile;
  return (
    <Canvas
      shadows={shadows ? { type: THREE.PCFShadowMap } : false}
      frameloop={paused ? 'demand' : 'always'}
      dpr={mobile ? [1, 1.5] : [1, 2]}
      camera={{ fov: 45, near: 0.1, far: 700, position: [0, 90, -60] }}
      gl={{ antialias: !mobile, powerPreference: 'high-performance', toneMappingExposure: 1.05 }}
      onCreated={({ gl }) => registerRenderer(gl)}
      aria-hidden="true"
    >
      <color attach="background" args={[FOG]} />
      <fog attach="fog" args={[FOG, 18, 85]} />
      <SkyDome />
      <SunLight shadows={shadows} />
      <TerrainMesh t={t} shadows={shadows} />
      {/* Skirt beyond the mapped area so the plain never ends at a hard edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.2, 0]}>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color="#8a3d1f" roughness={1} />
      </mesh>
      <RockField t={t} shadows={shadows} />
      <Outcrop t={t} reduced={reduced} />
      <GhostPath t={t} />
      <Trail t={t} />
      <Dust t={t} reduced={reduced} />
      <Suspense fallback={null}>
        <Rover t={t} reduced={reduced} />
      </Suspense>
      <CameraRig t={t} reduced={reduced} />
    </Canvas>
  );
}

useGLTF.preload(MODEL, DRACO);
