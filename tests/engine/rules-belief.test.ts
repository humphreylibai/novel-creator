import { describe, expect, it } from 'vitest';
import { r9Beliefs } from '../../src/engine/rules/belief.js';
import type { Belief, WorldNode } from '../../src/engine/types.js';

const node = (over: Partial<WorldNode>): WorldNode => ({
  id: 'W-1', kind: 'entry', subtype: null, title: '玄帝没有一统天下',
  aliases: [], strength: 'hard', span: { from: null, to: null },
  proposition: '玄帝没有一统天下', cost: [], derives: [], manifests: [],
  requires: [], conflictsWith: [], sameAs: [], violations: [], extra: {},
  body: '正文正文正文正文正文', file: 'nodes/x.md',
  ...over,
});

const belief = (over: Partial<Belief>): Belief => ({
  id: 'B-1', holder: '民间', target: 'W-1',
  content: '玄帝曾一统天下', confidence: 0.9,
  source: [], span: { from: null, to: null }, file: 'beliefs/B-1.yaml',
  ...over,
});

describe('R9', () => {
  it('hard + 高置信 + 文本不一致 -> info', () => {
    const f = r9Beliefs([node({})], [belief({})]);
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ rule: 'R9', severity: 'info', nodeIds: ['W-1', 'B-1'] });
    expect(f[0]!.message).toContain('民间');
  });

  it('soft / confidence 恰好 0.8 / 文本包含命题 -> 不报', () => {
    expect(r9Beliefs([node({ strength: 'soft' })], [belief({})])).toEqual([]);
    expect(r9Beliefs([node({})], [belief({ confidence: 0.8 })])).toEqual([]);
    expect(r9Beliefs([node({})], [belief({ content: '玄帝没有一统天下' })])).toEqual([]);
  });

  it('命题/标题/别名命中即视为转述，句读差异忽略', () => {
    const n = node({ proposition: '玄帝没有一统天下', title: '海瑞', aliases: ['刚峰'] });
    expect(r9Beliefs([n], [belief({ content: '玄帝没有一统天下。' })])).toEqual([]);
    expect(r9Beliefs([n], [belief({ content: '刚峰是个清官' })])).toEqual([]);
    expect(r9Beliefs([n], [belief({ content: '另一个人曾统一天下' })])).toHaveLength(1);
  });
});
