import { afterEach, describe, expect, it, vi } from 'vitest';
import { apply, inject } from '../../src/host/plugin';

describe('host plugin', () => {
  afterEach(() => vi.restoreAllMocks());

  it('声明 webServer 注入', () => {
    expect(inject).toEqual(['webServer']);
  });

  it('webServer 不可用时 console.warn 并跳过注册', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let effects = 0;
    apply({ effect: () => { effects += 1; } }, { dataRoot: '' });
    expect(effects).toBe(0);
    expect(warn).toHaveBeenCalledWith('[novel] webServer 不可用，工作台未挂载');
  });
});
