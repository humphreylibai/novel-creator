import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { createHandlers } from './handlers.js';
const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8',
};
const JSON_TYPE = 'application/json; charset=utf-8';
const isInside = (root, target) => target === root || target.startsWith(root + sep);
function contentType(file) {
    return CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
}
function sendJson(res, status, json) {
    res.writeHead(status, { 'content-type': JSON_TYPE });
    res.end(json === undefined ? '' : JSON.stringify(json));
}
async function readJsonBody(req) {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw)
        return { ok: true, value: null };
    try {
        return { ok: true, value: JSON.parse(raw) };
    }
    catch {
        return { ok: false };
    }
}
async function serveStatic(req, res, publicDir) {
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
    let data;
    try {
        data = await readFile(file);
    }
    catch {
        try {
            file = fallback;
            data = await readFile(fallback);
        }
        catch {
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
export async function startServer(opts) {
    const handle = createHandlers(opts.dataRoot);
    const route = async (req, res) => {
        const rawUrl = req.url ?? '/';
        const rawPath = rawUrl.split('?')[0] || '/';
        // 先对原始路径解码再做段检查：URL 构造器会悄悄折叠 `..`，不能只依赖它。
        let decodedRaw;
        try {
            decodedRaw = decodeURIComponent(rawPath);
        }
        catch {
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
            const path = pathname.slice('/api'.length) || '/';
            const query = Object.fromEntries(url.searchParams.entries());
            let body = null;
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
            }
            catch (e) {
                sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) });
            }
            return;
        }
        await serveStatic(req, res, opts.publicDir);
    };
    const server = createServer((req, res) => {
        void route(req, res).catch((e) => {
            if (res.headersSent) {
                res.end();
                return;
            }
            sendJson(res, 500, { error: e instanceof Error ? e.message : String(e) });
        });
    });
    await new Promise((resolvePromise, rejectPromise) => {
        const onError = (err) => {
            server.off('listening', onListening);
            const code = err.code;
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
    let closing;
    const close = () => {
        if (!closing) {
            closing = new Promise((resolvePromise) => {
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
