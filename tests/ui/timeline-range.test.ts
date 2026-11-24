import { describe, expect, it } from 'vitest';
import { timelineRange } from '../../src/ui/timelineRange.js';

describe('timelineRange', () => {
  it('按历法端点给出区间，默认落在可用的最新年份', () => {
    expect(timelineRange({ calendar: { epochs: [{ start: 1522, end: 1566 }] } }))
      .toEqual({ min: 1522, max: 1566, year: 1566 });
  });

  it('开放纪元沿用 0–800 的兜底区间，并保留默认年', () => {
    expect(timelineRange({ calendar: { epochs: [{ start: 1, end: null }] } }))
      .toEqual({ min: 1, max: 801, year: 612 });
  });

  it('默认年落在区间内时不被挪动', () => {
    expect(timelineRange({ calendar: { epochs: [{ start: 500, end: 900 }] } }, 612))
      .toEqual({ min: 500, max: 900, year: 612 });
  });

  it('缺少历法时退回 0–800', () => {
    expect(timelineRange({})).toEqual({ min: 0, max: 800, year: 612 });
  });
});
