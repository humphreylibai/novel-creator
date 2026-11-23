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
});
