import type { Stats } from './api.js';

/** 公理不足 3 条且未选中任何条目时，主区由开局引导接管。 */
export const onboardingActive = (stat: Stats | null, hasSelection: boolean): boolean =>
  !!stat && stat.axioms < 3 && !hasSelection;

/** 引导期间不允许从工具栏绕开去建条目/公理。 */
export const canCreateEntry = (stat: Stats | null): boolean =>
  !stat || stat.axioms >= 3;
