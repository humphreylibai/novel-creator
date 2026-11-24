import type { Finding } from '../types.js';
import type { Rule } from './content.js';

// P0 的边界：语义互斥需要 AI 判读，这里只认「显式登记的 conflicts_with」。
const edges = (nodes: { id: string; conflictsWith: string[] }[]) => {
  const out: [string, string][] = [];
  for (const n of nodes) for (const to of n.conflictsWith) out.push([n.id, to]);
  return out;
};

export const R1: Rule = ({ nodes }) => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const [from, to] of edges(nodes)) {
    const a = byId.get(from); const b = byId.get(to);
    if (!a || !b || a.strength !== 'hard' || b.strength !== 'hard') continue;
    const key = [from, to].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      rule: 'R1', severity: 'error', nodeIds: [a.id, b.id],
      message: `两条 hard 法则登记为互斥：「${a.title}」与「${b.title}」`,
      hint: '它们不可能同时成立', actions: ['改 A', '改 B', '限定为不同地区/年代']
    });
  }
  return out;
};

export const R3: Rule = ({ nodes }) => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const [from, to] of edges(nodes)) {
    const a = byId.get(from); const b = byId.get(to);
    if (!a || !b) continue;
    const myth = a.strength === 'myth' ? a : b.strength === 'myth' ? b : null;
    const hard = a.strength === 'hard' ? a : b.strength === 'hard' ? b : null;
    if (!myth || !hard) continue;
    const key = [myth.id, hard.id].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      rule: 'R3', severity: 'info', nodeIds: [myth.id, hard.id],
      message: `「${myth.title}」与硬法则「${hard.title}」冲突——这是设定好的误会吗？`,
      hint: '谁在撒谎，他得到什么？', actions: ['生成认知记录', '标记为民间误传']
    });
  }
  return out;
};

export const R2: Rule = ({ nodes, graph }) => {
  const out: Finding[] = [];
  for (const n of nodes) {
    if (n.strength !== 'firm' || n.violations.length === 0) continue;
    const consequence = (graph.inbound.get(n.id) ?? [])
      .some((e) => e.type === 'requires' || e.type === 'derives');
    if (!consequence) {
      out.push({
        rule: 'R2', severity: 'warn', nodeIds: [n.id],
        message: `「${n.title}」写了有人违反，但没有登记后果`,
        hint: '破规矩要付代价：补一个后果条目，或降级为 soft',
        actions: ['补后果条目', '降级为 soft']
      });
    }
  }
  return out;
};

export const explicitRules: Rule[] = [R1, R2, R3];
