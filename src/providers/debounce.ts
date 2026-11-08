/** Trailing-edge debounce: runs `fn` once, `ms` after the last call. `cancel()` drops a pending run. */
export function debounce(fn: () => void, ms: number): (() => void) & { cancel(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { timer = undefined; fn(); }, ms);
  };
  debounced.cancel = () => { clearTimeout(timer); timer = undefined; };
  return debounced;
}
