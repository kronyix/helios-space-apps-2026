let webglCache: boolean | null = null;

/** True when a WebGL2 or WebGL context can be created. `?nowebgl` forces the fallback. */
export function hasWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    if (new URLSearchParams(window.location.search).has('nowebgl')) return (webglCache = false);
    const c = document.createElement('canvas');
    webglCache = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    webglCache = false;
  }
  return webglCache;
}

export const isCoarsePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
export const isSmallScreen = () => typeof window !== 'undefined' && window.innerWidth < 900;
