import { describe, it, expect } from 'vitest';
import { pingHandler } from '../../src/host/ping';

describe('ping', () => {
  it('回显数据根目录与版本', () => {
    const ping = pingHandler('/tmp/novel-data');
    const r = ping();
    expect(r.ok).toBe(true);
    expect(r.dataRoot).toBe('/tmp/novel-data');
    expect(typeof r.version).toBe('string');
  });
});
