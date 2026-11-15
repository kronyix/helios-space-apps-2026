import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, useTexture } from '@react-three/drei';
import { AnchorProjector } from './AnchorProjector';
import * as THREE from 'three';
import { registerRenderer } from '../../lib/debug';
import type { MissionData } from '../../data/types';
import { latLngToVector3, yawToFace } from '../../lib/geo';
import { formatCoord, pad2 } from '../../lib/missions';
import { dur, easeInOutCubic } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { isCoarsePointer } from '../../lib/device';
import { blip } from '../../lib/audio';
import { AtmosphereMaterial } from './materials';

export interface OrbitalGlobeProps {
  missions: MissionData[];
  selectedBody: 'moon' | 'mars';
  onSelectMission: (id: string) => void;
  /** ext: mission the camera is currently diving into (null when idle) */
  divingTo?: string | null;
  /** ext: called when the dive camera move finishes */
  onDiveComplete?: (id: string) => void;
  /** ext: mission to rotate into view (e.g. hovered in the issue list) */
  focusedId?: string | null;
  onFocus?: (id: string | null) => void;
}

const MARS_R = 2.35;
const MOON_R = 0.5;
const TAN_HALF_FOV = Math.tan((34 / 2) * (Math.PI / 180));
const SUN_DIR = new THREE.Vector3(-0.8, 0.35, 0.55).normalize();

type Spin = { yaw: number; pitch: number; vYaw: number; vPitch: number; targetYaw: number | null; targetPitch: number | null };

/** Shared, mutable rotation state for each body (not React state: it changes every frame). */
function useSpin(initialYaw: number, initialPitch = 0.08) {
  return useRef<Spin>({ yaw: initialYaw, pitch: initialPitch, vYaw: 0, vPitch: 0, targetYaw: null, targetPitch: null });
}

function stepSpin(s: Spin, dt: number, reduced: boolean, idleDrift: number) {
  if (s.targetYaw !== null && s.targetPitch !== null) {
    // Shortest angular path to the target.
    let d = s.targetYaw - s.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const k = reduced ? 1 : 1 - Math.exp(-dt * 4);
    s.yaw += d * k;
    s.pitch += (s.targetPitch - s.pitch) * k;
    s.vYaw = 0;
    s.vPitch = 0;
    return;
  }
  s.yaw += s.vYaw * dt;
  s.pitch = THREE.MathUtils.clamp(s.pitch + s.vPitch * dt, -0.9, 0.9);
  const decay = Math.exp(-dt * 2.6);
  s.vYaw *= decay;
  s.vPitch *= decay;
  if (!reduced && Math.abs(s.vYaw) < 0.02) s.yaw += idleDrift * dt;
}

function Planet({
  kind,
  radius,
  spin,
  children,
  reduced,
  position,
}: {
  kind: 'mars' | 'moon';
  radius: number;
  spin: React.RefObject<Spin>;
  children?: React.ReactNode;
  reduced: boolean;
  position?: THREE.Vector3;
}) {
  const group = useRef<THREE.Group>(null);
  const [map, bump] = useTexture(
    kind === 'mars' ? ['/textures/mars_map.jpg', '/textures/mars_map.jpg'] : ['/textures/moon_map.jpg', '/textures/moon_bump.jpg'],
  );
  useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
  }, [map]);

  useFrame((_, dt) => {
    const s = spin.current;
    if (!group.current || !s) return;
    stepSpin(s, Math.min(dt, 0.05), reduced, kind === 'mars' ? 0.018 : 0.006);
    group.current.rotation.set(s.pitch, s.yaw, 0, 'XYZ');
  });

  return (
    <group position={position}>
      <group ref={group}>
        <mesh>
          <sphereGeometry args={[radius, 128, 96]} />
          <meshStandardMaterial
            map={map}
            bumpMap={bump}
            bumpScale={kind === 'mars' ? 2.2 : 3}
            roughness={kind === 'mars' ? 0.92 : 0.98}
            metalness={0}
          />
        </mesh>
        {children}
      </group>
      {kind === 'mars' && (
        <mesh scale={1.075}>
          <sphereGeometry args={[radius, 64, 48]} />
          <AtmosphereMaterial color="#ff9a5c" sunDir={SUN_DIR} intensity={1.1} power={3.2} />
        </mesh>
      )}
    </group>
  );
}

/** Invisible anchor on the body surface; the DOM beacon is positioned over it by AnchorProjector. */
function BeaconAnchor({ mission, radius }: { mission: MissionData; radius: number }) {
  const local = useMemo(
    () => latLngToVector3(mission.coordinates.lat, mission.coordinates.lng, radius * 1.005),
    [mission, radius],
  );
  return <group position={local} name={`beacon-${mission.id}`} />;
}

