// DSH 只在这里出现：插件启动本地工作台服务，并在卸载时关掉端口。
// 界面与 API 全部由这个服务自己提供，不再注册 DSH 的 webServer 路由。
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDataRoot } from './dataRoot.js';
import { startServer } from './server.js';
/** 启动失败不能抛穿：否则整个 DSH 插件层都会报错。 */
export async function apply(ctx, config) {
    const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const dataRoot = resolveDataRoot(config?.dataRoot, packageRoot);
    const publicDir = resolve(packageRoot, 'public');
    const port = config?.port ?? 8787;
    let srv;
    try {
        srv = await startServer({ dataRoot, port, publicDir });
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`[novel] 工作台启动失败（dataRoot=${dataRoot}）：${message}`);
        return;
    }
    console.log(`[novel] 工作台已启动: ${srv.url}`);
    ctx.effect(() => () => srv.close());
}
