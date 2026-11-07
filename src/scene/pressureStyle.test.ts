import { describe, expect, it } from 'vitest';
import { pressureStyle } from './pressureStyle.ts';
import { pressureText } from '../lib/format.ts';

describe('pressureStyle', () => {
  it('green', () => {
    expect(pressureStyle('green', 'ok')).toEqual({ color: '#22c55e', glow: 0.35, tintOpacity: 0.12, text: 'Normal', icon: '●' });
  });
  it('amber', () => {
    expect(pressureStyle('amber', 'ok')).toEqual({ color: '#f59e0b', glow: 0.7, tintOpacity: 0.2, text: 'Busy', icon: '▲' });
  });
  it('red', () => {
    expect(pressureStyle('red', 'ok')).toEqual({ color: '#ef4444', glow: 1.0, tintOpacity: 0.28, text: 'Overloaded', icon: '■' });
  });
  it('no_service is grey, never green', () => {
    expect(pressureStyle(null, 'no_service')).toEqual({ color: '#64748b', glow: 0.15, tintOpacity: 0.08, text: 'No service', icon: '○' });
  });
  it('not_enough_data is grey, never green', () => {
    expect(pressureStyle(null, 'not_enough_data')).toEqual({ color: '#64748b', glow: 0.15, tintOpacity: 0.08, text: 'Not enough data', icon: '?' });
  });
  it('no metrics has no glow, tint or text', () => {
    expect(pressureStyle(null, 'ok')).toEqual({ color: '#000000', glow: 0, tintOpacity: 0, text: '', icon: '' });
  });
  it('text matches pressureText', () => {
    for (const p of ['green', 'amber', 'red'] as const) expect(pressureStyle(p, 'ok').text).toBe(pressureText(p));
  });
});
