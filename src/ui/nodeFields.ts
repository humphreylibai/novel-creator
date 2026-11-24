import type { NodeRecord } from './api.js';

export type NodeKind = 'axiom' | 'entry';
export type RelationField = 'derives' | 'manifests' | 'requires' | 'conflictsWith' | 'sameAs';

export interface NodeDraft {
  kind: NodeKind;
  title: string;
  body: string;
  strength: string;
  from: string;
  to: string;
  aliases: string;
  cost: string;
  proposition: string;
}

export const splitList = (raw: string): string[] =>
  raw.split(/[、,，\n]/).map((s) => s.trim()).filter(Boolean);

export const joinList = (value: unknown): string =>
  Array.isArray(value) ? value.map(String).join('、') : '';

export const numberOrNull = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

export function nodePayload(base: NodeRecord, draft: NodeDraft): NodeRecord {
  const cost = splitList(draft.cost);
  return {
    ...base,
    kind: draft.kind,
    title: draft.title.trim(),
    body: draft.body,
    strength: draft.strength,
    span: { from: numberOrNull(draft.from), to: numberOrNull(draft.to) },
    aliases: splitList(draft.aliases),
    cost: draft.kind === 'axiom' ? cost : [],
    proposition: draft.proposition.trim() || null,
    // API 读的是 snake_case；base 里可能是 camelCase，统一在这里落成已知键。
    conflicts_with: Array.isArray(base['conflictsWith'])
      ? base['conflictsWith']
      : (Array.isArray(base['conflicts_with']) ? base['conflicts_with'] : []),
    same_as: Array.isArray(base['sameAs'])
      ? base['sameAs']
      : (Array.isArray(base['same_as']) ? base['same_as'] : []),
  };
}

export function relationOptions(
  nodes: NodeRecord[], field: RelationField, selfId: string,
): { id: string; title: string }[] {
  return nodes
    .filter((n) => n['id'] !== selfId)
    .filter((n) => (field === 'derives'
      ? n['kind'] === 'axiom'
      : field === 'manifests' ? n['kind'] === 'entry' : true))
    .map((n) => ({
      id: String(n['id'] ?? ''),
      title: String(n['title'] ?? n['id'] ?? ''),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, 'zh'));
}
