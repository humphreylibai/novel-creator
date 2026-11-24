import { describe, expect, it } from 'vitest';
import { interrogate, rulingAdvice, suggestProposition } from '../../src/engine/suggest.js';
import type { Finding, WorldNode } from '../../src/engine/types.js';

const node = (over: Partial<WorldNode>): WorldNode => ({
  id: 'E-1', kind: 'entry', subtype: null, title: '还脉礼',
  aliases: [], strength: 'soft', span: { from: null, to: null },
  proposition: null, cost: [], derives: [], manifests: [], requires: [],
  conflictsWith: [], sameAs: [], violations: [], extra: {}, body: '',
  file: 'nodes/E-1.md', ...over,
});

describe('suggestProposition', () => {
  it('有命题就返回，没有就用正文第一句/占位句', () => {
    expect(suggestProposition(node({ proposition: '已写' }))).toBe('已写');
    expect(suggestProposition(node({ body: '他把礼器交还。后面还有。' }))).toBe('他把礼器交还。');
    expect(suggestProposition(node({}))).toContain('还脉礼');
  });
});

describe('interrogate', () => {
  it('按缺口提问，包含公理代价与缺失目标', () => {
    const axiom = node({ kind: 'axiom', title: '记忆即燃料', manifests: ['ghost'], derives: [] });
    const qs = interrogate(axiom, [axiom]);
    expect(qs.join('\n')).toContain('代价');
    expect(qs.join('\n')).toContain('ghost');
    expect(qs.length).toBeLessThanOrEqual(8);
  });
});

describe('rulingAdvice', () => {
  it('互斥建议点名双方，R9 建议区分误解/谎言', () => {
    const a = node({ id: 'A', title: '皇权独断' });
    const b = node({ id: 'B', title: '天下为公' });
    const f: Finding = { rule: 'R1', severity: 'error', nodeIds: ['A', 'B'], message: '' };
    expect(rulingAdvice(f, [a, b])).toContain('皇权独断');
    expect(rulingAdvice(f, [a, b])).toContain('天下为公');
    const r9: Finding = { rule: 'R9', severity: 'warn', nodeIds: ['A'], message: '' };
    expect(rulingAdvice(r9, [a])).toContain('谎言');
  });
});
