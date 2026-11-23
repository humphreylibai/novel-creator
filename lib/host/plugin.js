// 已验证（2026-11-23，desktop profile）：ctx.webServer.register({ path, kind: 'exact', handler(req, res) }) 生效，
// GET /novel/ping 返回 200 {"ok":true,"dataRoot":"D:\\code\\novel\\data","version":"0.1.0"}。
// 整路由形状仍是待验证部分；若后续路由不通，只改这一个文件。
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDataRoot } from './dataRoot.js';
import { pingPayload } from './ping.js';
export const inject = ['webServer'];
/** DSH 只在这里出现：路由注册与错误兜底。 */
export function apply(ctx, config) {
    const web = ctx.webServer;
    if (!web?.register) {
        console.warn('[novel] webServer 不可用，工作台未挂载');
        return;
    }
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const dataRoot = resolveDataRoot(config?.dataRoot, packageRoot);
    let dataRootError;
    try {
        mkdirSync(dataRoot, { recursive: true });
    }
    catch (e) {
        dataRootError = e instanceof Error ? e.message : String(e);
        console.warn(`[novel] 数据目录不可用（${dataRoot}）：${dataRootError}`);
    }
    ctx.effect(() => web.register({
        path: '/novel/ping',
        kind: 'exact',
        handler: (_req, res) => {
            if (dataRootError) {
                res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: `数据目录不可用：${dataRootError}` }));
                return;
            }
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(pingPayload(dataRoot)));
        }
    }));
}