function BeaconButton({
  mission,
  onSelect,
  onFocus,
  focused,
  compact,
  elRef,
}: {
  mission: MissionData;
  onSelect: (id: string) => void;
  onFocus?: (id: string | null) => void;
  focused: boolean;
  compact: boolean;
  elRef: (el: HTMLDivElement | null) => void;
}) {
  const label = mission.coordinates.locationName.split(',')[0];
  return (
    <div ref={elRef} className="anchor">
      <div className="beacon-wrap" data-focused={focused || undefined}>
        <button
          type="button"
          className="beacon"
          aria-label={`Issue ${pad2(mission.issueNumber)}: ${mission.issueTitle}, ${mission.coordinates.locationName}. Open issue.`}
          onClick={() => {
            blip('lock');
            onSelect(mission.id);
          }}
          onPointerEnter={() => onFocus?.(mission.id)}
          onPointerLeave={() => onFocus?.(null)}
          onFocus={() => onFocus?.(mission.id)}
          onBlur={() => onFocus?.(null)}
        >
          <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
            <circle cx="24" cy="24" r="17" className="beacon-ring" />
            <circle cx="24" cy="24" r="4" className="beacon-core" />
            <path d="M24 2v9M24 37v9M2 24h9M37 24h9" className="beacon-tick" />
          </svg>
        </button>
        <div className={`beacon-label ${compact ? 'beacon-label--compact' : ''}`} aria-hidden="true">
          <span className="beacon-name">{label}</span>
          <span className="beacon-meta">
            ISSUE {pad2(mission.issueNumber)} · {formatCoord(mission.coordinates.lat, mission.coordinates.lng)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Thin elliptical orbit line, purely decorative (it echoes the reference composition). */
function OrbitLine() {
  const geo = useMemo(() => {
    const pts = new THREE.EllipseCurve(0, 0, 4.4, 3.4, 0, Math.PI * 2).getPoints(256);
    return new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, 0, p.y)));
  }, []);
  return (
    <lineLoop geometry={geo} rotation={[0.42, 0.3, -0.38]}>
      <lineBasicMaterial color="#f6b46b" transparent opacity={0.28} depthWrite={false} />
    </lineLoop>
  );
}

/** Sun light that sweeps the terminator into place on first load. */
function Sun({ reduced }: { reduced: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const t = useRef(reduced ? 1 : 0);
  useFrame((_, dt) => {
    if (!light.current) return;
    t.current = Math.min(1, t.current + dt / 2.4);
    const k = easeInOutCubic(t.current);
    const start = new THREE.Vector3(0.9, 0.2, -0.9).normalize();
    light.current.position.copy(start.lerp(SUN_DIR, k).normalize().multiplyScalar(12));
    light.current.intensity = 0.4 + 2.8 * k;
  });
  return <directionalLight ref={light} color="#fff1dc" intensity={3.2} position={SUN_DIR.clone().multiplyScalar(12)} />;
}

function CameraRig({
  selectedBody,
  marsOffset,
  moonPos: MOON_POS,
  camZ,
  portrait,
  divePoint,
  onDiveDone,
  reduced,
}: {
  selectedBody: 'moon' | 'mars';
  marsOffset: THREE.Vector3;
  moonPos: THREE.Vector3;
  camZ: number;
  portrait: boolean;
  divePoint: React.RefObject<THREE.Vector3 | null>;
  onDiveDone: () => void;
  reduced: boolean;
}) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3());
  const dive = useRef({ t: 0, active: false, from: new THREE.Vector3(), fromLook: new THREE.Vector3(), done: false });
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  useFrame((state, dt) => {
    const d = dive.current;
    const target = divePoint.current;
    if (target && !d.active && !d.done) {
      d.active = true;
      d.t = 0;
      d.from.copy(camera.position);
      d.fromLook.copy(look.current);
    }
    if (!target) {
      d.active = false;
      d.done = false;
    }
    if (d.active && target) {
      d.t = reduced ? 1 : Math.min(1, d.t + dt / dur.cinematic);
      const k = easeInOutCubic(d.t);
      // Stop just above the surface, looking straight down at the beacon.
      const center = selectedBody === 'moon' ? MOON_POS : marsOffset;
      const normal = target.clone().sub(center).normalize();
      const end = target.clone().add(normal.multiplyScalar(0.35));
      camera.position.lerpVectors(d.from, end, k);
      look.current.lerpVectors(d.fromLook, target, k);
      camera.lookAt(look.current);
      if (d.t >= 1) {
        d.active = false;
        d.done = true;
        onDiveDone();
      }
      return;
    }
    if (d.done) return;

    // Idle: slow parallax drift toward the selected body.
    const time = state.clock.elapsedTime;
    const drift = reduced ? 0 : 1;
    const px = pointer.current.x * 0.25 * drift + Math.sin(time * 0.05) * 0.15 * drift;
    const py = -pointer.current.y * 0.18 * drift;
    // Portrait: look below the Moon so it sits in the upper part of the frame, above the headline.
    const mx = portrait ? 0 : -0.3;
    const my = portrait ? -0.62 : -0.05;
    const goal =
      selectedBody === 'moon'
        ? new THREE.Vector3(MOON_POS.x + mx + px * 0.3, MOON_POS.y + my + py * 0.3, MOON_POS.z + (portrait ? 3.4 : 2.4))
        : new THREE.Vector3(px, py, camZ);
    const lookGoal = selectedBody === 'moon' ? new THREE.Vector3(MOON_POS.x + mx, MOON_POS.y + my, MOON_POS.z) : new THREE.Vector3(0, 0, 0);
    const k = reduced ? 1 : 1 - Math.exp(-dt * 2.2);
    camera.position.lerp(goal, k);
    look.current.lerp(lookGoal, k);
    camera.lookAt(look.current);
  });
  return null;
}

