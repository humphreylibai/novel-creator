import { expect, it } from 'vitest';
import { canCreateEntry, onboardingActive } from '../../src/ui/onboarding.js';

it('公理不足 3 条且未选中时显示引导，且禁止新建条目', () => {
  expect(onboardingActive({ axioms: 1, entries: 0, manifestedAxioms: 0 }, false)).toBe(true);
  expect(onboardingActive({ axioms: 3, entries: 0, manifestedAxioms: 0 }, false)).toBe(false);
  expect(onboardingActive(null, false)).toBe(false);
  expect(canCreateEntry({ axioms: 2, entries: 0, manifestedAxioms: 0 })).toBe(false);
  expect(canCreateEntry({ axioms: 3, entries: 0, manifestedAxioms: 0 })).toBe(true);
});
