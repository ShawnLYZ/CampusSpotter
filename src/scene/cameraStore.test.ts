import { describe, expect, it } from 'vitest';
import { useCameraStore } from './cameraStore.ts';

describe('cameraStore.release', () => {
  it('clears the active view only when it is the released view, keeping the pose', () => {
    const s = useCameraStore.getState();
    s.setPose([1, 2, 3], [0, 0, 0], 1);
    useCameraStore.getState().release(0);
    expect(useCameraStore.getState().activeView).toBe(1);
    useCameraStore.getState().release(1);
    expect(useCameraStore.getState().activeView).toBeNull();
    expect(useCameraStore.getState().position).toEqual([1, 2, 3]);
  });
});
