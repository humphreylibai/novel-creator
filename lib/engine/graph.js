import { parseWikiLinks, resolveTargets } from './wikiLink.js';
function push(m, k, e) {
    const list = m.get(k);
    if (list)
        list.push(e);
    else
        m.set(k, [e]);
}
export function buildGraph(nodes, fragments) {
    const g = {
        nodes: new Map(), aliasIndex: new Map(), inbound: new Map(), outbound: new Map(), missingLinks: []
    };
    for (const n of nodes) {
        g.nodes.set(n.id, n);
        for (const name of [n.title, ...n.aliases]) {
            const list = g.aliasIndex.get(name) ?? [];
            if (!list.includes(n.id))
                list.push(n.id);
            g.aliasIndex.set(name, list);
        }
    }
    const add = (type, from, to) => {
        push(g.outbound, from, { type, from, to });
        push(g.inbound, to, { type, from, to });
    };
    for (const n of nodes) {
        for (const to of n.derives)
            add('derives', n.id, to);
        for (const to of n.manifests)
            add('manifests', n.id, to);
        for (const to of n.requires)
            add('requires', n.id, to);
        for (const to of n.conflictsWith)
            add('conflicts', n.id, to);
        for (const to of n.sameAs)
            add('same_as', n.id, to);
    }
    const targets = new Set();
    for (const f of fragments)
        for (const t of parseWikiLinks(f.text))
            targets.add(t);
    const { resolved, missing } = resolveTargets(nodes, [...targets]);
    for (const f of fragments) {
        for (const t of parseWikiLinks(f.text)) {
            const id = resolved.get(t);
            if (id)
                add('cites', f.file, id);
        }
    }
    g.missingLinks = missing;
    return g;
}
