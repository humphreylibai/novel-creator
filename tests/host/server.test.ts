import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from 'node:net';
import { request } from 'node:http';

import { startServer, type RunningServer } from '../../src/host/server';

const servers: RunningServer[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  for (const srv of servers.splice(0)) await srv.close();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'novel-server-'));
  tempDirs.push(root);
  const publicDir = join(root, 'public');
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(join(publicDir, 'index.html'), '<!doctype html><div id="root"></div>', 'utf8');
  writeFileSync(join(publicDir, 'app.js'), 'console.log("ok")', 'utf8');
  writeFileSync(join(root, 'secret.txt'), 'TOP-SECRET', 'utf8');
  return { root, publicDir, dataRoot: join(root, 'data') };
}

async function mount() {
  const f = fixture();
  const srv = await startServer({ dataRoot: f.dataRoot, port: 0, publicDir: f.publicDir });
  servers.push(srv);
  return { ...f, srv };
}

function rawGet(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

function canConnect(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1', () => {
      socket.destroy();
      resolve();
    });
    socket.setTimeout(1000, () => {
      socket.destroy();
      reject(new Error('connect timeout'));
    });
    socket.on('error', reject);
  });
}

describe('startServer', () => {
  it('端口 0 时使用随机端口并提供 /api/worlds', async () => {
    const { srv } = await mount();
    expect(srv.port).toBeGreaterThan(0);
    expect(srv.url).toBe(`http://127.0.0.1:${srv.port}`);

    const res = await fetch(`${srv.url}/api/worlds`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await res.json()).toEqual([]);
  });

  it('GET / 返回 public/index.html', async () => {
    const { srv } = await mount();
    const res = await fetch(`${srv.url}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await res.text()).toContain('id="root"');
  });

  it('未知路径回落到 index.html，方便前端路由', async () => {
    const { srv } = await mount();
    const res = await fetch(`${srv.url}/some/deep/route`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('id="root"');
  });

  it('拒绝目录穿越，不返回 publicDir 外的文件', async () => {
    const { srv } = await mount();
    for (const path of ['/%2e%2e/secret.txt', '/api/../secret.txt', '/../secret.txt']) {
      const res = await rawGet(srv.port, path);
      expect(res.body).not.toContain('TOP-SECRET');
    }
  });

  it('close() 后端口不再可连', async () => {
    const { srv } = await mount();
    await srv.close();
    await expect(canConnect(srv.port)).rejects.toThrow();
  });

  it('端口占用时抛出明确错误，不静默换端口', async () => {
    const { srv } = await mount();
    const f = fixture();
    await expect(startServer({
      dataRoot: f.dataRoot,
      port: srv.port,
      publicDir: f.publicDir,
    })).rejects.toThrow(/占用|EADDRINUSE/);
  });
});
