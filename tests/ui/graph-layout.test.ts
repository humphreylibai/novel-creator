import { describe, expect, it } from 'vitest';
import { buildEdges, forceLayout } from '../../src/ui/graphLayout.js';

const nodes = [
  { id: 'W-AX-1', kind: 'axiom', title: '公理', manifests: ['E-1', 'E-2'] },
  { id: 'E-1', kind: 'entry', title: '一', derives: ['W-AX-1'], conflictsWith: ['E-2'] },
  { id: 'E-2', kind: 'entry', title: '二', derives: ['W-AX-1'] },
];

describe('buildEdges', () => {
  it('汇总五类关系并去重', () => {
    const edges = buildEdges(nodes);
    expect(edges).toContainEqual({ source: 'W-AX-1', target: 'E-1', via: 'manifests' });
    expect(edges).toContainEqual({ source: 'E-1', target: 'W-AX-1', via: 'derives' });
    expect(edges).toContainEqual({ source: 'E-1', target: 'E-2', via: 'conflicts' });
    expect(new Set(edges.map((e) => `${e.source}|${e.target}|${e.via}`)).size).toBe(edges.length);
  });
});

describe('forceLayout', () => {
  it('所有节点都有有限坐标，且两次结果一致', () => {
    const edges = buildEdges(nodes);
    const a = forceLayout(nodes, edges, { width: 800, height: 600, iterations: 40 });
    const b = forceLayout(nodes, edges, { width: 800, height: 600, iterations: 40 });
    expect([...a.keys()]).toEqual(['W-AX-1', 'E-1', 'E-2']);
    for (const p of a.values()) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(36);
      expect(p.x).toBeLessThanOrEqual(764);
      expect(p.y).toBeGreaterThanOrEqual(36);
      expect(p.y).toBeLessThanOrEqual(564);
    }
    expect(a).toEqual(b);
  });

  it('单个节点不崩', () => {
    const p = forceLayout([{ id: 'only', title: '一' }], [], { iterations: 1 });
    expect(Number.isFinite(p.get('only')!.x)).toBe(true);
  });
});
