export type PresenterAction =
  | { type: 'lab.ask'; askId: string }
  | { type: 'plans.generate'; budgetRm: number; chooseIndex: number | null; chooseAfterMs: number }
  | { type: 'replay.milestone'; id: 'jun3' | 'oct21' | 'nov3' | 'nov4' }
  | { type: 'replay.play'; from: number; to: number; speed: 1 | 4 | 16 }
  | { type: 'data.tab'; tab: 'sources' | 'baseline' | 'estimates' | 'rules' | 'privacy' };

export type ActionOf<T extends PresenterAction['type']> = Extract<PresenterAction, { type: T }>;
type Handler<T extends PresenterAction['type']> = (a: ActionOf<T>) => void;

export interface PresenterBus {
  emit(a: PresenterAction): void;
  /** Subscribe to one action type. An action emitted while nobody listened is delivered, once, to the first subscriber. */
  on<T extends PresenterAction['type']>(type: T, handler: Handler<T>): () => void;
  /** Called by `reset`: pages stop any typing or delayed choosing they started for the old step. */
  onCancel(handler: () => void): () => void;
  /** Drop undelivered actions and tell pages to cancel their own timers. Called at every step change. */
  reset(): void;
}

/**
 * Navigation is async, so an action at atMs 0 can fire before its page has mounted. Such an action is held
 * (latest per type) and handed to the page when it subscribes; `reset` clears it at the next step.
 */
export function createPresenterBus(): PresenterBus {
  const handlers = new Map<PresenterAction['type'], Set<(a: PresenterAction) => void>>();
  const cancels = new Set<() => void>();
  const pending = new Map<PresenterAction['type'], PresenterAction>();
  return {
    emit(a) {
      const set = handlers.get(a.type);
      if (!set || set.size === 0) { pending.set(a.type, a); return; }
      for (const h of [...set]) h(a);
    },
    on(type, handler) {
      const h = handler as (a: PresenterAction) => void;
      let set = handlers.get(type);
      if (!set) { set = new Set(); handlers.set(type, set); }
      set.add(h);
      const held = pending.get(type);
      if (held) { pending.delete(type); h(held); }
      return () => { set.delete(h); };
    },
    onCancel(handler) {
      cancels.add(handler);
      return () => { cancels.delete(handler); };
    },
    reset() {
      pending.clear();
      for (const c of [...cancels]) c();
    },
  };
}

export const presenterBus: PresenterBus = createPresenterBus();
