import { describe, expect, it, vi } from 'vitest';
import { validateLevers } from '@engine/index.ts';
import { createDemoProvider } from '../providers/demo/createDemoProvider.ts';
import { SCRIPTED_ASKS } from '../providers/demo/scripted/ask.ts';
import { applyStep, type ApplyDeps } from './applyStep.ts';
import { createPresenterBus } from './bus.ts';
import { PRESENTER_STEPS } from './script.ts';

const REGISTERED = ['/', '/early-warning', '/scenario-lab', '/action-plans', '/action-plans/log', '/replay', '/data'];

describe('presenter script', () => {
  it('has seven steps on registered routes', () => {
    expect(PRESENTER_STEPS).toHaveLength(7);
    for (const st of PRESENTER_STEPS) expect(REGISTERED).toContain(st.route);
    expect(PRESENTER_STEPS.map((x) => x.id)).toEqual(
      ['command-center', 'early-warning', 'replay', 'scenario-lab-4nov', 'action-plans', 'friday', 'data']);
  });

  it('every lab.ask refers to a scripted ask', () => {
    const ids = new Set(SCRIPTED_ASKS.map((a) => a.id));
    for (const st of PRESENTER_STEPS) for (const { action } of st.actions) if (action.type === 'lab.ask') expect(ids.has(action.askId)).toBe(true);
  });

  it('step levers validate without warnings', async () => {
    const provider = createDemoProvider({ latencyMs: [0, 0] });
    for (const st of PRESENTER_STEPS) {
      const bundle = await provider.getInputBundle(st.ctx);
      expect(validateLevers(st.levers, bundle).warnings, st.id).toEqual([]);
    }
  });
});

function fakeDeps() {
  const timers: { ms: number; fn: () => void; cancelled: boolean }[] = [];
  const emit = vi.fn();
  const deps: ApplyDeps = {
    navigate: vi.fn(), setCtx: vi.fn(), setLevers: vi.fn(), setStep: vi.fn(), setRange: vi.fn(), goTo: vi.fn(), emit, reset: vi.fn(),
    schedule: (ms, fn) => { const t = { ms, fn, cancelled: false }; timers.push(t); return () => { t.cancelled = true; }; },
  };
  const fire = () => { for (const t of timers) if (!t.cancelled) t.fn(); };
  return { deps, timers, emit, fire };
}

describe('applyStep', () => {
  it('applies the step state and schedules its actions', () => {
    const { deps, timers, emit, fire } = fakeDeps();
    applyStep(PRESENTER_STEPS[2], deps);
    expect(deps.navigate).toHaveBeenCalledWith('/replay');
    expect(deps.setCtx).toHaveBeenCalledWith(PRESENTER_STEPS[2].ctx);
    expect(deps.setStep).toHaveBeenCalledWith(20);
    expect(deps.goTo).toHaveBeenCalledWith('overview');
    expect(timers.map((t) => t.ms)).toContain(5000);
    fire();
    expect(emit.mock.calls.map((c) => (c[0] as { type: string }).type)).toEqual(['replay.milestone', 'replay.milestone', 'replay.play']);
  });

  it('cancel stops every pending action (Review Focus 1)', () => {
    const { deps, emit, fire } = fakeDeps();
    const cancel = applyStep(PRESENTER_STEPS[2], deps);
    cancel();
    fire();
    expect(emit).not.toHaveBeenCalled();
  });

  it('cancel also resets the bus so page-level typing and choosing stop', () => {
    const { deps } = fakeDeps();
    const cancel = applyStep(PRESENTER_STEPS[3], deps);
    expect(deps.reset).toHaveBeenCalledTimes(1);
    cancel();
    expect(deps.reset).toHaveBeenCalledTimes(2);
  });
});

describe('presenter bus', () => {
  it('delivers to current subscribers and unsubscribes', () => {
    const bus = createPresenterBus();
    const h = vi.fn();
    const off = bus.on('data.tab', h);
    bus.emit({ type: 'data.tab', tab: 'rules' });
    off();
    bus.emit({ type: 'data.tab', tab: 'privacy' });
    expect(h).toHaveBeenCalledTimes(1);
    expect(h).toHaveBeenCalledWith({ type: 'data.tab', tab: 'rules' });
  });

  it('holds an action emitted before its page mounted and delivers it once to the late subscriber', () => {
    const bus = createPresenterBus();
    bus.emit({ type: 'data.tab', tab: 'sources' });
    const h = vi.fn();
    bus.on('data.tab', h);
    expect(h).toHaveBeenCalledWith({ type: 'data.tab', tab: 'sources' });
    const h2 = vi.fn();
    bus.on('data.tab', h2);
    expect(h2).not.toHaveBeenCalled();
  });

  it('reset drops undelivered actions and notifies cancel listeners', () => {
    const bus = createPresenterBus();
    const c = vi.fn();
    bus.onCancel(c);
    bus.emit({ type: 'data.tab', tab: 'sources' });
    bus.reset();
    const h = vi.fn();
    bus.on('data.tab', h);
    expect(h).not.toHaveBeenCalled();
    expect(c).toHaveBeenCalledTimes(1);
  });
});
