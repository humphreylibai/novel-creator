import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { Span, Strength, WorldNode } from './types.js';

const FENCE = /^---\r?\n(?:([\s\S]*?)\r?\n)?---\r?\n?/;

export function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const clean = raw.replace(/^\uFEFF/, '');
  const m = FENCE.exec(clean);
  if (!m) throw new Error('缺少 front matter 围栏（文件必须以 --- 开头）');
  const data = (parseYaml(m[1] ?? '') ?? {}) as Record<string, unknown>;
  return { data, body: clean.slice(m[0].length) };
}

/** 已知字段在 YAML 里的键名；其余键一律收进 extra 原样保留。 */
const KNOWN_KEYS = new Set([
  'kind', 'id', 'subtype', 'title', 'aliases', 'strength', 'span', 'proposition',
  'cost', 'derives', 'manifests', 'requires', 'conflicts_with', 'same_as', 'violations'
]);

const arr = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map(String);
  // 标量写法（cost: 记忆 / derives: W-AX-002）合法，包成单元素数组
  if (typeof v === 'string' || typeof v === 'number') return [String(v)];
  return [];
};
const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

function toExtra(data: Record<string, unknown>): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) if (!KNOWN_KEYS.has(k)) extra[k] = v;
  return extra;
}

const norm = (v: unknown): string => (typeof v === 'string' ? v.trim().toLowerCase() : '');

function toSpan(v: unknown): Span {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return { from: numOrNull(o['from']), to: numOrNull(o['to']) };
  }
  return { from: null, to: null };
}
function toStrength(v: unknown): Strength {
  const s = norm(v);
  return s === 'hard' || s === 'firm' || s === 'myth' ? s : 'soft';
}

export function parseNode(raw: string, file: string): WorldNode {
  const { data, body } = parseFrontmatter(raw);
  return {
    id: String(data['id'] ?? ''),
    kind: norm(data['kind']) === 'axiom' ? 'axiom' : 'entry',
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
    extra: toExtra(data),
    body,
    file
  };
}

export function serializeNode(n: WorldNode): string {
  const data: Record<string, unknown> = {
    // 未知键先铺，已知字段后写：同名冲突时已知字段覆盖
    ...n.extra,
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
