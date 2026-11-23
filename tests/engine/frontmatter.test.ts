import { describe, it, expect } from 'vitest';
import { parseNode, serializeNode } from '../../src/engine/frontmatter';

const RAW = `---
kind: axiom
id: W-AX-002
title: 记忆即燃料
strength: hard
span: { from: -1200, to: null }
proposition: 施法会永久烧毁施法者的记忆
cost: [记忆, 身份]
---

施法会永久烧毁施法者的记忆。

这条规则不是秘密。
`;

describe('front matter 编解码', () => {
  it('解析出结构化字段与正文', () => {
    const n = parseNode(RAW, 'nodes/记忆即燃料.md');
    expect(n.id).toBe('W-AX-002');
    expect(n.kind).toBe('axiom');
    expect(n.strength).toBe('hard');
    expect(n.span).toEqual({ from: -1200, to: null });
    expect(n.cost).toEqual(['记忆', '身份']);
    expect(n.body.trim()).toBe('施法会永久烧毁施法者的记忆。\n\n这条规则不是秘密。');
  });

  it('缺省字段有安全默认值', () => {
    const n = parseNode('---\nid: E-1\ntitle: 无字塔\n---\n正文', 'nodes/无字塔.md');
    expect(n.kind).toBe('entry');
    expect(n.strength).toBe('soft');
    expect(n.derives).toEqual([]);
    expect(n.span).toEqual({ from: null, to: null });
  });

  it('序列化后可原样解析回来', () => {
    const n = parseNode(RAW, 'nodes/记忆即燃料.md');
    expect(parseNode(serializeNode(n), n.file)).toEqual(n);
  });

  it('缺少围栏时抛错', () => {
    expect(() => parseNode('没有 front matter', 'x.md')).toThrow(/front matter/i);
  });

  it('snake_case 字段映射到 camelCase', () => {
    const n = parseNode(
      '---\nid: E-1\ntitle: 无字塔\nconflicts_with: [W-AX-002]\nsame_as: [E-MF-004]\n---\n正文',
      'nodes/无字塔.md'
    );
    expect(n.conflictsWith).toEqual(['W-AX-002']);
    expect(n.sameAs).toEqual(['E-MF-004']);
  });

  it('未知键收进 extra 并往返写回', () => {
    const n = parseNode(
      '---\nid: E-2\ntitle: 无字塔\ntags: [a, b]\nsource: 手写\n---\n正文',
      'nodes/无字塔.md'
    );
    expect(n.extra).toEqual({ tags: ['a', 'b'], source: '手写' });
    expect(parseNode(serializeNode(n), n.file).extra).toEqual({ tags: ['a', 'b'], source: '手写' });
  });

  it('数组字段接受标量写法', () => {
    const n = parseNode(
      '---\nid: E-3\ntitle: 无字塔\ncost: 记忆\nderives: W-AX-002\n---\n正文',
      'nodes/无字塔.md'
    );
    expect(n.cost).toEqual(['记忆']);
    expect(n.derives).toEqual(['W-AX-002']);
  });

  it('空 front matter 块可解析', () => {
    const n = parseNode('---\n---\n正文', 'nodes/空.md');
    expect(n.kind).toBe('entry');
    expect(n.extra).toEqual({});
  });

  it('枚举大小写不敏感', () => {
    const n = parseNode(
      '---\nkind: AXiom\nstrength: Hard\n---\n正文',
      'nodes/大小写.md'
    );
    expect(n.kind).toBe('axiom');
    expect(n.strength).toBe('hard');
  });

  it('标量 front matter 不产生字符索引键', () => {
    const n = parseNode('---\n记忆即燃料\n---\n正文', 'nodes/散.md');
    expect(n.extra).toEqual({});
    expect(n.body).toBe('正文');
    expect(n.kind).toBe('entry');
  });

  it('序列 front matter 不产生索引键且往返不变成 map', () => {
    const n = parseNode('---\n- a\n- b\n---\n正文', 'nodes/列表.md');
    expect(n.extra).toEqual({});
    expect(n.body).toBe('正文');
    const again = parseNode(serializeNode(n), n.file);
    expect(again.extra).toEqual({});
    expect(Object.keys(again.extra)).not.toContain('0');
  });

  it('原型相关键不进 extra，也不污染原型', () => {
    const n = parseNode('---\n__proto__: { polluted: true }\nid: E-1\n---\n正文', 'nodes/原型.md');
    expect(Object.prototype.hasOwnProperty.call(n.extra, '__proto__')).toBe(false);
    expect(Object.getPrototypeOf(n.extra)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(n.id).toBe('E-1');
  });
});
