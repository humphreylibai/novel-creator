import { describe, expect, it } from 'vitest';
import { badgesFor } from '../../src/ui/cardBadges.js';
import type { Finding } from '../../src/engine/types.js';

const findings: Finding[] = [
  { rule: 'R4', severity: 'warn', nodeIds: ['E-1'], message: '' },
  { rule: 'R5', severity: 'info', nodeIds: ['E-1'], message: '' },
  { rule: 'R1', severity: 'error', nodeIds: ['E-1', 'W-AX-1'], message: '' },
];

describe('badgesFor', () => {
  it('按节点汇总角标，去重且保持固定顺序', () => {
    expect(badgesFor(findings, 'E-1')).toEqual(['无公理支撑', '未被正文引用', '有未决矛盾']);
    expect(badgesFor(findings, 'E-2')).toEqual([]);
  });
});