function Scene(props: OrbitalGlobeProps & { reduced: boolean; compact: boolean; anchorEls: React.RefObject<Record<string, HTMLElement | null>> }) {
  const { missions, selectedBody, divingTo, onDiveComplete, focusedId, reduced, compact, anchorEls } = props;
  const { size, gl } = useThree();
  const aspect = size.width / size.height;
  const wide = aspect > 1.25;
  // Fit the globe to the frame: on portrait screens pull back so Mars spans ~85% of the width.
  const camZ = Math.max(12.4, (MARS_R / 0.85) / (TAN_HALF_FOV * aspect));
  const halfH = TAN_HALF_FOV * camZ;
  // Wide: Mars sits right of the title lockup. Portrait: upper part of the frame, above the headline.
  const marsOffset = useMemo(
    () => new THREE.Vector3(wide ? 1.05 : -0.25, wide ? -0.15 : -halfH * 0.08, 0),
    [wide, halfH],
  );
  const MOON_POS = useMemo(
    () => marsOffset.clone().add(wide ? new THREE.Vector3(-0.95, 3.2, -1.4) : new THREE.Vector3(1.75, 2.35, -1.4)),
    [marsOffset, wide],
  );

  const mars = missions.filter((m) => m.celestialBody === 'mars');
  const moon = missions.filter((m) => m.celestialBody === 'moon');
  const centerYaw = yawToFace(mars.reduce((a, m) => a + ((m.coordinates.lng + 180) % 360) - 180, 0) / Math.max(1, mars.length));
  const marsSpin = useSpin(centerYaw - 0.5, 0.12);
  const moonSpin = useSpin(yawToFace(moon[0]?.coordinates.lng ?? 0), (moon[0]?.coordinates.lat ?? 0) * (Math.PI / 180));
  const divePoint = useRef<THREE.Vector3 | null>(null);
  const marsGroupRef = useRef<THREE.Group>(null);

  // Rotate the focused mission's site toward the camera.
  useEffect(() => {
    const m = missions.find((x) => x.id === (divingTo ?? focusedId));
    const spin = m?.celestialBody === 'moon' ? moonSpin.current : marsSpin.current;
    for (const s of [marsSpin.current, moonSpin.current]) {
      s.targetYaw = null;
      s.targetPitch = null;
    }
    if (m && spin) {
      spin.targetYaw = yawToFace(m.coordinates.lng);
      spin.targetPitch = THREE.MathUtils.clamp(m.coordinates.lat * (Math.PI / 180), -0.6, 0.6);
    }
  }, [focusedId, divingTo, missions, marsSpin, moonSpin]);

  // Compute the dive target once the site has rotated to face the camera.
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (!divingTo) {
      divePoint.current = null;
      return;
    }
    const m = missions.find((x) => x.id === divingTo);
    if (!m) return;
    const delay = reduced ? 0 : 450;
    const id = window.setTimeout(() => {
      const anchor = scene.getObjectByName(`beacon-${m.id}`);
      const p = new THREE.Vector3();
      anchor?.getWorldPosition(p);
      divePoint.current = p;
    }, delay);
    return () => window.clearTimeout(id);
  }, [divingTo, missions, reduced, scene]);

  // Pointer drag + inertia on the canvas (touch-action keeps vertical page scroll on mobile).
  useEffect(() => {
    const dom = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    const spin = () => (selectedBody === 'moon' ? moonSpin.current : marsSpin.current);
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = performance.now();
      const s = spin();
      s.targetYaw = null;
      s.targetPitch = null;
      dom.style.cursor = 'grabbing';
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const now = performance.now();
      const dt = Math.max(1, now - lastT) / 1000;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const s = spin();
      s.yaw += dx * 0.006;
      s.pitch = THREE.MathUtils.clamp(s.pitch + dy * 0.004, -0.9, 0.9);
      s.vYaw = (dx * 0.006) / dt;
      s.vPitch = (dy * 0.004) / dt;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = now;
    };
    const up = () => {
      dragging = false;
      dom.style.cursor = 'grab';
      const s = spin();
      if (performance.now() - lastT > 80) {
        s.vYaw = 0;
        s.vPitch = 0;
      }
    };
    dom.style.cursor = 'grab';
    dom.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      dom.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [gl, selectedBody, marsSpin, moonSpin]);

  // Keyboard rotation (the canvas wrapper is focusable).
  useEffect(() => {
    const host = gl.domElement.closest<HTMLElement>('[data-globe-host]');
    if (!host) return;
    const key = (e: KeyboardEvent) => {
      const s = selectedBody === 'moon' ? moonSpin.current : marsSpin.current;
      const map: Record<string, [number, number]> = { ArrowLeft: [-1.6, 0], ArrowRight: [1.6, 0], ArrowUp: [0, -1.2], ArrowDown: [0, 1.2] };
      const v = map[e.key];
      if (!v) return;
      e.preventDefault();
      s.targetYaw = null;
      s.targetPitch = null;
      s.vYaw += v[0];
      s.vPitch += v[1];
    };
    host.addEventListener('keydown', key);
    return () => host.removeEventListener('keydown', key);
  }, [gl, selectedBody, marsSpin, moonSpin]);

  return (
    <>
      {/* Transparent clear: the warm space backdrop is CSS (--bg-space) behind the canvas. */}
      <ambientLight intensity={0.05} />
      <Sun reduced={reduced} />
      <Stars radius={70} depth={40} count={compact ? 1200 : 3000} factor={3.2} saturation={0} fade speed={reduced ? 0 : 0.4} />

      <group position={marsOffset} ref={marsGroupRef}>
        <Planet kind="mars" radius={MARS_R} spin={marsSpin} reduced={reduced}>
          {mars.map((m) => (
            <BeaconAnchor key={m.id} mission={m} radius={MARS_R} />
          ))}
        </Planet>
        <OrbitLine />
      </group>

      <Planet kind="moon" radius={MOON_R} spin={moonSpin} reduced={reduced} position={MOON_POS}>
        {moon.map((m) => (
          <BeaconAnchor key={m.id} mission={m} radius={MOON_R} />
        ))}
      </Planet>

      <AnchorProjector els={anchorEls} prefix="beacon-" facing reserveRight={size.width >= 760 ? 380 : 0} />
      <CameraRig
        selectedBody={selectedBody}
        marsOffset={marsOffset}
        moonPos={MOON_POS}
        camZ={camZ}
        portrait={aspect < 0.9}
        divePoint={divePoint}
        reduced={reduced}
        onDiveDone={() => divingTo && onDiveComplete?.(divingTo)}
      />
    </>
  );
}

