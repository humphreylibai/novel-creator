// 已验证（2026-11-23，desktop profile）：ctx.webServer.register({ path, kind: 'exact', handler(req, res) }) 生效，
// GET /novel/ping 返回 200 {"ok":true,"dataRoot":"D:\\code\\novel\\data","version":"0.1.0"}。
// 本文件只做 HTTP ↔ 普通对象的翻译；404/400/422 等业务语义全部由 handlers 决定。
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveDataRoot } from './dataRoot.js';
import { createHandlers } from './handlers.js';
import { pingPayload } from './ping.js';

export interface PluginConfig { dataRoot: string }

export const inject = ['webServer'];

interface NovelRoute {
  path: string;
  kind: 'exact' | 'prefix';
  handler: (req: any, res: any) => void;
}

export interface HostCtx {
  webServer?: {
    register(route: NovelRoute): () => void;
  };
  effect(fn: () => () => void): void;
}

/** DSH 只在这里出现：路由注册与错误兜底。 */
export function apply(ctx: HostCtx, config: PluginConfig): void {
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

  // 只创建一次：每个请求重建会让 handlers 的闭包与后续扩展的状态反复重置。
  const handle = createHandlers(dataRoot);

  const respondPing = (_req: any, res: any) => {
    if (dataRootError) {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: `数据目录不可用：${dataRootError}` }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(pingPayload(dataRoot)));
  };

  // prefix 先注册，并在内部对 /ping 兜底：路由优先级由 DSH 决定，
  // 这样无论它先匹配 exact 还是先匹配 prefix，健康检查都不会被前缀吞掉。
  ctx.effect(() => web.register({
    path: '/novel',
    kind: 'prefix',
    handler: async (req: any, res: any) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = url.pathname.replace(/^\/novel/, '') || '/';
      if (path === '/ping') {
        respondPing(req, res);
        return;
      }
      const query = Object.fromEntries(url.searchParams.entries());

      let body: unknown = null;
      if (req.method === 'PUT' || req.method === 'POST') {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const raw = Buffer.concat(chunks).toString('utf8');
        if (raw) {
          try {
            body = JSON.parse(raw);
          } catch {
            res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: '请求体不是合法 JSON' }));
            return;
          }
        }
      }

      const out = await handle({ method: req.method ?? 'GET', path, query, body });
      res.writeHead(out.status, { 'content-type': 'application/json; charset=utf-8' });
      res.end(out.json === undefined ? '' : JSON.stringify(out.json));
    }
  }));

  ctx.effect(() => web.register({
    path: '/novel/ping',
    kind: 'exact',
    handler: respondPing
  }));
}
