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
  h = createHandlers(await mkdtemp(join(tmpdir(), 'novel-c-')));
  await h({ method: 'POST', path: '/worlds', query: {}, body: { id: '记忆之世', config: CONFIG } });
  await h({ method: 'PUT', path: '/worlds/记忆之世/nodes/E-1', query: {},
    body: { id: 'E-1', kind: 'entry', title: '欠名录', strength: 'soft', body: '袖口' } });
  await h({ method: 'PUT', path: '/worlds/记忆之世/fragments/第03章-02', query: {},
    body: { chapter: 3, scene: 2, text: '袖口的[[欠名录]]' } });
});

describe('引用与删除保护', () => {
  it('能查到片段引用', async () => {
    const r = await h({ method: 'GET', path: '/worlds/记忆之世/nodes/E-1/citations', query: {}, body: null });
    expect((r.json as any).fragments).toContain('第03章-02');
  });

  it('被引用时删除返回 409 并列出引用处', async () => {
    const r = await h({ method: 'DELETE', path: '/worlds/记忆之世/nodes/E-1', query: {}, body: null });
    expect(r.status).toBe(409);
    expect((r.json as any).refs.fragments).toContain('第03章-02');
  });

  it('节点的入边出现在 citations.nodes 中', async () => {
    await h({ method: 'PUT', path: '/worlds/记忆之世/nodes/A-1', query: {},
      body: { id: 'A-1', kind: 'entry', title: '外典', strength: 'soft', requires: ['E-1'] } });
    const r = await h({ method: 'GET', path: '/worlds/记忆之世/nodes/E-1/citations', query: {}, body: null });
    expect((r.json as any).nodes).toContainEqual({ id: 'A-1', title: '外典', via: 'requires' });
  });

  it('节点入边也阻止删除', async () => {
    const r = await h({ method: 'DELETE', path: '/worlds/记忆之世/nodes/E-1', query: {}, body: null });
    expect(r.status).toBe(409);
    expect((r.json as any).refs.nodes).toContainEqual({ id: 'A-1', title: '外典', via: 'requires' });
  });
});

describe('重复入边去重', () => {
  it('同一节点的标题与别名各引用一次时只返回一条', async () => {
    await h({ method: 'PUT', path: '/worlds/记忆之世/nodes/E-2', query: {},
      body: { id: 'E-2', kind: 'entry', title: '灰塔', aliases: ['灰塔之名'], strength: 'soft' } });
    await h({ method: 'PUT', path: '/worlds/记忆之世/fragments/f-alias', query: {},
      body: { chapter: 5, scene: 1, text: '[[灰塔]]与[[灰塔之名]]' } });

    const r = await h({ method: 'GET', path: '/worlds/记忆之世/nodes/E-2/citations', query: {}, body: null });
    expect((r.json as any).fragments).toEqual(['f-alias']);

    const d = await h({ method: 'DELETE', path: '/worlds/记忆之世/nodes/E-2', query: {}, body: null });
    expect(d.status).toBe(409);
    expect((d.json as any).refs.fragments).toEqual(['f-alias']);
  });
});
