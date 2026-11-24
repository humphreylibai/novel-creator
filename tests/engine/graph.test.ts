import { describe, it, expect } from 'vitest';
import { buildGraph } from '../../src/engine/graph';
import type { WorldNode } from '../../src/engine/types';
import type { Fragment } from '../../src/host/store';

const mk = (p: Partial<WorldNode> & { id: string; title: string }): WorldNode => ({
  kind: 'entry', subtype: null, aliases: [], strength: 'soft', span: { from: null, to: null },
  proposition: null, cost: [], derives: [], manifests: [], requires: [], conflictsWith: [],
  sameAs: [], violations: [], extra: {}, body: '', file: `nodes/${p.title}.md`, ...p
});
const frag = (id: string, text: string): Fragment => ({ id, chapter: 1, scene: 1, text, file: `fragments/${id}.md` });

describe('graph', () => {
  it('derives 同时记出入边', () => {
    const g = buildGraph([
      mk({ id: 'W-AX-002', title: '记忆即燃料', kind: 'axiom', strength: 'hard', cost: ['记忆'] }),
      mk({ id: 'E-1', title: '法师无法世袭', derives: ['W-AX-002'] })
    ], []);
    expect(g.outbound.get('E-1')).toContainEqual({ type: 'derives', from: 'E-1', to: 'W-AX-002' });
    expect(g.inbound.get('W-AX-002')).toContainEqual({ type: 'derives', from: 'E-1', to: 'W-AX-002' });
  });

  it('正文双链变成 cites 入边', () => {
    const g = buildGraph([mk({ id: 'E-1', title: '欠名录' })], [frag('第03章-02', '袖口的[[欠名录]]又多了三个名字')]);
    expect(g.inbound.get('E-1')).toContainEqual({ type: 'cites', from: 'fragments/第03章-02.md', to: 'E-1' });
  });

  it('别名进索引，未解析的双链进 missingLinks', () => {
    const g = buildGraph([mk({ id: 'E-1', title: '还脉礼', aliases: ['还脉'] })], [frag('f1', '[[还脉]]与[[不存在的词]]')]);
    expect(g.aliasIndex.get('还脉')).toEqual(['E-1']);
    expect(g.missingLinks).toContain('不存在的词');
  });
});
