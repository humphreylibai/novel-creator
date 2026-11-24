import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraph } from '../engine/graph.js';
import { runRules } from '../engine/rules/index.js';
import { resolveDataRoot } from './dataRoot.js';
import * as store from './store.js';

const ICON = { error: '🔴', warn: '🟡', info: '⚪' } as const;

// 包根由本文件位置上溯两级（src/host 或 lib/host）；插件进程的 cwd 不是作品目录。
const here = dirname(fileURLToPath(import.meta.url));
const root = resolveDataRoot(process.env['NOVEL_DATA_ROOT'], resolve(here, '../..'));

async function main(): Promise<void> {
  const worldId = process.argv[2] ?? (await store.listWorlds(root))[0];
  if (!worldId) {
    console.error(`没有可检查的世界：${resolve(root, 'worlds')} 为空`);
    process.exitCode = 2;
    return;
  }

  const nodes = await store.listNodes(root, worldId);
  const fragments = await store.listFragments(root, worldId);
  const findings = runRules({ nodes, graph: buildGraph(nodes, fragments) });

  console.log(`\n${worldId} · 体检`);
  console.log(`  节点 ${nodes.length} · 片段 ${fragments.length} · 问题 ${findings.length}\n`);
  if (findings.length === 0) console.log('没有发现问题。');
  for (const f of findings) {
    console.log(`${ICON[f.severity]} ${f.rule}  ${f.message}`);
    if (f.hint) console.log(`     ${f.hint}`);
  }
  // 用 exitCode 而不是 process.exit：管道输出不会被截断。
  process.exitCode = findings.some((f) => f.severity === 'error') ? 1 : 0;
}

void main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 2;
});
