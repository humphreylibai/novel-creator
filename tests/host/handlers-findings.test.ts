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
  h = createHandlers(await mkdtemp(join(tmpdir(), 'novel-f-')));
  await h({ method: 'POST', path: '/worlds', query: {}, body: { id: '记忆之世', config: CONFIG } });
  await h({ method: 'PUT', path: '/worlds/记忆之世/nodes/E-1', query: {},
    body: { id: 'E-1', kind: 'entry', title: '无根条目', strength: 'soft', body: '这是一段足够长的正文内容，避免触发 R10。' } });
});

describe('findings', () => {
  it('返回带规则号与严重度的清单', async () => {
    const r = await h({ method: 'GET', path: '/worlds/记忆之世/findings', query: {}, body: null });
    expect(Array.isArray(r.json)).toBe(true);
    expect((r.json as any[]).some((f) => f.rule === 'R4')).toBe(true);
  });
});
