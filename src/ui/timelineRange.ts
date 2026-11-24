export interface TimelineEpoch {
  start?: number | null;
  end?: number | null;
}

export interface TimelineConfig {
  calendar?: { epochs?: TimelineEpoch[] };
}

export interface TimelineRange {
  min: number;
  max: number;
  year: number;
}

const FALLBACK = { min: 0, max: 800, year: 612 } as const;

/**
 * 时间轴区间来自 world.yaml 的历法端点，而不是写死的 0–800。
 * 开放纪元（end: null）没有上界，保留 800 年的兜底窗口；
 * 默认年仍在窗口内就不动，否则落到最新年份（历史世界通常等于故事终点）。
 */
export function timelineRange(config: TimelineConfig, defaultYear = FALLBACK.year): TimelineRange {
  const epochs = Array.isArray(config.calendar?.epochs) ? config.calendar.epochs : [];
  const starts = epochs
    .map((e) => e.start)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (starts.length === 0) return { ...FALLBACK };

  const ends = epochs
    .map((e) => e.end)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const min = Math.min(...starts);
  const max = ends.length > 0 ? Math.max(min, ...ends) : min + 800;
  const year = defaultYear >= min && defaultYear <= max ? defaultYear : max;
  return { min, max, year };
}
