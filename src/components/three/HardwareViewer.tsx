import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls, useGLTF } from '@react-three/drei';
import { AnchorProjector } from './AnchorProjector';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { registerRenderer } from '../../lib/debug';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { CelestialBody, HotspotData, SceneConfig, Vec3 } from '../../data/types';
import { dur, easeInOutCubic } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { isCoarsePointer } from '../../lib/device';
import { blip } from '../../lib/audio';
import { useAppStore } from '../../store/useAppStore';
import { Lights, ReflectionEnv, Rocks, Sky, Terrain } from './Environment';
import { ApolloSurfaceProps } from './ApolloProps';

export interface HardwareViewerProps {
  modelPath: string;
  hotspots: HotspotData[];
  onHotspotClick: (id: string) => void;
  /** ext */
  activeHotspot?: string | null;
  scene: SceneConfig;
  missionId: string;
  onBackgroundClick?: () => void;
}

const DRACO = '/draco/';

/**
 * Bakes transforms and merges static meshes that share a material (and attribute
 * layout) into one mesh each. The Apollo LM ships as 134 meshes; this cuts draw calls
 * without touching the asset. Hidden meshes are dropped.
 */
function mergeStatic(root: THREE.Object3D): THREE.Object3D {
  root.updateMatrixWorld(true);
  const buckets = new Map<string, { material: THREE.Material; geos: THREE.BufferGeometry[] }>();
  const keep: THREE.Object3D[] = [];
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    const g = m.geometry.clone().applyMatrix4(m.matrixWorld);
    if (Array.isArray(m.material) || (m as unknown as THREE.SkinnedMesh).isSkinnedMesh) {
      const c = new THREE.Mesh(g, m.material);
      keep.push(c);
      return;
    }
    const key = `${m.material.uuid}|${Object.keys(g.attributes).sort().join(',')}|${g.index ? 'i' : 'n'}`;
    const b = buckets.get(key) ?? { material: m.material, geos: [] };
    b.geos.push(g);
    buckets.set(key, b);
  });
  const out = new THREE.Group();
  for (const { material, geos } of buckets.values()) {
    const merged = geos.length > 1 ? mergeGeometries(geos, false) : geos[0];
    if (merged) out.add(new THREE.Mesh(merged, material));
    else geos.forEach((g) => out.add(new THREE.Mesh(g, material)));
  }
  keep.forEach((k) => out.add(k));
  out.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  return out;
}

/** Loads a GLB, scales it so its largest horizontal extent equals `fitSize`, and sets it on the ground. */
function Model({ path, fitSize, hideAboveY }: { path: string; fitSize: number; hideAboveY?: number }) {
  const { scene } = useGLTF(path, DRACO);
  const object = useMemo(() => {
    const root = scene.clone(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const s = fitSize / Math.max(size.x, size.z);
    root.scale.setScalar(s);
    const b2 = new THREE.Box3().setFromObject(root);
    const c = b2.getCenter(new THREE.Vector3());
    root.position.set(-c.x, -b2.min.y, -c.z);
    root.updateMatrixWorld(true);
    const mb = new THREE.Box3();
    const mc = new THREE.Vector3();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        if (hideAboveY !== undefined) {
          mb.setFromObject(mesh).getCenter(mc);
          if (mc.y > hideAboveY) mesh.visible = false;
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          const std = m as THREE.MeshStandardMaterial;
          if ('envMapIntensity' in std) std.envMapIntensity = 0.8;
        }
      }
    });
    let meshCount = 0;
    root.traverse((o) => void ((o as THREE.Mesh).isMesh && meshCount++));
    return meshCount > 30 ? mergeStatic(root) : root;
  }, [scene, fitSize, hideAboveY]);
  return <primitive object={object} />;
}

function HotspotButton({
  h,
  index,
  active,
  onClick,
  elRef,
}: {
  h: HotspotData;
  index: number;
  active: boolean;
  onClick: (id: string) => void;
  elRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div ref={elRef} className="anchor">
      <div className="hotspot-wrap" data-active={active || undefined}>
        <button
          type="button"
          className="hotspot"
          aria-pressed={active}
          aria-label={`Hotspot ${index + 1}: ${h.label}`}
          onClick={(e) => {
            e.stopPropagation();
            blip('tick');
            onClick(h.id);
          }}
        >
          <span>{String(index + 1).padStart(2, '0')}</span>
        </button>
        <span className="hotspot-label" aria-hidden="true">
          {h.shortLabel ?? h.label}
        </span>
      </div>
    </div>
  );
}

/** Eases the camera to frame a hotspot (or back to the default view), then hands control back to OrbitControls. */
function CameraDirector({
  scene,
  active,
  hotspots,
  reduced,
}: {
  scene: SceneConfig;
  active: string | null;
  hotspots: HotspotData[];
  reduced: boolean;
}) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: OrbitControlsImpl | null };
  const tween = useRef<{ t: number; from: THREE.Vector3; to: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3 } | null>(null);
  const rot = useMemo(() => new THREE.Matrix4().makeRotationY(scene.rotationY), [scene.rotationY]);
  const toWorld = (v: Vec3) => new THREE.Vector3(...v).applyMatrix4(rot);

  useEffect(() => {
    const h = hotspots.find((x) => x.id === active);
    const to = h?.cameraPosition ? toWorld(h.cameraPosition) : new THREE.Vector3(...scene.camera);
    const toT = h ? toWorld(h.position) : new THREE.Vector3(...scene.target);
    tween.current = {
      t: 0,
      from: camera.position.clone(),
      to,
      fromT: controls ? controls.target.clone() : new THREE.Vector3(...scene.target),
      toT,
    };
  }, [active]);

  useFrame((_, dt) => {
    const tw = tween.current;
    if (!tw || !controls) return;
    tw.t = reduced ? 1 : Math.min(1, tw.t + dt / (dur.slow * 1.6));
    const k = easeInOutCubic(tw.t);
    camera.position.lerpVectors(tw.from, tw.to, k);
    controls.target.lerpVectors(tw.fromT, tw.toT, k);
    controls.update();
    if (tw.t >= 1) tween.current = null;
  });
  return null;
}

