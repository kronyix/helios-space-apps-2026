import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Rim-lit atmosphere shell (render on a slightly larger back-faced sphere).
 * Brighter on the sun side so the terminator reads through the haze.
 */
export function AtmosphereMaterial({
  color,
  sunDir,
  intensity = 1,
  power = 3,
}: {
  color: string;
  sunDir: THREE.Vector3;
  intensity?: number;
  power?: number;
}) {
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(color) },
      uSun: { value: sunDir.clone() },
      uIntensity: { value: intensity },
      uPower: { value: power },
    }),
    [color, sunDir, intensity, power],
  );
  return (
    <shaderMaterial
      side={THREE.BackSide}
      transparent
      depthWrite={false}
      blending={THREE.AdditiveBlending}
      uniforms={uniforms}
      vertexShader={/* glsl */ `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vNormal = normalize(mat3(modelMatrix) * normal);
          vView = normalize(cameraPosition - wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `}
      fragmentShader={/* glsl */ `
        uniform vec3 uColor;
        uniform vec3 uSun;
        uniform float uIntensity;
        uniform float uPower;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float rim = pow(clamp(1.0 + dot(vView, vNormal), 0.0, 1.0), uPower);
          float lit = smoothstep(-0.35, 0.6, dot(vNormal, uSun));
          float a = rim * (0.15 + 0.85 * lit) * uIntensity;
          gl_FragColor = vec4(uColor * a, a);
        }
      `}
    />
  );
}

/** Vertical sky gradient for diorama backgrounds (rendered on a large inward sphere). */
export function SkyMaterial({ top, horizon, sunDir, sunColor }: { top: string; horizon: string; sunDir: THREE.Vector3; sunColor: string }) {
  const uniforms = useMemo(
    () => ({
      uTop: { value: new THREE.Color(top) },
      uHorizon: { value: new THREE.Color(horizon) },
      uSun: { value: sunDir.clone().normalize() },
      uSunColor: { value: new THREE.Color(sunColor) },
    }),
    [top, horizon, sunDir, sunColor],
  );
  return (
    <shaderMaterial
      side={THREE.BackSide}
      depthWrite={false}
      fog={false}
      uniforms={uniforms}
      vertexShader={/* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `}
      fragmentShader={/* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uSun;
        uniform vec3 uSunColor;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.55, h));
          float s = max(dot(normalize(vDir), uSun), 0.0);
          col += uSunColor * (pow(s, 24.0) * 0.6 + pow(s, 4.0) * 0.12);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `}
    />
  );
}
