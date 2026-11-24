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

describe('结构规则', () => {
  it('R7：条目 span 超出公理 span 报 error', () => {
    const f = run([
      mk({ id: 'W-AX-1', title: '记忆即燃料', kind: 'axiom', strength: 'hard', cost: ['记忆'], span: { from: -1200, to: 700 } }),
      mk({ id: 'E-1', title: '脉正', derives: ['W-AX-1'], span: { from: 412, to: 720 } })
    ]).find((x) => x.rule === 'R7');
    expect(f?.severity).toBe('error');
    expect(f?.nodeIds).toEqual(['E-1']);
  });
  it('R7：span 被完全覆盖时不报', () => {
    const f = run([
      mk({ id: 'W-AX-1', title: '记忆即燃料', kind: 'axiom', strength: 'hard', cost: ['记忆'], span: { from: -1200, to: null } }),
      mk({ id: 'E-1', title: '脉正', derives: ['W-AX-1'], span: { from: 412, to: 720 } })
    ]);
    expect(f.some((x) => x.rule === 'R7')).toBe(false);
  });
  it('R7：只被 manifests 列出、没有 derives 的条目越界仍报', () => {
    const f = run([
      mk({ id: 'W-AX-1', title: '记忆即燃料', kind: 'axiom', strength: 'hard', cost: ['记忆'], span: { from: -1200, to: 700 }, manifests: ['E-1'] }),
      mk({ id: 'E-1', title: '脉正', span: { from: 412, to: 720 } })
    ]).find((x) => x.rule === 'R7');
    expect(f?.severity).toBe('error');
    expect(f?.nodeIds).toEqual(['E-1']);
    expect(f?.hint).toMatch(/覆盖不到/);
  });
  it('R7：公理不参与越界检查', () => {
    const f = run([
      mk({ id: 'W-AX-1', title: '记忆即燃料', kind: 'axiom', strength: 'hard', cost: ['记忆'], span: { from: -1200, to: 700 } }),
      mk({ id: 'W-AX-2', title: '记忆可交易', kind: 'axiom', strength: 'hard', cost: ['记忆'], derives: ['W-AX-1'], span: { from: 412, to: 720 } })
    ]);
    expect(f.some((x) => x.rule === 'R7')).toBe(false);
  });
  it('R6：别名指向两个节点且 span 重叠报 error', () => {
    const f = run([
      mk({ id: 'E-1', title: '玄帝', aliases: ['玄天大帝'], span: { from: 300, to: null } }),
      mk({ id: 'E-2', title: '玄天大帝', aliases: ['玄帝'], span: { from: 500, to: null } })
    ]).find((x) => x.rule === 'R6');
    expect(f?.severity).toBe('error');
    expect(f?.nodeIds.sort()).toEqual(['E-1', 'E-2']);
  });
  it('R6：建立 same_as 后不报（别名持有者指向对方）', () => {
    const f = run([
      mk({ id: 'E-1', title: '玄帝', aliases: ['玄天大帝'], span: { from: 300, to: null }, sameAs: ['E-2'] }),
      mk({ id: 'E-2', title: '玄天大帝', aliases: ['玄帝'], span: { from: 500, to: null } })
    ]);
    expect(f.some((x) => x.rule === 'R6')).toBe(false);
  });
  it('R6：建立 same_as 后不报（对方指回来也算）', () => {
    const f = run([
      mk({ id: 'E-1', title: '玄帝', aliases: ['玄天大帝'], span: { from: 300, to: null } }),
      mk({ id: 'E-2', title: '玄天大帝', aliases: ['玄帝'], span: { from: 500, to: null }, sameAs: ['E-1'] })
    ]);
    expect(f.some((x) => x.rule === 'R6')).toBe(false);
  });
  it('R6 与 R8 在 same_as 建立后同时消失', () => {
    const f = run([
      mk({ id: 'E-1', title: '玄帝', aliases: ['玄天大帝'], span: { from: 300, to: null }, sameAs: ['E-2'] }),
      mk({ id: 'E-2', title: '玄天大帝', aliases: ['玄帝'], span: { from: 500, to: null } })
    ]);
    expect(f.some((x) => x.rule === 'R6')).toBe(false);
    expect(f.some((x) => x.rule === 'R8')).toBe(false);
  });
  it('R8：标题互为别名但没有 same_as 时给建议', () => {
    const f = run([
      mk({ id: 'E-1', title: '玄帝', aliases: ['玄天大帝'] }),
      mk({ id: 'E-2', title: '玄天大帝' })
    ]);
    expect(f.some((x) => x.rule === 'R8')).toBe(true);
  });
});
