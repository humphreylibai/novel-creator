export interface FragmentDraft {
  chapter: string;
  scene: string;
  text: string;
}

const numOrNull = (raw: string): number | null => {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

/** 表单字符串 → API 的 number|null；正文不改写。 */
export function fragmentPayload(draft: FragmentDraft): {
  chapter: number | null; scene: number | null; text: string;
} {
  return { chapter: numOrNull(draft.chapter), scene: numOrNull(draft.scene), text: draft.text };
}
