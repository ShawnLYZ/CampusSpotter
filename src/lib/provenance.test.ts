import { describe, expect, it } from 'vitest';
import { concert4Nov } from '@fixtures/engine/index.ts';
import { describeInputs } from './provenance.ts';

describe('describeInputs', () => {
  it('describes an AI estimate with reasoning and range', async () => {
    const b = await concert4Nov();
    const d = describeInputs(['estimate:attendanceDrop:weeknd-2026-11-04'], b)[0];
    expect(d.label).toBe('ai');
    expect(d.reasoning).toContain('stayed away');
    expect(d.range).toBe('0.2–0.5 share');
  });
  it('describes a baseline field', async () => {
    const b = await concert4Nov();
    expect(describeInputs(['baseline:fleetSize'], b)[0].label).toBe('baseline');
  });
  it('titles the reconstructed road series', async () => {
    const b = await concert4Nov();
    expect(describeInputs(['road:reconstructed'], b)[0].title).toBe('Road delay (4 Nov reconstruction)');
  });
});

describe('describeInputs hall and unknown ids', () => {
  it('resolves a waiting hall with its real label and name', async () => {
    const b = await concert4Nov();
    const h = b.baseline.waitingHalls[0];
    const d = describeInputs([`hall:${h.id}`], b)[0];
    expect(d.title).toContain(h.name);
    expect(d.label).toBe(h.loadKw.label);
    expect(d.source).toBe(h.loadKw.sourceId);
  });
  it('flags unrecognised ids', async () => {
    const b = await concert4Nov();
    const d = describeInputs(['mystery:thing'], b)[0];
    expect(d.title).toBe('Unrecognised input (mystery:thing)');
    expect(d.source).toBe('unknown');
  });
  it('describes a block energy profile', async () => {
    const b = await concert4Nov();
    const d = describeInputs(['energy:A'], b)[0];
    expect(d.title).toBe('Energy profile, Block A');
    expect(d.source).not.toBe('unknown');
    expect(['verified', 'baseline', 'ai']).toContain(d.label);
  });
});
