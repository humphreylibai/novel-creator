import { mkdir, readdir, readFile, writeFile, unlink, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseNode, serializeNode } from '../engine/frontmatter.js';
import { parseWorldConfig, type WorldConfig } from '../engine/worldConfig.js';
import { parseBelief, serializeBelief } from '../engine/beliefs.js';
import type { Belief, WorldNode } from '../engine/types.js';
import { isSafeName } from './safeName.js';

export type WorldNodeLike = WorldNode;
export interface Fragment {
  id: string;
  chapter: number | null;
  scene: number | null;
  text: string;
  file: string;
}

export const worldDir = (root: string, id: string) => join(root, 'worlds', id);
export const nodesDir = (root: string, id: string) => join(worldDir(root, id), 'nodes');
export const fragDir = (root: string, id: string) => join(worldDir(root, id), 'fragments');
export const beliefsDir = (root: string, id: string) => join(worldDir(root, id), 'beliefs');

async function ensureDir(p: string): Promise<void> {
  await mkdir(p, { recursive: true });
}

export async function createWorld(root: string, id: string, configYaml: string): Promise<void> {
  if (!isSafeName(id)) throw new Error('非法世界 id');
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
  const name = node.title || node.id;
  if (!isSafeName(name)) throw new Error('非法文件名');
  const rel = `nodes/${name}.md`;
  const prev = (await listNodes(root, worldId)).find((n) => n.id === node.id);
  await writeFile(join(worldDir(root, worldId), rel), serializeNode({ ...node, file: rel }), 'utf8');
  // 改了标题就是换了文件：旧文件必须清掉，否则列表里会出现同 id 的两份
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
    const num = (k: string): number | null => {
      const r = new RegExp(`${k}:\\s*(\\d+)`).exec(head);
      return r ? Number(r[1]) : null;
    };
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
  if (!isSafeName(f.id)) throw new Error('非法文件名');
  const head = ['---', f.chapter !== null ? `chapter: ${f.chapter}` : null,
    f.scene !== null ? `scene: ${f.scene}` : null, '---', ''].filter((x) => x !== null).join('\n');
  await writeFile(join(dir, `${f.id}.md`), `${head}${f.text}`, 'utf8');
}

export async function readFragment(root: string, worldId: string, id: string): Promise<Fragment> {
  const found = (await listFragments(root, worldId)).find((f) => f.id === id);
  if (!found) throw new Error(`找不到片段 ${id}`);
  return found;
}


export async function listBeliefs(root: string, worldId: string): Promise<Belief[]> {
  const dir = beliefsDir(root, worldId);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
  const out = await Promise.all(names
    .filter((name) => name.endsWith('.yaml'))
    .map(async (name) => parseBelief(
      await readFile(join(dir, name), 'utf8'),
      basename(name, '.yaml'),
      `beliefs/${name}`,
    )));
  return out.sort((a, b) => a.id.localeCompare(b.id, 'zh'));
}

export async function writeBelief(root: string, worldId: string, b: Belief): Promise<void> {
  if (!isSafeName(b.id)) throw new Error('非法认知 id');
  const dir = beliefsDir(root, worldId);
  await ensureDir(dir);
  await writeFile(join(dir, `${b.id}.yaml`), serializeBelief(b), 'utf8');
}

export async function deleteBelief(root: string, worldId: string, id: string): Promise<void> {
  if (!isSafeName(id)) throw new Error('非法认知 id');
  try {
    await unlink(join(beliefsDir(root, worldId), `${id}.yaml`));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT')
      throw new Error(`找不到认知 ${id}`);
    throw e;
  }
}


export async function deleteWorld(root: string, id: string): Promise<void> {
  if (!isSafeName(id)) throw new Error('非法世界 id');
  const dir = worldDir(root, id);
  if (!existsSync(dir)) throw new Error(`找不到世界 ${id}`);
  await rm(dir, { recursive: true, force: false });
}
