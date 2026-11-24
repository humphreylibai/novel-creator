import type { Finding, WorldNode } from '../types.js';
import type { Graph } from '../graph.js';

export interface RuleContext { nodes: WorldNode[]; graph: Graph }
export type Rule = (ctx: RuleContext) => Finding[];

const refs = (g: Graph, id: string) => g.inbound.get(id) ?? [];

export const R4: Rule = ({ nodes }) =>
  nodes.filter((n) => n.kind === 'entry' && n.derives.length === 0 && n.requires.length === 0)
    .map((n) => ({
      rule: 'R4', severity: 'warn', nodeIds: [n.id],
      message: `「${n.title}」没有公理支撑，也没有被任何主体需要`,
      hint: '它从哪条公理长出来的？指定一条，或标记为设定装饰',
      actions: ['指定公理', '标记为设定装饰']
    }));

export const R5: Rule = ({ nodes, graph }) =>
  nodes.filter((n) => refs(graph, n.id).every((e) => e.type !== 'cites'))
    .map((n) => ({
      rule: 'R5', severity: 'info', nodeIds: [n.id],
      message: `「${n.title}」从未进入正文`, hint: '要么用，要么删'
    }));

export const R10: Rule = ({ nodes }) =>
  nodes.filter((n) => n.body.trim().length < 20 && n.manifests.length === 0)
    .map((n) => ({
      rule: 'R10', severity: 'warn', nodeIds: [n.id],
      message: `「${n.title}」只有标题`, hint: '补两句，或删'
    }));

export const R11: Rule = ({ nodes }) => {
  const axioms = nodes.filter((n) => n.kind === 'axiom');
  if (axioms.length >= 3) return [];
  return [{
    rule: 'R11', severity: 'info', nodeIds: axioms.map((a) => a.id),
    message: `公理只有 ${axioms.length} 条，世界还不成立`, hint: '至少要 3 条'
  }];
};

export const R12: Rule = ({ nodes }) => {
  const lacking = nodes.filter((n) => n.kind === 'axiom' && n.manifests.length < 2);
  if (lacking.length === 0) return [];
  return [{
    rule: 'R12', severity: 'warn', nodeIds: lacking.map((n) => n.id),
    message: `公理${lacking.map((n) => `「${n.title}」`).join('、')}的可感知表现少于 2 个（铁律二要求 ≥2）`,
    hint: '读者看不见这些公理', actions: ['给我三个表现候选']
  }];
};

export const contentRules: Rule[] = [R4, R5, R10, R11, R12];
