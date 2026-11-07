import { beforeEach, describe, expect, it } from 'vitest';
import { useContextStore } from './context.ts';

describe('context store normalisation (R14)', () => {
  beforeEach(() => useContextStore.setState({ ctx: { date: '' } }));

  it('setCtx sets reconstructed only for the 4 Nov reconstruction', () => {
    useContextStore.getState().setCtx({ date: '2026-11-04', disruptionId: 'weeknd-2026-11-04' });
    expect(useContextStore.getState().ctx.reconstructed).toBe(true);
    useContextStore.getState().setCtx({ date: '2026-11-04', disruptionId: 'other', reconstructed: true });
    expect(useContextStore.getState().ctx.reconstructed).toBeFalsy();
    useContextStore.getState().setCtx({ date: '2026-11-05', disruptionId: 'weeknd-2026-11-04', reconstructed: true });
    expect(useContextStore.getState().ctx.reconstructed).toBeFalsy();
  });

  it('setDate and setDisruption keep it consistent', () => {
    const s = useContextStore.getState();
    s.setDate('2026-11-04');
    s.setDisruption('weeknd-2026-11-04');
    expect(useContextStore.getState().ctx.reconstructed).toBe(true);
    useContextStore.getState().setDate('2026-11-05');
    expect(useContextStore.getState().ctx).toEqual({ date: '2026-11-05' });
    useContextStore.getState().setDate('2026-11-04');
    useContextStore.getState().setDisruption(null);
    expect(useContextStore.getState().ctx.reconstructed).toBeFalsy();
  });
});
