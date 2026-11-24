import type { Finding } from '../engine/types.js';

const LABEL: Record<string, string> = {
  R4: '无公理支撑',
  R5: '未被正文引用',
  R1: '有未决矛盾',
  R6: '有未决矛盾',
  R3: '认知冲突',
  R9: '高置信认知冲突',
};

/** 卡片角标只汇总与「找设定」相关的规则，按固定顺序去重。 */
export function badgesFor(findings: Finding[], nodeId: string): string[] {
  const out: string[] = [];
  for (const f of findings) {
    if (!f.nodeIds.includes(nodeId)) continue;
    const label = LABEL[f.rule];
    if (label && !out.includes(label)) out.push(label);
  }
  return out;
}
