import type { Channel } from '../types.ts';

export function createEmitter(): { on(channel: Channel, h: () => void): () => void; emit(channel: Channel): void } {
  const handlers = new Map<Channel, Set<() => void>>();
  return {
    on(channel, h) {
      const set = handlers.get(channel) ?? new Set<() => void>();
      set.add(h);
      handlers.set(channel, set);
      return () => { set.delete(h); };
    },
    emit(channel) {
      for (const h of [...(handlers.get(channel) ?? [])]) h();
    },
  };
}
