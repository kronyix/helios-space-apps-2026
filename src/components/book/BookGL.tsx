import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { registerRenderer } from '../../lib/debug';

/**
 * WebGL page-turn leaf. Only the sheet that is turning is drawn here; the pages
 * under it stay live DOM.
 *
 * The sheet is a 48×1 segmented plane bent in the vertex shader (not a rigid hinge).
 * Arc length s runs from the spine (0) to the free edge (W); the local angle is
 * θ(s) = a0 + k·s. The spine leads (a0) and the free edge lags (a1), which gives the
 * paper curl, and both meet at 0 and π. Position is the integral of (cos θ, sin θ),
 * which is closed-form. Lighting comes from the bent normal: a key light plus a
 * sheen that travels across the bend.
 *
 * (The spec suggested a SkinnedMesh with ~30 bones. A per-vertex analytic bend gives
 * the same curve with no skeleton to update and no skinning cost.)
 */
const vert = /* glsl */ `
  uniform float uP;
  uniform float uW;
  uniform float uSide;
  varying vec2 vUv;
  varying vec3 vN;
  varying float vLift;
  void main() {
    float PI = 3.14159265;
    float s = position.x;
    float bump = sin(PI * uP);
    float a0 = PI * clamp(uP + 0.2 * bump, 0.0, 1.0);
    float a1 = PI * clamp(uP - 0.2 * bump, 0.0, 1.0);
    float k = (a1 - a0) / uW;
    float th = a0 + k * s;
    float x; float z;
    if (abs(k) < 1e-6) { x = s * cos(a0); z = s * sin(a0); }
    else { x = (sin(th) - sin(a0)) / k; z = (cos(a0) - cos(th)) / k; }
    vec3 p = vec3(uSide * x, position.y, z);
    vN = normalize(vec3(-uSide * sin(th), 0.0, cos(th)));
    vLift = z / uW;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const frag = /* glsl */ `
  uniform sampler2D uFront;
  uniform sampler2D uBack;
  uniform float uSide;
  varying vec2 vUv;
  varying vec3 vN;
  varying float vLift;
  void main() {
    bool front = gl_FrontFacing;
    if (uSide < 0.0) front = !front;
    // Which way the texture runs depends on which side of the spine that page sat.
    bool direct = (front == (uSide > 0.0));
    vec2 uv = vec2(direct ? vUv.x : 1.0 - vUv.x, vUv.y);
    vec4 c = front ? texture2D(uFront, uv) : texture2D(uBack, uv);
    vec3 n = normalize(gl_FrontFacing ? vN : -vN);
    vec3 L = normalize(vec3(-0.35, 0.45, 1.0));
    float diff = 0.72 + 0.28 * max(dot(n, L), 0.0);
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    float sheen = pow(max(dot(n, H), 0.0), 28.0) * 0.18;
    c.rgb = c.rgb * diff + sheen;
    // Cream paper edge glints faintly as the sheet lifts.
    c.rgb += vec3(0.04, 0.03, 0.01) * clamp(vLift * 2.0, 0.0, 1.0);
    gl_FragColor = vec4(c.rgb, 1.0);
    #include <colorspace_fragment>
  }
`;

export interface LeafState {
  /** 0..1 progress of the sheet from its start side to the other side */
  p: number;
  /** +1: sheet hinged on its left edge (right-hand page); −1: hinged on its right edge */
  side: 1 | -1;
  front: THREE.Texture;
  back: THREE.Texture;
  /** spine x in px from the overlay's left edge */
  spineX: number;
  /** fades the sheet out (single-page mode, when it leaves the page) */
  opacity: number;
}

function Sheet({ leafRef, pageW, pageH, overlayW, overlayH }: { leafRef: React.RefObject<LeafState | null>; pageW: number; pageH: number; overlayW: number; overlayH: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(pageW, pageH, 48, 1);
    g.translate(pageW / 2, 0, 0); // spine at x = 0
    return g;
  }, [pageW, pageH]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        side: THREE.DoubleSide,
        transparent: true,
        uniforms: {
          uP: { value: 0 },
          uW: { value: pageW },
          uSide: { value: 1 },
          uFront: { value: null },
          uBack: { value: null },
        },
      }),
    [pageW],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const leaf = leafRef.current;
    m.visible = !!leaf;
    if (!leaf) return;
    const u = material.uniforms;
    u.uP.value = leaf.p;
    u.uSide.value = leaf.side;
    u.uFront.value = leaf.front;
    u.uBack.value = leaf.back;
    material.opacity = leaf.opacity;
    // Overlay pixel space → world (camera centred, z = 0 plane maps 1:1 to CSS px).
    m.position.set(leaf.spineX - overlayW / 2, 0, 0);
  });
  // Height is 1:1, so only the overlay height matters for the camera; keep it in deps.
  void overlayH;
  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} />;
}

function PixelCamera({ h }: { h: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = 30;
    cam.position.set(0, 0, h / 2 / Math.tan((15 * Math.PI) / 180));
    cam.near = 1;
    cam.far = cam.position.z * 4;
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
  }, [camera, h]);
  return null;
}

export default function BookGL({
  leafRef,
  active,
  pageW,
  pageH,
  overlayW,
  overlayH,
}: {
  /** read every frame (progress is updated outside React) */
  leafRef: React.RefObject<LeafState | null>;
  active: boolean;
  pageW: number;
  pageH: number;
  overlayW: number;
  overlayH: number;
}) {
  return (
    <Canvas
      className="book-gl"
      flat
      dpr={[1, 2]}
      frameloop={active ? 'always' : 'demand'}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 30, position: [0, 0, 1000] }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        registerRenderer(gl);
      }}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-hidden="true"
    >
      <PixelCamera h={overlayH} />
      {active && <Sheet leafRef={leafRef} pageW={pageW} pageH={pageH} overlayW={overlayW} overlayH={overlayH} />}
    </Canvas>
  );
}
