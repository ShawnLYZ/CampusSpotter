import type { BaselineTableName } from '../_shared/bundle.ts';
import { validateBaselineCsv } from '../_shared/bundle.ts';
import { HttpError, json, readJson } from '../_shared/http.ts';
import { serveRequest } from '../_shared/request.ts';
import type { PersistDeps } from '../forecast-save/handler.ts';

const TABLES: BaselineTableName[] = ['baseline_values', 'rooms', 'cafeteria_outlets', 'energy_profiles', 'waiting_halls'];
const MAX_CSV_BYTES = 1_000_000;
/** The column holding the verified/baseline label, per table. */
const LABEL_COLUMN: Record<BaselineTableName, string> = {
  baseline_values: 'label', rooms: 'seats_label', cafeteria_outlets: 'label', energy_profiles: 'label', waiting_halls: 'label',
};
interface Body { table?: unknown; csv?: unknown; markVerified?: unknown }

export function handle(req: Request, deps: PersistDeps): Promise<Response> {
  return serveRequest(req, deps.repo, async (caller) => {
    if (caller.role !== 'manager') throw new HttpError(403, 'only managers can import baseline data');
    const { table, csv, markVerified } = (await readJson<Body>(req)) ?? {};
    if (typeof table !== 'string' || !TABLES.includes(table as BaselineTableName)) throw new HttpError(400, 'unknown table');
    if (typeof csv !== 'string') throw new HttpError(400, 'csv is required');
    if (new TextEncoder().encode(csv).length > MAX_CSV_BYTES) throw new HttpError(400, 'csv is larger than 1 MB');
    const name = table as BaselineTableName;

    const existing = (await deps.repo.rows.select('baseline_values')) as { key: string; source_id: string }[];
    const { rows, errors } = validateBaselineCsv(name, csv, { existingKeys: existing.map((r) => r.key) });
    if (errors.length > 0) return json({ ok: false, applied: false, rowCount: rows.length, errors });
    if (rows.length === 0) {
      return json({ ok: false, applied: false, rowCount: 0, errors: [{ row: 1, column: null, message: 'The file has no data rows' }] });
    }

    const label = markVerified === true ? 'verified' : 'baseline';
    const labelled = rows.map((r) => ({ ...r, [LABEL_COLUMN[name]]: label }));
    if (name === 'baseline_values') {
      // source_id is NOT NULL and not in the CSV, so carry it over from the existing row.
      const sources = new Map(existing.map((r) => [r.key, r.source_id]));
      await deps.repo.upsertBaselineValues(
        labelled.map((r) => ({ ...r, source_id: sources.get(r.key as string) })) as never,
        caller.userId,
      );
    } else {
      await deps.repo.replaceTable(name as Exclude<BaselineTableName, 'baseline_values'>, labelled);
    }
    return json({ ok: true, applied: true, rowCount: rows.length, errors: [] });
  });
}
