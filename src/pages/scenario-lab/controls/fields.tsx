import { useId } from 'react';
import { BLOCK_IDS } from '@engine/index.ts';
import type { BlockId, BlockSel } from '@engine/index.ts';
import { clock12 } from '../../../lib/format.ts';

export const TIME_MIN = 420;
export const TIME_MAX = 1560;
const STEP = 15;
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-verified';
export const inputCls = `rounded-md border border-border bg-bg px-2 py-1 text-sm text-text ${focus}`;

const GRID = Array.from({ length: (TIME_MAX - TIME_MIN) / STEP + 1 }, (_, i) => TIME_MIN + i * STEP);

/** 15-minute options, 7:00 AM to 2:00 AM; a value off the grid is kept as an extra option. */
export function timeOptions(current: number, lo = TIME_MIN, hi = TIME_MAX): number[] {
  const base = GRID.filter((v) => v >= lo && v <= hi);
  return base.includes(current) ? base : [...base, current].sort((a, b) => a - b);
}

export function TimeSelect({ label, value, onChange, min = TIME_MIN, max = TIME_MAX, noneLabel, onNone }: {
  label: string; value: number | null; onChange: (v: number) => void; min?: number; max?: number;
  noneLabel?: string; onNone?: () => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="text-xs text-text-2">{label}</label>
      <select id={id} className={inputCls} value={value ?? ''}
        onChange={(e) => (e.target.value === '' ? onNone?.() : onChange(Number(e.target.value)))}>
        {noneLabel && <option value="">{noneLabel}</option>}
        {timeOptions(value ?? min, min, max).map((v) => <option key={v} value={v}>{clock12(v)}</option>)}
      </select>
    </div>
  );
}

/** From/to selects; "to" only offers values after "from". */
export function WindowFields({ fromMin, toMin, onChange }: {
  fromMin: number; toMin: number; onChange: (from: number, to: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <TimeSelect label="From" value={fromMin} max={TIME_MAX - STEP}
        onChange={(v) => onChange(v, toMin > v ? toMin : Math.min(TIME_MAX, v + STEP))} />
      <TimeSelect label="To" value={toMin} min={fromMin + STEP} onChange={(v) => onChange(fromMin, v)} />
    </div>
  );
}

export function Stepper({ label, value, min, max, step = 1, unit, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void;
}) {
  const btn = `h-7 w-7 rounded-md border border-border bg-panel-2 text-text disabled:opacity-40 ${focus}`;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-text-2">{label}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} aria-label={`Decrease ${label}`} disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - step))}>−</button>
        <output className="tabular w-14 text-center text-sm text-text" aria-label={label}>{value}{unit ?? ''}</output>
        <button type="button" className={btn} aria-label={`Increase ${label}`} disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + step))}>+</button>
      </div>
    </div>
  );
}

export function SelectField<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="text-xs text-text-2">{label}</label>
      <select id={id} className={`${inputCls} max-w-[200px]`} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function nextBlocks(sel: BlockSel, b: BlockId): BlockSel {
  if (sel === 'all') return [b];
  const next = sel.includes(b) ? sel.filter((x) => x !== b) : BLOCK_IDS.filter((x) => sel.includes(x) || x === b);
  return next.length === 0 || next.length === BLOCK_IDS.length ? 'all' : next;
}

export function BlockPicker({ value, onChange }: { value: BlockSel; onChange: (v: BlockSel) => void }) {
  const chip = (on: boolean) =>
    `rounded-md border px-2 py-0.5 text-xs ${focus} ${on ? 'border-verified bg-verified/20 text-text' : 'border-border text-text-2'}`;
  return (
    <div role="group" aria-label="Blocks" className="flex flex-wrap items-center gap-1">
      <span className="mr-1 text-xs text-text-2">Blocks</span>
      <button type="button" aria-pressed={value === 'all'} className={chip(value === 'all')} onClick={() => onChange('all')}>All</button>
      {BLOCK_IDS.map((b) => {
        const on = value !== 'all' && value.includes(b);
        return <button key={b} type="button" aria-pressed={on} className={chip(on)} onClick={() => onChange(nextBlocks(value, b))}>{b}</button>;
      })}
    </div>
  );
}
