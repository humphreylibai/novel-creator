import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandlers } from '../../src/host/handlers';

const CONFIG = `id: 记忆之世
title: 记忆之世
genre: { allowed: [], forbidden: [], expectation: '' }
calendar:
  epochs: [{ name: 新历, start: 1, end: null }]
  format: "{year}"
theme:
  wound: 伤口
  motif: 母题
`;

let h: ReturnType<typeof createHandlers>;
beforeAll(async () => {
  const root = await mkdtemp(join(tmpdir(), 'novel-h-'));
  h = createHandlers(root);
});

describe('handlers', () => {
  it('POST /worlds 建世界', async () => {
    const r = await h({ method: 'POST', path: '/worlds', query: {}, body: { id: '记忆之世', config: CONFIG } });
    expect(r.status).toBe(201);
    const list = await h({ method: 'GET', path: '/worlds', query: {}, body: null });
    expect(list.json).toEqual(['记忆之世']);
  });

  it('公理没代价返回 422 且不落盘', async () => {
    const r = await h({ method: 'PUT', path: '/worlds/记忆之世/nodes/W-AX-1', query: {},
      body: { id: 'W-AX-1', kind: 'axiom', title: '无代价', strength: 'hard', cost: [] } });
    expect(r.status).toBe(422);
    const list = await h({ method: 'GET', path: '/worlds/记忆之世/nodes', query: {}, body: null });
    expect(list.json).toEqual([]);
  });

  it('条目可保存并读回', async () => {
    const put = await h({ method: 'PUT', path: '/worlds/记忆之世/nodes/E-1', query: {},
      body: { id: 'E-1', kind: 'entry', title: '还脉礼', strength: 'soft', body: '念名还债' } });
    expect(put.status).toBe(200);
    const got = await h({ method: 'GET', path: '/worlds/记忆之世/nodes/E-1', query: {}, body: null });
    expect((got.json as any).title).toBe('还脉礼');
  });

  it('stats 统计公理数与已落表现的公理数', async () => {
    await h({ method: 'PUT', path: '/worlds/记忆之世/nodes/W-AX-2', query: {},
      body: { id: 'W-AX-2', kind: 'axiom', title: '记忆即燃料', strength: 'hard', cost: ['记忆'] } });
    const s = await h({ method: 'GET', path: '/worlds/记忆之世/stats', query: {}, body: null });
    expect(s.json).toMatchObject({ axioms: 1, manifestedAxioms: 0 });
  });

  it('未知路径返回 404', async () => {
    expect((await h({ method: 'GET', path: '/nope', query: {}, body: null })).status).toBe(404);
  });
});
