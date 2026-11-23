import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
export function parseFrontmatter(raw) {
    const clean = raw.replace(/^\uFEFF/, '');
    const m = FENCE.exec(clean);
    if (!m)
        throw new Error('缺少 front matter 围栏（文件必须以 --- 开头）');
    const data = (parseYaml(m[1] ?? '') ?? {});
    return { data, body: clean.slice(m[0].length) };
}
const arr = (v) => (Array.isArray(v) ? v.map(String) : []);
const numOrNull = (v) => typeof v === 'number' && Number.isFinite(v) ? v : null;
function toSpan(v) {
    if (v && typeof v === 'object') {
        const o = v;
        return { from: numOrNull(o['from']), to: numOrNull(o['to']) };
    }
    return { from: null, to: null };
}
function toStrength(v) {
    return v === 'hard' || v === 'firm' || v === 'myth' ? v : 'soft';
}
export function parseNode(raw, file) {
    const { data, body } = parseFrontmatter(raw);
    return {
        id: String(data['id'] ?? ''),
        kind: data['kind'] === 'axiom' ? 'axiom' : 'entry',
        subtype: typeof data['subtype'] === 'string' ? data['subtype'] : null,
        title: String(data['title'] ?? ''),
        aliases: arr(data['aliases']),
        strength: toStrength(data['strength']),
        span: toSpan(data['span']),
        proposition: typeof data['proposition'] === 'string' ? data['proposition'] : null,
        cost: arr(data['cost']),
        derives: arr(data['derives']),
        manifests: arr(data['manifests']),
        requires: arr(data['requires']),
        conflictsWith: arr(data['conflicts_with']),
        sameAs: arr(data['same_as']),
        violations: arr(data['violations']),
        body,
        file
    };
}
export function serializeNode(n) {
    const data = {
        kind: n.kind, id: n.id, title: n.title, strength: n.strength,
        ...(n.subtype ? { subtype: n.subtype } : {}),
        ...(n.aliases.length ? { aliases: n.aliases } : {}),
        span: n.span,
        ...(n.proposition ? { proposition: n.proposition } : {}),
        ...(n.cost.length ? { cost: n.cost } : {}),
        ...(n.derives.length ? { derives: n.derives } : {}),
        ...(n.manifests.length ? { manifests: n.manifests } : {}),
        ...(n.requires.length ? { requires: n.requires } : {}),
        ...(n.conflictsWith.length ? { conflicts_with: n.conflictsWith } : {}),
        ...(n.sameAs.length ? { same_as: n.sameAs } : {}),
        ...(n.violations.length ? { violations: n.violations } : {})
    };
    return `---\n${stringifyYaml(data)}---\n${n.body}`;
}
