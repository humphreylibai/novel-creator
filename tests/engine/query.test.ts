import { describe, it, expect } from 'vitest';
import { stateAt } from '../../src/engine/query';
import type { WorldNode } from '../../src/engine/types';

const mk = (p: Partial<WorldNode> & { id: string; title: string }): WorldNode => ({
  kind: 'entry', subtype: null, aliases: [], strength: 'soft', span: { from: null, to: null },
  proposition: null, cost: [], derives: [], manifests: [], requires: [], conflictsWith: [],
  sameAs: [], violations: [], extra: {}, body: '', file: '', ...p
});

const nodes = [
  mk({ id: 'E-1', title: '脉正', span: { from: 412, to: 720 } }),
  mk({ id: 'E-2', title: '记忆当铺', span: { from: 588, to: null } }),
  mk({ id: 'E-3', title: '禁法运动', span: { from: 572, to: 600 } }),
  mk({ id: 'E-4', title: '还脉礼', span: { from: 300, to: null } })
];

describe('stateAt', () => {
  it('612 年在场的条目', () => {
    expect(stateAt(nodes, 612).map((n) => n.id)).toEqual(['E-1', 'E-2', 'E-4']);
  });
  it('端点包含：600 年是禁法运动最后一年', () => {
    expect(stateAt(nodes, 600).map((n) => n.id)).toContain('E-3');
  });
  it('601 年不再包含', () => {
    expect(stateAt(nodes, 601).map((n) => n.id)).not.toContain('E-3');
  });
  it('from 为 null 表示一直存在', () => {
    expect(stateAt([mk({ id: 'E-9', title: '永恒' })], -5000)).toHaveLength(1);
  });
});
