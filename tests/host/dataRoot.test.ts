import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import { resolveDataRoot } from '../../src/host/dataRoot';

describe('resolveDataRoot', () => {
  it('配置为空时使用包根下的 data', () => {
    expect(resolveDataRoot(undefined, '/pkg/root')).toBe(path.join('/pkg/root', 'data'));
    expect(resolveDataRoot('   ', '/pkg/root')).toBe(path.join('/pkg/root', 'data'));
  });

  it('配置有值时 trim 后直接使用', () => {
    expect(resolveDataRoot('  /custom/data  ', '/pkg/root')).toBe('/custom/data');
  });
});
