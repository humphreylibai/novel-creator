import { describe, it, expect } from 'vitest';
import { parseWikiLinks, resolveTargets } from '../../src/engine/wikiLink';
import type { WorldNode } from '../../src/engine/types';

const mk = (id: string, title: string, aliases: string[] = []): WorldNode => ({
  id, kind: 'entry', subtype: null, title, aliases, strength: 'soft',
  span: { from: null, to: null }, proposition: null, cost: [], derives: [], manifests: [],
  requires: [], conflictsWith: [], sameAs: [], violations: [], extra: {}, body: '', file: ''
});

describe('wikiLink', () => {
  it('抽出双链目标并去重', () => {
    expect(parseWikiLinks('他把[[欠名录]]又添了三个名字。[[玄帝]]那年。[[欠名录]]'))
      .toEqual(['欠名录', '玄帝']);
  });
  it('忽略未闭合的方括号', () => {
    expect(parseWikiLinks('这是[[没闭合，还有[[好的一对]]')).toEqual(['好的一对']);
  });
  it('按标题与别名解析到 id，缺的单独列出', () => {
    const r = resolveTargets([mk('E-1', '还脉礼', ['还脉']), mk('E-2', '玄帝')], ['还脉', '玄帝', '不存在']);
    expect(r.resolved.get('还脉')).toBe('E-1');
    expect(r.missing).toEqual(['不存在']);
  });
});
