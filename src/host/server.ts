import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { createHandlers } from './handlers.js';

export interface ServerOptions {
  dataRoot: string;
  port: number;
  publicDir: string;
}

export interface RunningServer {
  url: string;
  port: number;
  close(): Promise<void>;
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

const JSON_TYPE = 'application/json; charset=utf-8';

const MUTATING = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

/** 允许无 Origin 的本地 curl；浏览器跨源写请求必须拒绝（简单请求也没有预检）。 */
function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host;
  if (!host) return false;
  try {
    const u = new URL(origin);
    return u.host === host
      && (u.hostname === '127.0.0.1' || u.hostname === 'localhost' || u.hostname === '[::1]');
  } catch {
    return false;
  }
}

const isInside = (root: string, target: string): boolean =>
  target === root || target.startsWith(root + sep);

function contentType(file: string): string {
  return CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
}

function sendJson(res: ServerResponse, status: number, json?: unknown): void {
  res.writeHead(status, { 'content-type': JSON_TYPE });
  res.end(json === undefined ? '' : JSON.stringify(json));
}

async function readJsonBody(req: IncomingMessage): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

async function serveStatic(req: IncomingMessage, res: ServerResponse, publicDir: string): Promise<void> {
  const method = req.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' });
    res.end();
    return;
  }

  const root = resolve(publicDir);
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = resolve(root, relPath);
  const fallback = resolve(root, 'index.html');
  let file = target === root || !isInside(root, target) ? fallback : target;

  let data: Buffer;
  try {
    data = await readFile(file);
  } catch {
    try {
      file = fallback;
      data = await readFile(fallback);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
  }

  res.writeHead(200, {
    'content-type': contentType(file),
    'content-length': data.length,
  });
  res.end(method === 'HEAD' ? undefined : data);
}

export async function startServer(opts: ServerOptions): Promise<RunningServer> {
  const handle = createHandlers(opts.dataRoot);

  const route = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const rawUrl = req.url ?? '/';
    const rawPath = rawUrl.split('?')[0] || '/';

    // 先对原始路径解码再做段检查：URL 构造器会悄悄折叠 `..`，不能只依赖它。
    let decodedRaw: string;
    try {
      decodedRaw = decodeURIComponent(rawPath);
    } catch {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('bad request');
      return;
    }
    if (decodedRaw.includes('\0') || decodedRaw.split(/[\\/]/).includes('..')) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }

    const url = new URL(rawUrl, 'http://localhost');
    const pathname = url.pathname;

    if (pathname === '/api' || pathname.startsWith('/api/')) {
      if (MUTATING.has(req.method ?? '') && !sameOrigin(req)) {
        sendJson(res, 403, { error: '跨源写请求被拒绝' });
        return;
      }
      const path = pathname.slice('/api'.length) || '/';
      const query = Object.fromEntries(url.searchParams.entries());

      let body: unknown = null;
      if (req.method === 'PUT' || req.method === 'POST') {
        const parsed = await readJsonBody(req);
        if (!parsed.ok) {
          sendJson(res, 400, { error: '请求体不是合法 JSON' });
          return;
        }
        body = parsed.value;
      }

      try {
        const out = await handle({ method: req.method ?? 'GET', path, query, body });
        sendJson(res, out.status, out.json);
      } catch (e) {
        sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    await serveStatic(req, res, opts.publicDir);
  };

  const server = createServer((req, res) => {
    void route(req, res).catch((e: unknown) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) });
    });
  });

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const onError = (err: Error) => {
      server.off('listening', onListening);
      const code = (err as NodeJS.ErrnoException).code;
      rejectPromise(code === 'EADDRINUSE'
        ? new Error(`端口 ${opts.port} 已被占用（EADDRINUSE），请关闭占用进程或修改 port 配置`)
        : new Error(`无法监听 127.0.0.1:${opts.port}：${err.message}`));
    };
    const onListening = () => {
      server.off('error', onError);
      resolvePromise();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(opts.port, '127.0.0.1');
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address !== null ? address.port : opts.port;

  let closing: Promise<void> | undefined;
  const close = (): Promise<void> => {
    if (!closing) {
      closing = new Promise<void>((resolvePromise) => {
        if (!server.listening) {
          resolvePromise();
          return;
        }
        server.close(() => resolvePromise());
        server.closeIdleConnections();
        server.closeAllConnections();
      });
    }
    return closing;
  };

  return { url: `http://127.0.0.1:${actualPort}`, port: actualPort, close };
}
