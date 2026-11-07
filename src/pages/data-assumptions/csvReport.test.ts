import { describe, expect, it } from 'vitest';
import { cellText, displayColumns, reportLines } from './csvReport.ts';

describe('reportLines', () => {
  it('success', () => {
    expect(reportLines({ ok: true, applied: true, rowCount: 8, errors: [] })).toEqual(['Applied 8 rows']);
  });
  it('errors are row-numbered', () => {
    expect(reportLines({ ok: false, applied: false, rowCount: 0, errors: [{ row: 3, column: 'seats', message: 'bad' }, { row: 1, column: null, message: 'empty' }] }))
      .toEqual(['Row 3, seats: bad', 'Row 1, file: empty']);
  });
});
describe('displayColumns', () => {
  it('rooms use seats_label as label', () => {
    expect(displayColumns('rooms', ['code']).at(-1)).toEqual({ key: 'seats_label', header: 'label' });
    expect(displayColumns('waiting_halls', ['id']).at(-1)).toEqual({ key: 'label', header: 'label' });
  });
  it('cellText', () => { expect(cellText(null)).toBe('—'); expect(cellText({ a: 1 })).toBe('{"a":1}'); });
});