/**
 * Shift the projection so the hardware sits in the open area of the layout
 * (right of the comic column, above the card row) without moving the orbit target.
 */
function FrameOffset() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const { width: w, height: h } = size;
    if (w / h > 1.2) cam.setViewOffset(w, h, -w * 0.14, h * 0.12, w, h);
    else cam.setViewOffset(w, h, 0, h * 0.05, w, h);
    cam.updateProjectionMatrix();
    return () => {
      cam.clearViewOffset();
    };
  }, [camera, size]);
  return null;
}

/** Slow idle turntable until the user interacts. */
function IdleOrbit({ enabled }: { enabled: boolean }) {
  const { controls } = useThree() as unknown as { controls: OrbitControlsImpl | null };
  useEffect(() => {
    if (!controls) return;
    controls.autoRotate = enabled;
    controls.autoRotateSpeed = 0.35;
  }, [controls, enabled]);
  return null;
}

function Diorama(props: HardwareViewerProps & { reduced: boolean; compact: boolean; anchorEls: React.RefObject<Record<string, HTMLElement | null>> }) {
  const { modelPath, hotspots, activeHotspot, scene, missionId, reduced, compact, anchorEls } = props;
  const body: CelestialBody = scene.environment;
  const [touched, setTouched] = useState(false);
  return (
    <>
      <Sky body={body} />
      <ReflectionEnv body={body} />
      <Lights body={body} shadowSize={compact ? 1024 : 2048} />
      <Terrain body={body} segments={compact ? 120 : 220} />
      <Rocks body={body} count={compact ? 260 : 620} />

      <group rotation-y={scene.rotationY}>
        <Model path={modelPath} fitSize={scene.fitSize} hideAboveY={scene.hideAboveY} />
        {missionId === 'apollo11' && <ApolloSurfaceProps hotspots={hotspots} />}
        {hotspots.map((h) => (
          <group key={h.id} position={h.position} name={`hotspot-${h.id}`} />
        ))}
      </group>
      <ContactShadows
        position={[0, 0.01, 0]}
        scale={scene.fitSize * 2.6}
        blur={body === 'moon' ? 1.2 : 2.6}
        far={1.6}
        opacity={body === 'moon' ? 0.9 : 0.65}
        resolution={compact ? 256 : 512}
        frames={1}
      />

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={scene.fitSize * 0.55}
        maxDistance={scene.fitSize * 3.4}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI / 2 - 0.08}
        target={scene.target}
        onStart={() => setTouched(true)}
      />
      <FrameOffset />
      <AnchorProjector els={anchorEls} prefix="hotspot-" />
      <IdleOrbit enabled={!reduced && !touched && !activeHotspot} />
      <CameraDirector scene={scene} active={activeHotspot ?? null} hotspots={hotspots} reduced={reduced} />
    </>
  );
}

export default function HardwareViewer(props: HardwareViewerProps) {
  const reduced = useReducedMotion();
  const [compact] = useState(() => isCoarsePointer() || window.innerWidth < 900);
  const down = useRef<{ x: number; y: number } | null>(null);
  const anchorEls = useRef<Record<string, HTMLElement | null>>({});
  // Freeze the diorama while a field test is open: the game gets the whole frame budget.
  const paused = useAppStore((s) => s.gamePhase !== 'closed');
  return (
    <div
      className="absolute inset-0"
      onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
      onPointerUp={(e) => {
        const d = down.current;
        down.current = null;
        if (!d || (e.target as HTMLElement).tagName !== 'CANVAS') return;
        if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 5) props.onBackgroundClick?.();
      }}
    >
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        frameloop={paused ? 'never' : 'always'}
        dpr={compact ? [1, 1.5] : [1, 2]}
        camera={{ fov: 35, position: props.scene.camera, near: 0.05, far: 200 }}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMappingExposure: props.scene.environment === 'moon' ? 0.95 : 1.05 }}
        aria-label={`3D model of the ${props.missionId} hardware. Drag to orbit.`}
          onCreated={({ gl }) => registerRenderer(gl)}
      >
        <Suspense fallback={null}>
          <Diorama {...props} reduced={reduced} compact={compact} anchorEls={anchorEls} />
        </Suspense>
      </Canvas>
      <div className="anchor-layer">
        {props.hotspots.map((h, i) => (
          <HotspotButton
            key={h.id}
            h={h}
            index={i}
            active={props.activeHotspot === h.id}
            onClick={props.onHotspotClick}
            elRef={(el) => {
              anchorEls.current[h.id] = el;
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function preloadModel(path: string) {
  useGLTF.preload(path, DRACO);
}
