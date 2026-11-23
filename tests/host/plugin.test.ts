import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, type AddressInfo } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as plugin from '../../src/host/plugin';

const tempDirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('host plugin', () => {
  it('不再依赖 webServer，也不导出 inject', () => {
    expect('inject' in plugin).toBe(false);
  });

  it('启动失败只打印诊断，不向插件层抛错', async () => {
    const blocker = createServer();
    await new Promise<void>((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    const port = (blocker.address() as AddressInfo).port;
    const dataRoot = mkdtempSync(join(tmpdir(), 'novel-plugin-fail-'));
    tempDirs.push(dataRoot);

    const errors: unknown[][] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { errors.push(args); });
    vi.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await expect(plugin.apply({ effect: () => {} }, { dataRoot, port })).resolves.toBeUndefined();
    } finally {
      await new Promise<void>((resolve, reject) => {
        blocker.close((err) => (err ? reject(err) : resolve()));
      });
    }

    expect(errors).toHaveLength(1);
    const message = errors[0]?.map(String).join(' ') ?? '';
    expect(message).toContain('[novel]');
    expect(message).toContain('启动失败');
    expect(message).toContain(String(port));
  });
});