export default function OrbitalGlobe(props: OrbitalGlobeProps) {
  const reduced = useReducedMotion();
  const [compact] = useState(() => isCoarsePointer() || window.innerWidth < 900);
  const anchorEls = useRef<Record<string, HTMLElement | null>>({});
  return (
    <div className="absolute inset-0" data-globe-host>
      <div
        className="absolute inset-0 outline-none"
        tabIndex={0}
        role="application"
        aria-roledescription="3D globe"
        aria-label="Star chart of Mars and the Moon. Drag or use the arrow keys to rotate. Use Tab to reach the mission beacons."
        style={{ touchAction: 'pan-y' }}
      >
        <Canvas
          dpr={compact ? [1, 1.5] : [1, 2]}
          camera={{ fov: 34, position: [0, 0, 12.4], near: 0.05, far: 200 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => registerRenderer(gl)}
        >
          <Suspense fallback={null}>
            <Scene {...props} reduced={reduced} compact={compact} anchorEls={anchorEls} />
          </Suspense>
        </Canvas>
      </div>
      <div className="anchor-layer">
        {props.missions.map((m) => (
          <BeaconButton
            key={m.id}
            mission={m}
            onSelect={props.onSelectMission}
            onFocus={props.onFocus}
            focused={props.focusedId === m.id}
            compact={compact}
            elRef={(el) => {
              anchorEls.current[m.id] = el;
            }}
          />
        ))}
      </div>
    </div>
  );
}
