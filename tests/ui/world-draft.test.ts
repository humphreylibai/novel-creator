import { expect, it } from 'vitest';
import { parseWorldConfig } from '../../src/engine/worldConfig.js';
import { buildWorldConfig } from '../../src/ui/worldDraft.js';

it('生成可被 parseWorldConfig 读回的 world.yaml', () => {
  const yaml = buildWorldConfig({
    id: '测试界', title: '测试界', wound: '缺一口井', motif: '水',
    epoch: '新历', start: '1', end: '',
  });
  const c = parseWorldConfig(yaml);
  expect(c.id).toBe('测试界');
  expect(c.theme.wound).toBe('缺一口井');
  expect(c.theme.motif).toBe('水');
  expect(c.calendar.epochs[0]).toEqual({ name: '新历', start: 1, end: null });
});

it('带冒号和引号的标题不会破坏 YAML', () => {
  const yaml = buildWorldConfig({
    id: 'quote', title: '他说：“走”', wound: '伤口：无', motif: '',
    epoch: '历', start: '0', end: '100',
  });
  const c = parseWorldConfig(yaml);
  expect(c.title).toBe('他说：“走”');
  expect(c.theme.wound).toBe('伤口：无');
  expect(c.calendar.epochs[0]).toEqual({ name: '历', start: 0, end: 100 });
});
