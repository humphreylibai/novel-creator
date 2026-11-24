import { describe, it, expect } from 'vitest';
import { runRules } from '../../src/engine/rules';
import { buildGraph } from '../../src/engine/graph';
import type { WorldNode } from '../../src/engine/types';
import type { Fragment } from '../../src/host/store';

const mk = (p: Partial<WorldNode> & { id: string; title: string }): WorldNode => ({
  kind: 'entry', subtype: null, aliases: [], strength: 'soft', span: { from: null, to: null },
  proposition: null, cost: [], derives: [], manifests: [], requires: [], conflictsWith: [],
  sameAs: [], violations: [], extra: {}, body: '这是一段足够长的正文，用来避免 R10 触发。', file: `nodes/${p.title}.md`, ...p
});
const frag = (id: string, text: string): Fragment => ({ id, chapter: 1, scene: 1, text, file: `fragments/${id}.md` });
const run = (nodes: WorldNode[], fragments: Fragment[] = []) =>
  runRules({ nodes, graph: buildGraph(nodes, fragments) });

describe('内容规则', () => {
  it('R4：无 derives 也无 requires 报 warn', () => {
    const f = run([mk({ id: 'E-1', title: '无根条目' })]);
    expect(f.find((x) => x.rule === 'R4')?.severity).toBe('warn');
  });
  it('R4：被公理 manifests 列出的条目不算孤儿', () => {
    const nodes = [
      mk({ id: 'W-AX-1', title: '公理甲', kind: 'axiom', strength: 'hard', cost: ['记忆'], manifests: ['E-1'] }),
      mk({ id: 'E-1', title: '被表现条目' })
    ];
    const f = run(nodes);
    expect(f.some((x) => x.rule === 'R4' && x.nodeIds.includes('E-1'))).toBe(false);
  });
  it('R5：从未被引用报 info', () => {
    const f = run([mk({ id: 'E-1', title: '未被引用', derives: ['W-AX-1'] })]);
    expect(f.find((x) => x.rule === 'R5')?.severity).toBe('info');
  });
  it('R5：正文有 cites 的条目不报', () => {
    const nodes = [mk({ id: 'E-1', title: '已入正文' })];
    const f = run(nodes, [frag('第03章-02', '袖口的[[已入正文]]又多了三个名字')]);
    expect(f.some((x) => x.rule === 'R5' && x.nodeIds.includes('E-1'))).toBe(false);
  });
  it('R5：公理不报「从未进入正文」', () => {
    const f = run([mk({ id: 'W-AX-1', title: '公理甲', kind: 'axiom', strength: 'hard', cost: ['记忆'] })]);
    expect(f.some((x) => x.rule === 'R5' && x.nodeIds.includes('W-AX-1'))).toBe(false);
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
  it('R10：正文过短但自己有 manifests 的公理不报', () => {
    const nodes = [
      mk({ id: 'W-AX-1', title: '公理甲', kind: 'axiom', strength: 'hard', cost: ['记忆'], manifests: ['E-1'], body: '短' }),
      mk({ id: 'E-1', title: '表现一', derives: ['W-AX-1'] })
    ];
    const f = run(nodes);
    expect(f.some((x) => x.rule === 'R10' && x.nodeIds.includes('W-AX-1'))).toBe(false);
  });
  it('R11：公理少于 3 条报 info', () => {
    const f = run([mk({ id: 'W-AX-1', title: '唯一公理', kind: 'axiom', strength: 'hard', cost: ['记忆'] })]);
    expect(f.find((x) => x.rule === 'R11')?.severity).toBe('info');
  });
  it('R11：3 条公理时不报', () => {
    const nodes = [
      mk({ id: 'W-AX-1', title: '公理甲', kind: 'axiom', strength: 'hard', cost: ['甲'] }),
      mk({ id: 'W-AX-2', title: '公理乙', kind: 'axiom', strength: 'hard', cost: ['乙'] }),
      mk({ id: 'W-AX-3', title: '公理丙', kind: 'axiom', strength: 'hard', cost: ['丙'] })
    ];
    expect(run(nodes).some((x) => x.rule === 'R11')).toBe(false);
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
  it('R12：悬空、重复、自指、空正文的表现都不算数', () => {
    const nodes = [
      // 悬空 id：只有 E-1 存在
      mk({ id: 'W-AX-1', title: '公理甲', kind: 'axiom', strength: 'hard', cost: ['甲'], manifests: ['E-1', 'GHOST-9'] }),
      // 重复 id：去重后只有 1 个
      mk({ id: 'W-AX-2', title: '公理乙', kind: 'axiom', strength: 'hard', cost: ['乙'], manifests: ['E-3', 'E-3'] }),
      // 自指：公理不能表现自己
      mk({ id: 'W-AX-3', title: '公理丙', kind: 'axiom', strength: 'hard', cost: ['丙'], manifests: ['W-AX-3'] }),
      // 空正文 stub：trim 后为空
      mk({ id: 'W-AX-4', title: '公理丁', kind: 'axiom', strength: 'hard', cost: ['丁'], manifests: ['E-1', 'E-4'] }),
      mk({ id: 'E-1', title: '表现一' }),
      mk({ id: 'E-3', title: '表现三' }),
      mk({ id: 'E-4', title: '空壳表现', body: '   ' })
    ];
    const findings = run(nodes).filter((x) => x.rule === 'R12');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.nodeIds).toEqual(['W-AX-1', 'W-AX-2', 'W-AX-3', 'W-AX-4']);
  });
  it('R12：去重后仍有两个有效表现时不报', () => {
    const nodes = [
      mk({ id: 'W-AX-1', title: '公理甲', kind: 'axiom', strength: 'hard', cost: ['甲'], manifests: ['E-1', 'E-2', 'E-2', 'E-1'] }),
      mk({ id: 'E-1', title: '表现一', derives: ['W-AX-1'] }),
      mk({ id: 'E-2', title: '表现二', derives: ['W-AX-1'] })
    ];
    expect(run(nodes).some((x) => x.rule === 'R12')).toBe(false);
  });
  it('结果按 error → warn → info 排序', () => {
    const nodes = [
      mk({ id: 'E-1', title: '无根条目' }),
      mk({ id: 'W-AX-1', title: '法则甲', kind: 'axiom', strength: 'hard', cost: ['甲'], conflictsWith: ['W-AX-2'] }),
      mk({ id: 'W-AX-2', title: '法则乙', kind: 'axiom', strength: 'hard', cost: ['乙'] })
    ];
    const findings = run(nodes);
    const order = findings.map((x) => x.severity);
    const rank = (s: string) => ['error', 'warn', 'info'].indexOf(s);
    expect(order).toEqual([...order].sort((a, b) => rank(a) - rank(b)));
    // R1 的 error 由 explicitRules 最后产出；去掉 runRules 的 sort 时，这里会是 R4 的 warn
    expect(findings[0]?.rule).toBe('R1');
    expect(order).toEqual(['error', 'warn', 'warn', 'info', 'info']);
  });
});
