import { useCallback, useEffect, useState } from 'react';
import { addDays, mytDate } from '../../lib/dates.ts';
import { dateText } from '../../lib/format.ts';
import { useProvider } from '../../app/ProviderContext.tsx';
import { useContextStore } from '../../store/context.ts';
import { useSubscription } from '../../hooks/useSubscription.ts';
import type { EarlyWarningItem, Today } from '../../providers/types.ts';

const field = 'rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-verified';

export function ContextPicker({ today }: { today: Today | null }) {
  const provider = useProvider();
  const ctx = useContextStore((s) => s.ctx);
  const setDate = useContextStore((s) => s.setDate);
  const setCtx = useContextStore((s) => s.setCtx);
  const [items, setItems] = useState<EarlyWarningItem[]>([]);

  const load = useCallback(() => {
    if (!today) return;
    // A week of past days is included so the 4 Nov concert reconstruction stays reachable.
    void provider.listDisruptions({ from: addDays(today.date, -7), to: addDays(today.date, 180), includePast: true }).then(setItems);
  }, [provider, today]);
  useEffect(load, [load]);
  useSubscription('disruptions', load);

  return (
    <div className="flex items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="ctx-date" className="text-xs text-text-2">Date</label>
        <input id="ctx-date" type="date" className={field} value={ctx.date}
          onChange={(e) => { if (e.target.value) setDate(e.target.value); }} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="ctx-disruption" className="text-xs text-text-2">Disruption</label>
        <select id="ctx-disruption" className={`${field} w-[320px]`} value={ctx.disruptionId ?? ''}
          onChange={(e) => {
            const item = items.find((i) => i.id === e.target.value);
            if (item) setCtx({ date: mytDate(item.startAt), disruptionId: item.id });
            else setDate(ctx.date);
          }}>
          <option value="">No disruption</option>
          {items.map((i) => <option key={i.id} value={i.id}>{dateText(mytDate(i.startAt))} · {i.title}</option>)}
        </select>
      </div>
    </div>
  );
}
