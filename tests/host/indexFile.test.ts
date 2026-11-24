import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as store from '../../src/host/store';
import { rebuildIndex, invalidateIndex } from '../../src/host/indexFile';

let root: string;
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

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'novel-idx-'));
  await store.createWorld(root, '记忆之世', CONFIG);
});

describe('index.json', () => {
  it('可重建并统计节点与边', async () => {
    await store.writeNode(root, '记忆之世', {
      id: 'E-1', kind: 'entry', subtype: null, title: '欠名录', aliases: [], strength: 'soft',
      span: { from: null, to: null }, proposition: null, cost: [], derives: ['W-AX-1'],
      manifests: [], requires: [], conflictsWith: [], sameAs: [], violations: [], extra: {},
      body: '', file: ''
    });
    const r = await rebuildIndex(root, '记忆之世');
    expect(r.nodeCount).toBe(1);
    expect(r.edgeCount).toBe(1);
    expect((await stat(join(root, 'worlds', '记忆之世', 'index.json'))).isFile()).toBe(true);
  });
  it('失效后文件不存在（派生品可删）', async () => {
    await rebuildIndex(root, '记忆之世');
    await invalidateIndex(root, '记忆之世');
    await expect(stat(join(root, 'worlds', '记忆之世', 'index.json'))).rejects.toThrow();
  });
});
