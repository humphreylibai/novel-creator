import { describe, it, expect } from 'vitest';
import { runRules } from '../../src/engine/rules';
import { buildGraph } from '../../src/engine/graph';
import type { WorldNode } from '../../src/engine/types';

const mk = (p: Partial<WorldNode> & { id: string; title: string }): WorldNode => ({
  kind: 'entry', subtype: null, aliases: [], strength: 'soft', span: { from: null, to: null },
  proposition: null, cost: [], derives: [], manifests: [], requires: [], conflictsWith: [],
  sameAs: [], violations: [], extra: {}, body: '这是一段足够长的正文内容，避免触发 R10。', file: '', ...p
});
const run = (nodes: WorldNode[]) => runRules({ nodes, graph: buildGraph(nodes, []) });

describe('显式冲突规则', () => {
  it('R1：两条 hard 登记互斥报 error 并给三种解法', () => {
    const f = run([
      mk({ id: 'W-AX-1', title: '法则甲', kind: 'axiom', strength: 'hard', cost: ['甲'], conflictsWith: ['W-AX-2'] }),
      mk({ id: 'W-AX-2', title: '法则乙', kind: 'axiom', strength: 'hard', cost: ['乙'] })
    ]).find((x) => x.rule === 'R1');
    expect(f?.severity).toBe('error');
    expect(f?.actions).toHaveLength(3);
  });
  it('R1：没有 conflicts_with 的两条 hard 不报', () => {
    const f = run([
      mk({ id: 'W-AX-1', title: '法则甲', kind: 'axiom', strength: 'hard', cost: ['甲'] }),
      mk({ id: 'W-AX-2', title: '法则乙', kind: 'axiom', strength: 'hard', cost: ['乙'] })
    ]);
    expect(f.some((x) => x.rule === 'R1')).toBe(false);
  });
  it('R1：互指的两条边只报一个，nodeIds 为两个节点', () => {
    const findings = run([
      mk({ id: 'W-AX-1', title: '法则甲', kind: 'axiom', strength: 'hard', cost: ['甲'], conflictsWith: ['W-AX-2'] }),
      mk({ id: 'W-AX-2', title: '法则乙', kind: 'axiom', strength: 'hard', cost: ['乙'], conflictsWith: ['W-AX-1'] })
    ]).filter((x) => x.rule === 'R1');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.nodeIds.sort()).toEqual(['W-AX-1', 'W-AX-2']);
  });
  it('R3：myth 与 hard 冲突只给 info，并追问谁在撒谎', () => {
    const f = run([
      mk({ id: 'E-1', title: '玄帝传说', strength: 'myth', conflictsWith: ['W-AX-1'] }),
      mk({ id: 'W-AX-1', title: '法则甲', kind: 'axiom', strength: 'hard', cost: ['甲'] })
    ]).find((x) => x.rule === 'R3');
    expect(f?.severity).toBe('info');
    expect(f?.hint).toMatch(/撒谎/);
  });
  it('R2：firm 记了违反但没有后果条目报 warn', () => {
    const f = run([mk({ id: 'E-1', title: '法师不得为己施法', strength: 'firm', violations: ['有人偷偷做过'] })]);
    expect(f.some((x) => x.rule === 'R2')).toBe(true);
  });
  it('R2：有 requires 后果条目不报', () => {
    const f = run([
      mk({ id: 'E-1', title: '法师不得为己施法', strength: 'firm', violations: ['有人偷偷做过'] }),
      mk({ id: 'E-2', title: '废籍之刑', requires: ['E-1'] })
    ]);
    expect(f.some((x) => x.rule === 'R2')).toBe(false);
  });
  it('R2：有 derives 后果条目不报', () => {
    const f = run([
      mk({ id: 'E-1', title: '法师不得为己施法', strength: 'firm', violations: ['有人偷偷做过'] }),
      mk({ id: 'E-2', title: '私施法的后遗症', derives: ['E-1'] })
    ]);
    expect(f.some((x) => x.rule === 'R2')).toBe(false);
  });
});
