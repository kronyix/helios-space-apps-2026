import type { WebGLRenderer } from 'three';

/**
 * Exposes the active renderer as window.__heliosGL so review tooling can read
 * renderer.info (draw calls, geometries, textures). Read-only; no UI effect.
 */
export function registerRenderer(gl: WebGLRenderer) {
  (window as unknown as { __heliosGL?: WebGLRenderer }).__heliosGL = gl;
}
