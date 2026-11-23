import { parse as parseYaml } from 'yaml';
const arr = (v) => (Array.isArray(v) ? v.map(String) : []);
/**
 * YAML 解析结果只信任普通映射：标量 / 序列 / null 一律当空映射。
 * 读不到键与读到 undefined 等价，因此不需要 `any` 也能保持 brief 的取值行为。
 */
const asRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v) ? v : {};
export function parseWorldConfig(raw) {
    const d = asRecord(parseYaml(raw));
    const theme = asRecord(d['theme']);
    const wound = String(theme['wound'] ?? '').trim();
    if (!wound)
        throw new Error('world.yaml 缺少 theme.wound（一句话母题）');
    const cal = asRecord(d['calendar']);
    const epochsValue = cal['epochs'];
    const epochsRaw = Array.isArray(epochsValue) ? epochsValue : [];
    if (epochsRaw.length === 0)
        throw new Error('world.yaml 缺少 calendar.epochs（历法必须成数据）');
    const epochs = epochsRaw.map((e) => {
        const epoch = asRecord(e);
        const end = epoch['end'];
        return {
            name: String(epoch['name'] ?? ''),
            start: Number(epoch['start'] ?? 0),
            end: end === null || end === undefined ? null : Number(end)
        };
    });
    const genre = asRecord(d['genre']);
    return {
        id: String(d['id'] ?? ''),
        title: String(d['title'] ?? d['id'] ?? ''),
        genre: {
            allowed: arr(genre['allowed']),
            forbidden: arr(genre['forbidden']),
            expectation: String(genre['expectation'] ?? '')
        },
        calendar: { epochs, format: String(cal['format'] ?? '{year}'), months: arr(cal['months']) },
        theme: { wound, motif: String(theme['motif'] ?? '') }
    };
}
