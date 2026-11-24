import type { Belief, Finding, WorldNode } from '../types.js';

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/**
 * R9 的可解释近似：只看 hard 条目、confidence > 0.8，且 belief 文本没有包含
 * 目标命题（没有命题时看标题/别名）。这不是语义判读，漏报改写型冲突是已知的。
 */
export function r9Beliefs(nodes: WorldNode[], beliefs: Belief[]): Finding[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return beliefs.flatMap((b) => {
    const n = byId.get(b.target);
    if (!n || n.strength !== 'hard' || b.confidence <= 0.8) return [];
    const expected = (n.proposition?.trim()
      ? [n.proposition]
      : [n.title, ...n.aliases]).map(norm).filter(Boolean);
    const claim = norm(b.content);
    const exact = expected.some((x) => x && claim === x);
    // 包含标题但带否定/贬义，仍可能是“高置信地信错”；完全等于命题才算不冲突。
    const negative = /不|没|非|假|谎|骗|错|贪|恶|坏|死|失败|否认|质疑/.test(claim);
    if (exact || (expected.some((x) => x && claim.includes(x)) && !negative)) return [];
    return [{
      rule: 'R9',
      severity: 'warn' as const,
      nodeIds: [n.id],
      message: `${b.holder} 以 ${b.confidence} 的置信相信「${b.content}」，与 hard 条目「${n.title}」的命题不一致；是误解，还是写漏？`,
      hint: '确认这是认知层的谎言/误解，或修正条目；R9 不做语义判读',
    }];
  });
}
