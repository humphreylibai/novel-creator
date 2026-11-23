import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { apply } from '../../src/host/plugin';

type CapturedRoute = {
  path: string;
  kind: 'exact' | 'prefix';
  handler: (req: unknown, res: unknown) => void | Promise<void>;
};

type FakeResponse = {
  status: number;
  headers: Record<string, string>;
  text: string;
  json?: unknown;
};

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function mount() {
  const dataRoot = mkdtempSync(join(tmpdir(), 'novel-prefix-route-'));
  tempDirs.push(dataRoot);
  const routes: CapturedRoute[] = [];
  apply({
    webServer: {
      register: (route) => {
        routes.push(route);
        return () => {};
      },
    },
    effect: (fn) => fn(),
  }, { dataRoot });
  return { dataRoot, routes };
}

async function call(
  route: CapturedRoute | undefined,
  opts: { url: string; method?: string; body?: string; chunkSize?: number }
): Promise<FakeResponse> {
  if (!route) throw new Error('route not registered');
  let status = 0;
  const headers: Record<string, string> = {};
  let text = '';

  const buf = opts.body === undefined ? Buffer.alloc(0) : Buffer.from(opts.body, 'utf8');
  const size = opts.chunkSize ?? (buf.length || 1);
  const chunks: Buffer[] = [];
  for (let i = 0; i < buf.length; i += size) chunks.push(buf.subarray(i, i + size));

  const req = {
    url: opts.url,
    method: opts.method ?? 'GET',
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  };
  const res = {
    writeHead(code: number, h?: Record<string, string>) {
      status = code;
      Object.assign(headers, h ?? {});
    },
    end(chunk = '') {
      text += chunk;
    },
  };

  await route.handler(req, res);
  return { status, headers, text, json: text === '' ? undefined : JSON.parse(text) };
}

describe('plugin /novel 前缀路由', () => {
  it('注册 exact 健康检查与 prefix 路由', () => {
    const { routes } = mount();
    expect(routes).toHaveLength(2);
    expect(routes.find((r) => r.path === '/novel/ping')?.kind).toBe('exact');
    expect(routes.find((r) => r.path === '/novel')?.kind).toBe('prefix');
  });

  it('GET /novel/worlds 返回 JSON 数组', async () => {
    const { routes } = mount();
    const prefix = routes.find((r) => r.path === '/novel' && r.kind === 'prefix');
    const res = await call(prefix, { url: '/novel/worlds' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(res.json).toEqual([]);
  });

  it('前缀先匹配时 /novel/ping 仍返回健康检查', async () => {
    const { routes } = mount();
    const prefix = routes.find((r) => r.path === '/novel' && r.kind === 'prefix');
    const res = await call(prefix, { url: '/novel/ping' });
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ ok: true });
  });

  it('POST /novel/worlds 会拼接异步分片请求体', async () => {
    const { routes } = mount();
    const prefix = routes.find((r) => r.path === '/novel' && r.kind === 'prefix');
    const body = JSON.stringify({ id: '记忆之世', config: 'name: 记忆之世\n' });
    const created = await call(prefix, {
      url: '/novel/worlds', method: 'POST', body, chunkSize: 3,
    });
    expect(created.status).toBe(201);
    expect(created.json).toEqual({ ok: true });

    const worlds = await call(prefix, { url: '/novel/worlds' });
    expect(worlds.json).toEqual(['记忆之世']);
  });

  it('PUT 的非法 JSON 返回 400 且 body 只有 error', async () => {
    const { routes } = mount();
    const prefix = routes.find((r) => r.path === '/novel' && r.kind === 'prefix');
    const res = await call(prefix, {
      url: '/novel/worlds/w/nodes/n1', method: 'PUT', body: '{"id":',
    });
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: '请求体不是合法 JSON' });
    expect(Object.keys(res.json as Record<string, unknown>)).toEqual(['error']);
  });

  it('handlers 的 422 校验结果原样透传', async () => {
    const { routes } = mount();
    const prefix = routes.find((r) => r.path === '/novel' && r.kind === 'prefix');
    const created = await call(prefix, {
      url: '/novel/worlds', method: 'POST',
      body: JSON.stringify({ id: 'w', config: 'name: w\n' }),
    });
    expect(created.status).toBe(201);

    const res = await call(prefix, {
      url: '/novel/worlds/w/nodes/a', method: 'PUT',
      body: JSON.stringify({ id: 'a', title: 'A', kind: 'axiom', cost: [] }),
    });
    expect(res.status).toBe(422);
    expect(res.json).toEqual({ error: '公理必须付出代价（铁律一）' });
  });
});
