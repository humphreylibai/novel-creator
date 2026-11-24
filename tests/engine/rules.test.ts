import { describe, it, expect } from 'vitest';
import { runRules } from '../../src/engine/rules';
import { buildGraph } from '../../src/engine/graph';
import type { WorldNode } from '../../src/engine/types';

const mk = (p: Partial<WorldNode> & { id: string; title: string }): WorldNode => ({
  kind: 'entry', subtype: null, aliases: [], strength: 'soft', span: { from: null, to: null },
  proposition: null, cost: [], derives: [], manifests: [], requires: [], conflictsWith: [],
  sameAs: [], violations: [], extra: {}, body: '这是一段足够长的正文，用来避免 R10 触发。', file: `nodes/${p.title}.md`, ...p
});
const run = (nodes: WorldNode[]) => runRules({ nodes, graph: buildGraph(nodes, []) });

describe('内容规则', () => {
  it('R4：无 derives 也无 requires 报 warn', () => {
    const f = run([mk({ id: 'E-1', title: '无根条目' })]);
    expect(f.find((x) => x.rule === 'R4')?.severity).toBe('warn');
  });
  it('R5：从未被引用报 info', () => {
    const f = run([mk({ id: 'E-1', title: '未被引用', derives: ['W-AX-1'] })]);
    expect(f.find((x) => x.rule === 'R5')?.severity).toBe('info');
  });
  it('R10：正文过短且无表现报 warn', () => {
    const f = run([mk({ id: 'E-1', title: '空壳', derives: ['W-AX-1'], body: '短' })]);
    expect(f.some((x) => x.rule === 'R10')).toBe(true);
  });
  it('R10：被公理列为表现的短条目不再报', () => {
    const nodes = [
      mk({ id: 'W-AX-1', title: '公理甲', kind: 'axiom', strength: 'hard', cost: ['记忆'], manifests: ['E-1'] }),
      mk({ id: 'E-1', title: '短表现', derives: ['W-AX-1'], body: '短' })
    ];
    const f = run(nodes);
    expect(f.some((x) => x.rule === 'R10' && x.nodeIds.includes('E-1'))).toBe(false);
  });
  it('R11：公理少于 3 条报 info', () => {
    const f = run([mk({ id: 'W-AX-1', title: '唯一公理', kind: 'axiom', strength: 'hard', cost: ['记忆'] })]);
    expect(f.find((x) => x.rule === 'R11')?.severity).toBe('info');
  });
  it('R12：公理表现少于 2 个报 warn', () => {
    const nodes = [
      mk({ id: 'W-AX-1', title: '公理甲', kind: 'axiom', strength: 'hard', cost: ['记忆'], manifests: ['E-1', 'E-2'] }),
      mk({ id: 'E-1', title: '表现一', derives: ['W-AX-1'] }),
      mk({ id: 'E-2', title: '表现二', derives: ['W-AX-1'] }),
      mk({ id: 'W-AX-2', title: '公理乙', kind: 'axiom', strength: 'hard', cost: ['身份'] }),
      mk({ id: 'W-AX-3', title: '公理丙', kind: 'axiom', strength: 'hard', cost: ['亲情'] })
    ];
    expect(run(nodes).find((x) => x.rule === 'R12')?.nodeIds).toEqual(['W-AX-2', 'W-AX-3']);
  });
  it('结果按 error → warn → info 排序', () => {
    const order = run([mk({ id: 'E-1', title: '无根' })]).map((x) => x.severity);
    const rank = (s: string) => ['error', 'warn', 'info'].indexOf(s);
    expect(order).toEqual([...order].sort((a, b) => rank(a) - rank(b)));
  });
});
