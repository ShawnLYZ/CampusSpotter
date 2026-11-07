import type { DisruptionRow } from '@bundle/rows.ts';
import { providerContract } from '../contract.ts';
import { createDemoProvider } from './createDemoProvider.ts';

providerContract('demo', async () => {
  const provider = createDemoProvider({ latencyMs: [0, 0] });
  let n = 0;
  return {
    provider,
    capabilities: { roles: false },
    seedScanItem: async (input) => {
      const id = `scan-contract-${++n}`;
      const row: DisruptionRow = {
        id, title: input.title, type: input.type, kind: input.kind, venue: input.venue, start_at: input.startAt, end_at: input.endAt,
        expected_attendance: input.expectedAttendance, attendance_label: 'ai', origin: 'scan',
        override_start_at: null, override_end_at: null, override_attendance: null, overridden_by: null, overridden_at: null,
        status: 'active', risk_level: null, risk_reason: null, risk_peaks: null, risk_computed_at: null,
        notes: input.notes, dedupe_key: null, created_by: null, updated_at: new Date().toISOString(),
      };
      provider.__test.insertDisruptionRow(row);
      return id;
    },
  };
});
