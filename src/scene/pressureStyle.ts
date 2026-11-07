import type { Pressure, StepStatus } from '@engine/output.ts';

export interface PressureStyle { color: string; glow: number; tintOpacity: number; text: string; icon: string }

const BY_PRESSURE: Record<Pressure, PressureStyle> = {
  green: { color: '#22c55e', glow: 0.35, tintOpacity: 0.12, text: 'Normal', icon: '●' },
  amber: { color: '#f59e0b', glow: 0.7, tintOpacity: 0.2, text: 'Busy', icon: '▲' },
  red: { color: '#ef4444', glow: 1.0, tintOpacity: 0.28, text: 'Overloaded', icon: '■' },
};
const NO_SERVICE: PressureStyle = { color: '#64748b', glow: 0.15, tintOpacity: 0.08, text: 'No service', icon: '○' };
const NO_DATA: PressureStyle = { color: '#64748b', glow: 0.15, tintOpacity: 0.08, text: 'Not enough data', icon: '?' };
const NONE: PressureStyle = { color: '#000000', glow: 0, tintOpacity: 0, text: '', icon: '' };

/** Colour, glow and label words for a zone's pressure. Missing data is grey, never green. */
export function pressureStyle(p: Pressure | null, status: StepStatus): PressureStyle {
  if (status === 'no_service') return NO_SERVICE;
  if (status === 'not_enough_data') return NO_DATA;
  return p ? BY_PRESSURE[p] : NONE;
}
