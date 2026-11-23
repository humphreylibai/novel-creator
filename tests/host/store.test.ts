import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as store from '../../src/host/store';

const CONFIG = `id: 记忆之世
title: 记忆之世
genre: { allowed: [超自然], forbidden: [], expectation: '' }
calendar:
  epochs: [{ name: 新历, start: 1, end: null }]
  format: "新历{year}年"
theme:
  wound: 一个靠抽干世界来维持秩序的世界
  motif: 记忆即代价
`;

let root: string;
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'novel-')); });

const node = (over: Partial<store.WorldNodeLike> = {}): store.WorldNodeLike => ({
  id: 'W-AX-002', kind: 'axiom', subtype: null, title: '记忆即燃料', aliases: [],
  strength: 'hard', span: { from: -1200, to: null }, proposition: '施法烧记忆',
  cost: ['记忆'], derives: [], manifests: [], requires: [], conflictsWith: [],
  sameAs: [], violations: [], extra: {}, body: '正文\n', file: '', ...over
});

describe('store', () => {
  it('建世界后能列出', async () => {
    await store.createWorld(root, '记忆之世', CONFIG);
    expect(await store.listWorlds(root)).toEqual(['记忆之世']);
  });

  it('写节点后能读回，文件落在 nodes/<title>.md', async () => {
    await store.createWorld(root, '记忆之世', CONFIG);
    await store.writeNode(root, '记忆之世', node());
    const list = await store.listNodes(root, '记忆之世');
    expect(list).toHaveLength(1);
    expect(list[0]!.file).toBe('nodes/记忆即燃料.md');
    expect((await store.readNode(root, '记忆之世', 'W-AX-002')).span.from).toBe(-1200);
  });

  it('改标题会移动文件而不是留下副本', async () => {
    await store.createWorld(root, '记忆之世', CONFIG);
    await store.writeNode(root, '记忆之世', node({ id: 'E-1', kind: 'entry', title: '旧名' }));
    await store.writeNode(root, '记忆之世', node({ id: 'E-1', kind: 'entry', title: '新名' }));
    expect((await store.listNodes(root, '记忆之世')).map((n) => n.title)).toEqual(['新名']);
  });

  it('删除后读不到', async () => {
    await store.createWorld(root, '记忆之世', CONFIG);
    await store.writeNode(root, '记忆之世', node({ id: 'E-2', kind: 'entry', title: '还脉礼' }));
    await store.deleteNode(root, '记忆之世', 'E-2');
    await expect(store.readNode(root, '记忆之世', 'E-2')).rejects.toThrow();
  });

  it('片段带章节与场景，可写入可列出', async () => {
    await store.createWorld(root, '记忆之世', CONFIG);
    await store.writeFragment(root, '记忆之世', { id: '第03章-02', chapter: 3, scene: 2, text: '袖口的[[欠名录]]' });
    const list = await store.listFragments(root, '记忆之世');
    expect(list[0]!.chapter).toBe(3);
    expect(list[0]!.text).toContain('欠名录');
  });
});
