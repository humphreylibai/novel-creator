import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandlers } from '../../src/host/handlers.js';

const config = (id: string) => `id: ${id}
title: ${id}
genre: { allowed: [], forbidden: [], expectation: '' }
calendar:
  epochs: [{ name: 新历, start: 1, end: null }]
  format: "{year}"
theme:
  wound: 伤口
  motif: ''
`;

let h: ReturnType<typeof createHandlers>;

beforeAll(async () => {
  h = createHandlers(await mkdtemp(join(tmpdir(), 'novel-worlds-')));
  await h({ method: 'POST', path: '/worlds', query: {}, body: { id: 'A', config: config('A') } });
  await h({ method: 'POST', path: '/worlds', query: {}, body: { id: 'B', config: config('B') } });
});

describe('世界删除', () => {
  it('删一个，另一个还在；再删返回 404', async () => {
    expect((await h({ method: 'DELETE', path: '/worlds/A', query: {}, body: null })).status).toBe(204);
    expect((await h({ method: 'GET', path: '/worlds', query: {}, body: null })).json).toEqual(['B']);
    expect((await h({ method: 'DELETE', path: '/worlds/A', query: {}, body: null })).status).toBe(404);
  });

  it('重复建同名世界返回 409，不覆盖原配置', async () => {
    const r = await h({ method: 'POST', path: '/worlds', query: {}, body: { id: 'B', config: config('B2') } });
    expect(r.status).toBe(409);
  });

  it('非法 id 不进入删除', async () => {
    const r = await h({ method: 'DELETE', path: '/worlds/..%2F..', query: {}, body: null });
    expect(r.status).toBe(404);
  });
});
