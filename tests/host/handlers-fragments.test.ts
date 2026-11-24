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
  h = createHandlers(await mkdtemp(join(tmpdir(), 'novel-frag-')));
  await h({ method: 'POST', path: '/worlds', query: {}, body: { id: '记忆之世', config: CONFIG } });
});

describe('片段路由', () => {
  it('PUT 后能按 chapter/scene/正文读回', async () => {
    const put = await h({ method: 'PUT', path: '/worlds/记忆之世/fragments/第一章', query: {}, body: {
      chapter: 1, scene: 2, text: '他把[[还脉礼]]交还。',
    } });
    expect(put.status).toBe(200);

    const list = await h({ method: 'GET', path: '/worlds/记忆之世/fragments', query: {}, body: null });
    expect(list.status).toBe(200);
    expect(list.json).toEqual([{
      id: '第一章', chapter: 1, scene: 2, text: '他把[[还脉礼]]交还。', file: 'fragments/第一章.md',
    }]);
  });

  it('路径分隔符的 id 返回 400', async () => {
    const r = await h({ method: 'PUT', path: '/worlds/记忆之世/fragments/..%2Fx', query: {}, body: {
      chapter: null, scene: null, text: '',
    } });
    expect(r.status).toBe(400);
  });
});
