const overlaps = (a, b) => (a.from ?? -Infinity) <= (b.to ?? Infinity) && (b.from ?? -Infinity) <= (a.to ?? Infinity);
const covers = (outer, inner) => (inner.from ?? -Infinity) >= (outer.from ?? -Infinity) && (inner.to ?? Infinity) <= (outer.to ?? Infinity);
export const R7 = ({ nodes }) => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const out = [];
    for (const n of nodes) {
        for (const axId of n.derives) {
            const ax = byId.get(axId);
            if (ax && ax.kind === 'axiom' && !covers(ax.span, n.span)) {
                out.push({
                    rule: 'R7', severity: 'error', nodeIds: [n.id],
                    message: `派生链断裂：「${n.title}」的生效区间超出公理「${ax.title}」`,
                    hint: '公理已经终止，依赖它的条目却还在',
                    actions: ['指定新公理', '截断条目区间', '忽略']
                });
            }
        }
    }
    return out;
};
export const R6 = ({ nodes }) => {
    const byName = new Map();
    for (const n of nodes)
        for (const name of [n.title, ...n.aliases]) {
            const list = byName.get(name) ?? [];
            list.push(n.id);
            byName.set(name, list);
        }
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const out = [];
    const seen = new Set();
    for (const [, ids] of byName) {
        const uniq = [...new Set(ids)];
        for (let i = 0; i < uniq.length; i++)
            for (let j = i + 1; j < uniq.length; j++) {
                const a = byId.get(uniq[i]);
                const b = byId.get(uniq[j]);
                if (!a || !b || !overlaps(a.span, b.span))
                    continue;
                const key = [a.id, b.id].sort().join('|');
                if (seen.has(key))
                    continue;
                seen.add(key);
                out.push({
                    rule: 'R6', severity: 'error', nodeIds: [a.id, b.id],
                    message: `同一名称在重叠时间内指向两个条目：「${a.title}」与「${b.title}」`,
                    hint: '合并，或加时间/地域限定', actions: ['合并为同一实体', '加时间限定']
                });
            }
    }
    return out;
};
export const R8 = ({ nodes }) => {
    const byTitle = new Map(nodes.map((n) => [n.title, n]));
    const out = [];
    const seen = new Set();
    for (const n of nodes)
        for (const alias of n.aliases) {
            const other = byTitle.get(alias);
            if (!other || other.id === n.id)
                continue;
            if (n.sameAs.includes(other.id) || other.sameAs.includes(n.id))
                continue;
            const key = [n.id, other.id].sort().join('|');
            if (seen.has(key))
                continue;
            seen.add(key);
            out.push({
                rule: 'R8', severity: 'warn', nodeIds: [n.id, other.id],
                message: `「${n.title}」把「${other.title}」当成别名，但两者没有合并`,
                hint: '它们是同一个东西吗？', actions: ['建立 same_as', '删除该别名']
            });
        }
    return out;
};
export const structuralRules = [R6, R7, R8];
