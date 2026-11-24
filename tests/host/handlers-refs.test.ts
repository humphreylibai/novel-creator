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
  h = createHandlers(await mkdtemp(join(tmpdir(), 'novel-r-')));
  await h({ method: 'POST', path: '/worlds', query: {}, body: { id: '记忆之世', config: CONFIG } });
  await h({ method: 'PUT', path: '/worlds/记忆之世/nodes/E-1', query: {},
    body: { id: 'E-1', kind: 'entry', title: '欠名录', strength: 'soft', body: '袖口' } });
});

describe('片段与未定义专名', () => {
  it('写片段后可列出', async () => {
    const r = await h({ method: 'PUT', path: '/worlds/记忆之世/fragments/第03章-02', query: {},
      body: { chapter: 3, scene: 2, text: '袖口的[[欠名录]]' } });
    expect(r.status).toBe(200);
    const list = await h({ method: 'GET', path: '/worlds/记忆之世/fragments', query: {}, body: null });
    expect((list.json as any[])[0].text).toContain('欠名录');
  });

  it('未定义专名被列出', async () => {
    await h({ method: 'PUT', path: '/worlds/记忆之世/fragments/f2', query: {},
      body: { chapter: 4, scene: 1, text: '[[玄帝]]断三脉' } });
    const r = await h({ method: 'GET', path: '/worlds/记忆之世/graph/missing', query: {}, body: null });
    expect((r.json as any).missing).toContain('玄帝');
  });
});
