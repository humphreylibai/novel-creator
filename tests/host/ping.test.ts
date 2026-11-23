import { describe, it, expect } from 'vitest';
import { pingPayload } from '../../src/host/ping';

describe('ping payload', () => {
  it('回显数据根目录与版本', () => {
    const r = pingPayload('/tmp/novel-data');
    expect(r.ok).toBe(true);
    expect(r.dataRoot).toBe('/tmp/novel-data');
    expect(typeof r.version).toBe('string');
  });
});
