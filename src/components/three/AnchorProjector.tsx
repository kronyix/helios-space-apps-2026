import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Positions ordinary React DOM elements (rendered outside the canvas) over named
 * 3D objects. Replaces drei <Html>, whose per-element React roots crash when
 * unmounted mid-transition. Objects are looked up by `${prefix}${id}`.
 *
 * With `facing`, an anchor fades out as it turns to the far side of its parent
 * body (normal = anchor position minus parent's world position).
 */
export function AnchorProjector({
  els,
  prefix,
  facing = false,
}: {
  els: React.RefObject<Record<string, HTMLElement | null>>;
  prefix: string;
  facing?: boolean;
}) {
  const { camera, scene, size } = useThree();
  const cache = useRef<Record<string, THREE.Object3D | undefined>>({});
  const v = useMemo(() => ({ p: new THREE.Vector3(), o: new THREE.Vector3(), n: new THREE.Vector3(), c: new THREE.Vector3() }), []);

  useFrame(() => {
    const map = els.current;
    if (!map) return;
    for (const id in map) {
      const el = map[id];
      if (!el) continue;
      let obj = cache.current[id];
      if (!obj || !obj.parent) obj = cache.current[id] = scene.getObjectByName(prefix + id);
      if (!obj) {
        el.style.visibility = 'hidden';
        continue;
      }
      obj.getWorldPosition(v.p);
      let vis = 1;
      if (facing && obj.parent) {
        obj.parent.getWorldPosition(v.o);
        v.n.copy(v.p).sub(v.o).normalize();
        v.c.copy(camera.position).sub(v.p).normalize();
        vis = THREE.MathUtils.smoothstep(v.n.dot(v.c), 0.05, 0.3);
      }
      v.p.project(camera);
      if (v.p.z > 1) vis = 0;
      const x = ((v.p.x + 1) / 2) * size.width;
      const y = ((1 - v.p.y) / 2) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = String(vis);
      el.style.visibility = vis < 0.01 ? 'hidden' : 'visible';
      el.style.pointerEvents = vis > 0.5 ? 'auto' : 'none';
    }
  });
  return null;
}
