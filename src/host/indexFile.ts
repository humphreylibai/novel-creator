import { writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { buildGraph } from '../engine/graph.js';
import * as store from './store.js';

const indexPath = (root: string, worldId: string) => join(root, 'worlds', worldId, 'index.json');

/** 派生索引：只从 nodes / fragments 重算，任何写路径都可以把它整份丢掉。 */
export async function rebuildIndex(root: string, worldId: string) {
  const nodes = await store.listNodes(root, worldId);
  const fragments = await store.listFragments(root, worldId);
  const graph = buildGraph(nodes, fragments);
  const edgeCount = [...graph.outbound.values()].reduce((s, e) => s + e.length, 0);
  const payload = {
    builtAt: new Date().toISOString(),
    nodeCount: nodes.length,
    edgeCount,
    nodes: nodes.map((n) => ({ id: n.id, title: n.title, kind: n.kind, strength: n.strength, span: n.span })),
    inbound: Object.fromEntries([...graph.inbound.entries()]),
    missingLinks: graph.missingLinks
  };
  await writeFile(indexPath(root, worldId), JSON.stringify(payload, null, 2), 'utf8');
  return { builtAt: payload.builtAt, nodeCount: nodes.length, edgeCount };
}

/** 读索引；缺失或损坏时自动重建（派生品允许被删，也允许被手改坏）。 */
export async function loadIndex(root: string, worldId: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(indexPath(root, worldId), 'utf8'));
  } catch {
    await rebuildIndex(root, worldId);
    return JSON.parse(await readFile(indexPath(root, worldId), 'utf8'));
  }
}

/** 删除索引；不存在也算失效成功。 */
export async function invalidateIndex(root: string, worldId: string): Promise<void> {
  await unlink(indexPath(root, worldId)).catch(() => undefined);
}
