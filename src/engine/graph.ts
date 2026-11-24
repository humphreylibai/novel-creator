import type { WorldNode } from './types.js';
import type { Fragment } from '../host/store.js';
import { parseWikiLinks, resolveTargets } from './wikiLink.js';

export type EdgeType = 'derives' | 'manifests' | 'requires' | 'cites' | 'conflicts' | 'same_as';
export interface Edge { type: EdgeType; from: string; to: string }
export interface Graph {
  nodes: Map<string, WorldNode>;
  aliasIndex: Map<string, string[]>;
  inbound: Map<string, Edge[]>;
  outbound: Map<string, Edge[]>;
  missingLinks: string[];
}

function push(m: Map<string, Edge[]>, k: string, e: Edge) {
  const list = m.get(k);
  if (list) list.push(e); else m.set(k, [e]);
}

export function buildGraph(nodes: WorldNode[], fragments: Fragment[]): Graph {
  const g: Graph = {
    nodes: new Map(), aliasIndex: new Map(), inbound: new Map(), outbound: new Map(), missingLinks: []
  };
  for (const n of nodes) {
    g.nodes.set(n.id, n);
    for (const name of [n.title, ...n.aliases]) {
      const list = g.aliasIndex.get(name) ?? [];
      if (!list.includes(n.id)) list.push(n.id);
      g.aliasIndex.set(name, list);
    }
  }

  const add = (type: EdgeType, from: string, to: string) => {
    push(g.outbound, from, { type, from, to });
    push(g.inbound, to, { type, from, to });
  };

  for (const n of nodes) {
    for (const to of n.derives) add('derives', n.id, to);
    for (const to of n.manifests) add('manifests', n.id, to);
    for (const to of n.requires) add('requires', n.id, to);
    for (const to of n.conflictsWith) add('conflicts', n.id, to);
    for (const to of n.sameAs) add('same_as', n.id, to);
  }

  const targets = new Set<string>();
  for (const f of fragments) for (const t of parseWikiLinks(f.text)) targets.add(t);
  const { resolved, missing } = resolveTargets(nodes, [...targets]);
  for (const f of fragments) {
    for (const t of parseWikiLinks(f.text)) {
      const id = resolved.get(t);
      if (id) add('cites', f.file, id);
    }
  }
  g.missingLinks = missing;
  return g;
}
