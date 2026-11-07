export interface KeyLike { key: string; altKey: boolean; shiftKey: boolean; repeat?: boolean; target: { tagName?: string } | null }

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Alt+Shift+P always toggles; the other keys only count while presenter mode is on. Nothing fires while typing or on auto-repeat. */
export function shouldHandleKey(e: KeyLike, active: boolean): 'toggle' | 'next' | 'prev' | 'exit' | null {
  if (e.repeat) return null;
  if (e.target?.tagName && TYPING.has(e.target.tagName.toUpperCase())) return null;
  if (e.altKey && e.shiftKey && e.key.toLowerCase() === 'p') return 'toggle';
  if (!active || e.altKey) return null;
  if (e.key === 'ArrowRight' || e.key === ' ') return 'next';
  if (e.key === 'ArrowLeft') return 'prev';
  if (e.key === 'Escape') return 'exit';
  return null;
}
