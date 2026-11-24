export interface WorldDraftInput {
  id: string;
  title: string;
  wound: string;
  motif: string;
  epoch: string;
  start: string;
  end: string;
}

const yamlString = (s: string) => JSON.stringify(s);

const intOr = (raw: string, fallback: number): string => {
  const n = Number(raw);
  return Number.isFinite(n) ? String(n) : String(fallback);
};

/** 表单 → world.yaml；字符串用 JSON 双引号转义，避免冒号/引号破坏 YAML。 */
export function buildWorldConfig(i: WorldDraftInput): string {
  const id = i.id.trim();
  const end = i.end.trim() === '' ? 'null' : intOr(i.end, 1);
  return `id: ${yamlString(id)}
title: ${yamlString(i.title.trim() || id)}
genre: { allowed: [历史], forbidden: [], expectation: '' }
calendar:
  epochs: [{ name: ${yamlString(i.epoch.trim() || '新历')}, start: ${intOr(i.start, 1)}, end: ${end} }]
  format: "{year}"
theme:
  wound: ${yamlString(i.wound.trim())}
  motif: ${yamlString(i.motif.trim())}
`;
}
