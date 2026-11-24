const LINK = /\[\[([^\[\]]+?)\]\]/g;
export function parseWikiLinks(text) {
    const out = [];
    for (const m of text.matchAll(LINK)) {
        const t = (m[1] ?? '').trim();
        if (t && !out.includes(t))
            out.push(t);
    }
    return out;
}
export function resolveTargets(nodes, targets) {
    const index = new Map();
    for (const n of nodes) {
        index.set(n.title, n.id);
        for (const a of n.aliases)
            if (!index.has(a))
                index.set(a, n.id);
    }
    const resolved = new Map();
    const missing = [];
    for (const t of targets) {
        const id = index.get(t);
        if (id)
            resolved.set(t, id);
        else
            missing.push(t);
    }
    return { resolved, missing };
}
