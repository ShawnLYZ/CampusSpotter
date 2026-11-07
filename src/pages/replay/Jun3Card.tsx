import { useEffect, useState } from 'react';
import { useProvider } from '../../app/ProviderContext.tsx';
import { dateText } from '../../lib/format.ts';
import type { EarlyWarningItem } from '../../providers/types.ts';
import { WarningCard } from '../early-warning/WarningCard.tsx';
import { buildJun3Card } from './replayData.ts';

export function Jun3Card() {
  const provider = useProvider();
  const [item, setItem] = useState<EarlyWarningItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    buildJun3Card(provider).then(
      (i) => { if (!cancelled) setItem(i); },
      (e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); },
    );
    return () => { cancelled = true; };
  }, [provider]);
  return (
    <section aria-label="Early warning on 3 Jun">
      <h2 className="mb-3 text-lg font-semibold">As it would have looked on {dateText('2026-06-03')}</h2>
      {error && <p role="alert" className="text-text-2">Could not build the card: {error}</p>}
      {!item && !error && <p role="status" className="text-text-2">Loading…</p>}
      {item && <ul><WarningCard item={item} readOnly /></ul>}
      <p className="mt-2 text-xs text-text-2">Risk and peaks are reconstructed estimates.</p>
    </section>
  );
}
