import { describe, it, expect } from 'vitest';
import { parseWorldConfig } from '../../src/engine/worldConfig';

const RAW = `id: 记忆之世
title: 记忆之世
genre:
  allowed: [超自然, 社会]
  forbidden: [时间旅行]
  expectation: 代价必须兑现
calendar:
  epochs:
    - { name: 旧世, start: -1200, end: -1 }
    - { name: 新历, start: 1, end: null }
  format: "新历{year}年"
theme:
  wound: 一个靠抽干世界来维持秩序的世界
  motif: 记忆即代价
`;

describe('world.yaml', () => {
  it('解析出契约、历法、母题', () => {
    const c = parseWorldConfig(RAW);
    expect(c.genre.allowed).toEqual(['超自然', '社会']);
    expect(c.calendar.epochs).toHaveLength(2);
    expect(c.theme.wound).toContain('抽干');
  });
  it('缺母题时报错', () => {
    expect(() => parseWorldConfig(RAW.replace(/theme:[\s\S]*$/, ''))).toThrow(/wound/);
  });
  it('历法为空时报错', () => {
    expect(() => parseWorldConfig(RAW.replace(/epochs:[\s\S]*?format/, 'format'))).toThrow(/epochs/);
  });
});

describe('world.yaml 字段完整性与缺省', () => {
  it('契约与母题完整读出', () => {
    const c = parseWorldConfig(RAW);
    expect(c.id).toBe('记忆之世');
    expect(c.title).toBe('记忆之世');
    expect(c.genre.forbidden).toEqual(['时间旅行']);
    expect(c.genre.expectation).toBe('代价必须兑现');
    expect(c.calendar.format).toBe('新历{year}年');
    expect(c.calendar.months).toEqual([]);
    expect(c.theme.motif).toBe('记忆即代价');
  });

  it('历法时段保留负数年份，null 表示至今', () => {
    const c = parseWorldConfig(RAW);
    expect(c.calendar.epochs).toEqual([
      { name: '旧世', start: -1200, end: -1 },
      { name: '新历', start: 1, end: null }
    ]);
  });

  it('缺省值安全，标题回退 id', () => {
    const c = parseWorldConfig(`id: 无名
calendar:
  epochs:
    - { name: 新历, start: 1 }
theme:
  wound: 世界会遗忘
`);
    expect(c.title).toBe('无名');
    expect(c.calendar.format).toBe('{year}');
    expect(c.calendar.months).toEqual([]);
    expect(c.calendar.epochs).toEqual([{ name: '新历', start: 1, end: null }]);
    expect(c.genre.allowed).toEqual([]);
    expect(c.genre.forbidden).toEqual([]);
    expect(c.genre.expectation).toBe('');
    expect(c.theme.motif).toBe('');
  });

  it('非映射 YAML 不崩溃，按缺母题报错', () => {
    expect(() => parseWorldConfig('记忆之世')).toThrow(/wound/);
    expect(() => parseWorldConfig('- 记忆之世\n- 旧世')).toThrow(/wound/);
  });
});
