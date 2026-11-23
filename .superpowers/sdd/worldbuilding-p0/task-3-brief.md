## Task 3: 文件存储层（唯一 fs 边界）

**Files:**
- Create: `src/host/store.ts`
- Test: `tests/host/store.test.ts`

**Interfaces:**
- Consumes: `parseNode` / `serializeNode`、`parseWorldConfig`
- Produces:
  - `interface Fragment { id; chapter; scene; text; file }`
  - `createWorld(root, id, configYaml)`、`listWorlds(root)`、`readWorldConfig(root, id)`
  - `listNodes(root, id)`、`readNode(root, id, nodeId)`、`writeNode(root, id, node)`、`deleteNode(root, id, nodeId)`
  - `listFragments(root, id)`、`writeFragment(root, id, f)`、`readFragment(root, id, fid)`

- [ ] **Step 1: 写失败测试**

```ts
// tests/host/store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
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
  sameAs: [], violations: [], body: '正文\n', file: '', ...over
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
```

- [ ] **Step 2: 运行确认失败** — Run: `npm test -- tests/host/store.test.ts` → FAIL

- [ ] **Step 3: 实现**

```ts
// src/host/store.ts
import { mkdir, readdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseNode, serializeNode } from '../engine/frontmatter';
import { parseWorldConfig, type WorldConfig } from '../engine/worldConfig';
import type { WorldNode } from '../engine/types';

export type WorldNodeLike = WorldNode;
export interface Fragment { id: string; chapter: number | null; scene: number | null; text: string; file: string }

export const worldDir = (root: string, id: string) => join(root, 'worlds', id);
export const nodesDir = (root: string, id: string) => join(worldDir(root, id), 'nodes');
export const fragDir = (root: string, id: string) => join(worldDir(root, id), 'fragments');

async function ensureDir(p: string) { await mkdir(p, { recursive: true }); }

export async function createWorld(root: string, id: string, configYaml: string): Promise<void> {
  await ensureDir(nodesDir(root, id));
  await ensureDir(fragDir(root, id));
  await ensureDir(join(worldDir(root, id), 'beliefs'));
  await writeFile(join(worldDir(root, id), 'world.yaml'), configYaml, 'utf8');
}

export async function listWorlds(root: string): Promise<string[]> {
  const dir = join(root, 'worlds');
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

export async function readWorldConfig(root: string, worldId: string): Promise<WorldConfig> {
  return parseWorldConfig(await readFile(join(worldDir(root, worldId), 'world.yaml'), 'utf8'));
}

export async function listNodes(root: string, worldId: string): Promise<WorldNode[]> {
  const dir = nodesDir(root, worldId);
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md')).sort();
  const nodes = await Promise.all(files.map(async (f) =>
    parseNode(await readFile(join(dir, f), 'utf8'), `nodes/${f}`)));
  return nodes.sort((a, b) => a.title.localeCompare(b.title, 'zh'));
}

export async function readNode(root: string, worldId: string, nodeId: string): Promise<WorldNode> {
  const found = (await listNodes(root, worldId)).find((n) => n.id === nodeId);
  if (!found) throw new Error(`找不到节点 ${nodeId}`);
  return found;
}

export async function writeNode(root: string, worldId: string, node: WorldNode): Promise<WorldNode> {
  const dir = nodesDir(root, worldId);
  await ensureDir(dir);
  const rel = `nodes/${node.title || node.id}.md`;
  const prev = (await listNodes(root, worldId)).find((n) => n.id === node.id);
  await writeFile(join(worldDir(root, worldId), rel), serializeNode({ ...node, file: rel }), 'utf8');
  if (prev && prev.file !== rel) await unlink(join(worldDir(root, worldId), prev.file)).catch(() => undefined);
  return { ...node, file: rel };
}

export async function deleteNode(root: string, worldId: string, nodeId: string): Promise<void> {
  const node = await readNode(root, worldId, nodeId);
  await unlink(join(worldDir(root, worldId), node.file));
}

export async function listFragments(root: string, worldId: string): Promise<Fragment[]> {
  const dir = fragDir(root, worldId);
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md')).sort();
  return Promise.all(files.map(async (f) => {
    const raw = await readFile(join(dir, f), 'utf8');
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
    const head = m?.[1] ?? '';
    const num = (k: string) => { const r = new RegExp(`${k}:\\s*(\\d+)`).exec(head); return r ? Number(r[1]) : null; };
    return {
      id: f.replace(/\.md$/, ''), chapter: num('chapter'), scene: num('scene'),
      text: m ? raw.slice(m[0].length) : raw, file: `fragments/${f}`
    };
  }));
}

export async function writeFragment(root: string, worldId: string,
  f: { id: string; chapter: number | null; scene: number | null; text: string }): Promise<void> {
  const dir = fragDir(root, worldId);
  await ensureDir(dir);
  const head = ['---', f.chapter !== null ? `chapter: ${f.chapter}` : null,
    f.scene !== null ? `scene: ${f.scene}` : null, '---', ''].filter((x) => x !== null).join('\n');
  await writeFile(join(dir, `${f.id}.md`), `${head}${f.text}`, 'utf8');
}

export async function readFragment(root: string, worldId: string, id: string): Promise<Fragment> {
  const found = (await listFragments(root, worldId)).find((f) => f.id === id);
  if (!found) throw new Error(`找不到片段 ${id}`);
  return found;
}
```

- [ ] **Step 4: 运行确认通过** — Run: `npm test -- tests/host/store.test.ts` → PASS（5 个用例）

- [ ] **Step 5: 提交**

```bash
git add src/host/store.ts tests/host/store.test.ts
git commit -m "feat: 文件存储层（世界/节点/片段）"
```

---

