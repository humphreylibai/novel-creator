import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandlers } from '../../src/host/handlers.js';

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
  h = createHandlers(await mkdtemp(join(tmpdir(), 'novel-belief-')));
  await h({ method: 'POST', path: '/worlds', query: {}, body: { id: '记忆之世', config: CONFIG } });
});

describe('belief 路由', () => {
  it('PUT 后能列出并读回，DELETE 后消失', async () => {
    const put = await h({
      method: 'PUT', path: '/worlds/记忆之世/beliefs/玄帝传说', query: {},
      body: {
        holder: '民间', target: 'W-MY-001', content: '玄帝曾一统天下',
        confidence: 0.9, source: ['说书人', '童谣'], span: { from: 300, to: null },
      },
    });
    expect(put.status).toBe(200);

    const list = await h({ method: 'GET', path: '/worlds/记忆之世/beliefs', query: {}, body: null });
    expect(list.status).toBe(200);
    expect(list.json).toMatchObject([{
      id: '玄帝传说', holder: '民间', target: 'W-MY-001', confidence: 0.9,
      source: ['说书人', '童谣'], span: { from: 300, to: null },
    }]);

    const del = await h({ method: 'DELETE', path: '/worlds/记忆之世/beliefs/玄帝传说', query: {}, body: null });
    expect(del.status).toBe(204);
    const again = await h({ method: 'DELETE', path: '/worlds/记忆之世/beliefs/玄帝传说', query: {}, body: null });
    expect(again.status).toBe(404);
  });

  it('缺字段或置信越界返回 422', async () => {
    const r = await h({
      method: 'PUT', path: '/worlds/记忆之世/beliefs/坏', query: {},
      body: { holder: '', target: 'W', content: 'x', confidence: 2 },
    });
    expect(r.status).toBe(422);
  });
});
