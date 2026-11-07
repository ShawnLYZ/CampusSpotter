import { useEffect, useRef } from 'react';
import { useProvider } from '../app/ProviderContext.tsx';
import type { Channel } from '../providers/types.ts';

export function useSubscription(channel: Channel, handler: () => void): void {
  const provider = useProvider();
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => provider.subscribe(channel, () => ref.current()), [provider, channel]);
}
