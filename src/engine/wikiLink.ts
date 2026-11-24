import type { WorldNode } from './types.js';

const LINK = /\[\[([^\[\]]+?)\]\]/g;

export function parseWikiLinks(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(LINK)) {
    const t = (m[1] ?? '').trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export function resolveTargets(nodes: WorldNode[], targets: string[]) {
  const index = new Map<string, string>();
  for (const n of nodes) {
    index.set(n.title, n.id);
    for (const a of n.aliases) if (!index.has(a)) index.set(a, n.id);
  }
  const resolved = new Map<string, string>();
  const missing: string[] = [];
  for (const t of targets) {
    const id = index.get(t);
    if (id) resolved.set(t, id); else missing.push(t);
  }
  return { resolved, missing };
}
