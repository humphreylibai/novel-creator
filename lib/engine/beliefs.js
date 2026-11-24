import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
const numOrNull = (v) => typeof v === 'number' && Number.isFinite(v) ? v : null;
const arr = (v) => {
    if (Array.isArray(v))
        return v.map(String).filter(Boolean);
    if (typeof v === 'string' && v.trim())
        return [v.trim()];
    return [];
};
function toSpan(v) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
        const o = v;
        return { from: numOrNull(o['from']), to: numOrNull(o['to']) };
    }
    return { from: null, to: null };
}
/** 解析 beliefs/<id>.yaml；文件不带 front matter。 */
export function parseBelief(raw, id, file = `beliefs/${id}.yaml`) {
    const data = (parseYaml(raw) ?? {});
    const confidence = Number(data['confidence']);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)
        throw new Error('belief 的 confidence 必须是 0–1 之间的数字');
    const holder = String(data['holder'] ?? '').trim();
    const target = String(data['target'] ?? '').trim();
    const content = String(data['content'] ?? '').trim();
    if (!holder || !target || !content)
        throw new Error('belief 的 holder / target / content 都不能为空');
    return {
        id,
        holder,
        target,
        content,
        confidence,
        source: arr(data['source']),
        span: toSpan(data['span']),
        file,
    };
}
export function serializeBelief(b) {
    return stringifyYaml({
        holder: b.holder,
        target: b.target,
        content: b.content,
        confidence: b.confidence,
        ...(b.source.length ? { source: b.source } : {}),
        span: b.span,
    });
}
