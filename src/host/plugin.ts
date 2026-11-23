// 已验证（2026-11-23，DSH desktop profile）：ctx.webServer.register 接受
// Node 风格 handler。若后续版本形状变化，只修改这一个文件，不要把适配逻辑复制到别处。
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDataRoot } from './dataRoot.js';

export interface PluginConfig { dataRoot: string }

export const inject = ['webServer'];

/** DSH 只在这里出现：路由注册与错误兜底。 */
export function apply(ctx: any, config: PluginConfig): void {
  const web = ctx.webServer;
  if (!web?.register) {
    console.warn('[novel] webServer 不可用，工作台未挂载');
    return;
  }
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const dataRoot = resolveDataRoot(config?.dataRoot, packageRoot);
  let dataRootError: string | undefined;
  try {
    mkdirSync(dataRoot, { recursive: true });
  } catch (e) {
    dataRootError = e instanceof Error ? e.message : String(e);
    console.warn(`[novel] 数据目录不可用（${dataRoot}）：${dataRootError}`);
  }
  ctx.effect(() => web.register({
    path: '/novel/ping',
    kind: 'exact',
    handler: (_req: any, res: any) => {
      const payload = dataRootError
        ? { ok: false, error: `数据目录不可用：${dataRootError}`, dataRoot, version: '0.1.0' }
        : { ok: true, dataRoot, version: '0.1.0' };
      res.writeHead(dataRootError ? 500 : 200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(payload));
    }
  }));
}
