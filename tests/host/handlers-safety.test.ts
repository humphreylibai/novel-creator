import { describe, it, expect, beforeAll } from 'vitest';
import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHandlers } from '../../src/host/handlers';

const CONFIG = `id: w
title: w
genre: { allowed: [], forbidden: [], expectation: '' }
calendar:
  epochs: [{ name: x, start: 1, end: null }]
  format: "{year}"
theme:
  wound: a
  motif: b
`;

let root: string;
let h: ReturnType<typeof createHandlers>;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'novel-safe-'));
  h = createHandlers(root);
  await h({ method: 'POST', path: '/worlds', query: {}, body: { id: 'w', config: CONFIG } });
});

describe('文件名安全', () => {
  it('拒绝带路径分隔符的节点标题，且不写出数据根', async () => {
    const r = await h({ method: 'PUT', path: '/worlds/w/nodes/E-1', query: {},
      body: { id: 'E-1', kind: 'entry', title: '../../../../escaped', body: 'x' } });
    expect(r.status).toBe(400);
    await expect(stat(join(root, '..', 'escaped.md'))).rejects.toThrow();
  });

  it('拒绝带路径分隔符的片段 id', async () => {
    const r = await h({ method: 'PUT', path: '/worlds/w/fragments/..%2F..%2Fevil', query: {},
      body: { chapter: 1, scene: 1, text: 'x' } });
    expect(r.status).toBe(400);
  });

  it('普通标题仍可保存', async () => {
    const r = await h({ method: 'PUT', path: '/worlds/w/nodes/E-2', query: {},
      body: { id: 'E-2', kind: 'entry', title: '欠名录', body: '袖口' } });
    expect(r.status).toBe(200);
  });
});
