import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync } from 'node:fs';

vi.mock('node:fs', () => ({ mkdirSync: vi.fn() }));

import { apply } from '../../src/host/plugin';

type CapturedRoute = {
  path: string;
  kind: 'exact' | 'prefix';
  handler: (req: unknown, res: unknown) => void;
};

function mount(dataRoot: string) {
  let captured: CapturedRoute | undefined;
  apply({
    webServer: {
      register: (route) => {
        captured = route;
        return () => {};
      },
    },
    effect: (fn) => fn(),
  }, { dataRoot });
  if (!captured) throw new Error('route not registered');
  let status = 0;
  let body = '';
  captured.handler({ url: '/', method: 'GET' }, {
    writeHead: (code: number) => { status = code; },
    end: (chunk: string) => { body += chunk; },
  });
  return { status, body, json: JSON.parse(body) as Record<string, unknown> };
}

describe('plugin route', () => {
  beforeEach(() => {
    vi.mocked(mkdirSync).mockReset();
  });

  it('注册 /novel/ping 并返回数据根目录', () => {
    const result = mount('X');
    expect(result.status).toBe(200);
    expect(result.json).toEqual({ ok: true, dataRoot: 'X', version: '0.1.0' });
  });

  it('数据目录创建失败时只返回 error 字段', () => {
    vi.mocked(mkdirSync).mockImplementationOnce(() => { throw new Error('boom'); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = mount('X');
      expect(result.status).toBe(500);
      expect(result.json).toEqual({ error: '数据目录不可用：boom' });
    } finally {
      warn.mockRestore();
    }
  });
});
