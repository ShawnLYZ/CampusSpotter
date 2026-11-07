type ProbeContext = { getExtension?: (name: string) => { loseContext?: () => void } | null } | null;

/**
 * Whether this browser can create a WebGL context (webgl2, else webgl). False without a document
 * and when context creation throws or returns null. The probe context is released straight away.
 * Not memoised; callers evaluate it once (see `SceneSlot`).
 */
export function hasWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as ProbeContext;
    if (!gl) return false;
    gl.getExtension?.('WEBGL_lose_context')?.loseContext?.();
    return true;
  } catch {
    return false;
  }
}
