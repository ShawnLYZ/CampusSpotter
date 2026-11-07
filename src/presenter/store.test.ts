import { beforeEach, describe, expect, it } from 'vitest';
import { useLeverStore } from '../store/levers.ts';
import { usePresenterStore } from './store.ts';

const s = () => usePresenterStore.getState();

describe('presenter store', () => {
  beforeEach(() => { usePresenterStore.setState({ active: false, index: 0 }); useLeverStore.getState().reset(); });

  it('toggle from inactive starts at step 1', () => {
    s().toggle();
    expect(s().active).toBe(true);
    expect(s().index).toBe(0);
  });

  it('next and prev clamp to 0..6', () => {
    s().toggle();
    for (let i = 0; i < 10; i++) s().next();
    expect(s().index).toBe(6);
    for (let i = 0; i < 10; i++) s().prev();
    expect(s().index).toBe(0);
  });

  it('re-entering after Escape restarts at step 1 with default levers (Review Focus 3)', () => {
    s().toggle();
    for (let i = 0; i < 5; i++) s().next();
    useLeverStore.getState().setLevers([{ kind: 'acOffInGap', fromMin: 765, toMin: 870, blocks: 'all' }], ['acOffInGap']);
    s().exit();
    expect(s().active).toBe(false);
    expect(useLeverStore.getState().levers).toEqual([]);
    expect(useLeverStore.getState().highlighted).toEqual([]);
    s().toggle();
    expect(s().active).toBe(true);
    expect(s().index).toBe(0);
  });

  it('toggle while active exits', () => {
    s().toggle(); s().next(); s().toggle();
    expect(s().active).toBe(false);
    s().toggle();
    expect(s().index).toBe(0);
  });
});
