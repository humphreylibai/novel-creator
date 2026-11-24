import { expect, it } from 'vitest';
import { parseBelief, serializeBelief } from '../../src/engine/beliefs.js';

it('解析 belief yaml 与字段', () => {
  const raw = `holder: 民间
target: W-MY-001
content: 玄帝曾一统天下
confidence: 0.9
source: [说书人, 童谣]
span: { from: 300, to: null }
`;
  const b = parseBelief(raw, '玄帝传说');
  expect(b).toMatchObject({
    id: '玄帝传说', holder: '民间', target: 'W-MY-001', confidence: 0.9,
    file: 'beliefs/玄帝传说.yaml',
  });
  expect(b.source).toEqual(['说书人', '童谣']);
  expect(b.span).toEqual({ from: 300, to: null });
});

it('序列化后可重新读回，且拒绝越界置信', () => {
  const b = parseBelief('holder: 教团\ntarget: W-1\ncontent: 神是假的\nconfidence: 0.95\n', '教团');
  expect(parseBelief(serializeBelief(b), '教团')).toMatchObject({
    holder: '教团', target: 'W-1', content: '神是假的', confidence: 0.95,
  });
  expect(() => parseBelief('holder: 人\ntarget: W-1\ncontent: x\nconfidence: 1.2\n', '坏'))
    .toThrow(/confidence/);
});
