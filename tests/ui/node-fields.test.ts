import { describe, expect, it } from 'vitest';
import {
  joinList, nodePayload, numberOrNull, relationOptions, splitList,
} from '../../src/ui/nodeFields.js';

describe('nodeFields', () => {
  it('按中文/英文分隔符切列表并去空', () => {
    expect(splitList('记忆、身份, 亲情，  ')).toEqual(['记忆', '身份', '亲情']);
    expect(splitList('')).toEqual([]);
  });

  it('空字符串是 null 年份，数字字符串是数字', () => {
    expect(numberOrNull('')).toBeNull();
    expect(numberOrNull('1560')).toBe(1560);
    expect(numberOrNull('abc')).toBeNull();
  });

  it('payload 把 camelCase 关系写成服务端认识的 snake_case', () => {
    const base = { id: 'E-1', kind: 'entry', title: '旧', conflictsWith: ['W-AX-1'] };
    const draft = {
      kind: 'entry' as const, title: '海瑞', body: '正文', strength: 'firm',
      from: '1560', to: '1566', aliases: '海刚峰, 刚峰', cost: '',
      proposition: '',
    };
    const payload = nodePayload(base, draft);
    expect(payload).toMatchObject({
      id: 'E-1', kind: 'entry', title: '海瑞', strength: 'firm',
      span: { from: 1560, to: 1566 }, aliases: ['海刚峰', '刚峰'],
      cost: [], conflicts_with: ['W-AX-1'], same_as: [],
    });
  });

  it('joinList 把数组还原成顿号分隔文本', () => {
    expect(joinList(['记忆', '身份'])).toBe('记忆、身份');
    expect(joinList(undefined)).toBe('');
  });
});

describe('relationOptions', () => {
  const nodes = [
    { id: 'W-AX-1', kind: 'axiom', title: '公理一' },
    { id: 'E-1', kind: 'entry', title: '条目一' },
    { id: 'E-2', kind: 'entry', title: '条目二' },
  ];

  it('derives 只列公理，manifests 只列条目，都排除自己', () => {
    expect(relationOptions(nodes, 'derives', 'E-1').map((n) => n.id)).toEqual(['W-AX-1']);
    expect(relationOptions(nodes, 'manifests', 'E-1').map((n) => n.id)).toEqual(['E-2']);
    expect(relationOptions(nodes, 'requires', 'E-1').map((n) => n.id)).toEqual(['W-AX-1', 'E-2']);
  });
});
