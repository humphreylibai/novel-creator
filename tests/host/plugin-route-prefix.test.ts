import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';

import { apply } from '../../src/host/plugin';

type Cleanup = () => unknown;

const tempDirs: string[] = [];
const cleanups: Cleanup[] = [];
const logs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  for (const cleanup of cleanups.splice(0)) await cleanup();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  logs.length = 0;
});

/** 通过 apply 真实起服务，并从启动日志里取出手动测试用的 URL。 */
async function start() {
  const dataRoot = mkdtempSync(join(tmpdir(), 'novel-plugin-server-'));
  tempDirs.push(dataRoot);
  logs.length = 0;
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    logs.push(args.map(String).join(' '));
  });
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});

  let cleanup: Cleanup | undefined;
  await apply({
    effect: (fn) => { cleanup = fn() as unknown as Cleanup; },
  }, { dataRoot, port: 0 });

  if (error.mock.calls.length > 0) {
    throw new Error(`apply 启动失败：${String(error.mock.calls[0]?.[0])}`);
  }
  const url = /(http:\/\/127\.0\.0\.1:\d+)/.exec(logs.join('\n'))?.[1];
  if (!url) throw new Error(`启动日志里没有 URL：${logs.join(' / ')}`);
  if (cleanup) cleanups.push(cleanup);
  return { dataRoot, url, port: Number(new URL(url).port) };
}

function rawRequest(
  port: number,
  path: string,
  method: string,
  body?: string
): Promise<{ status: number; text: string; json?: unknown }> {
  return new Promise((resolve, reject) => {
    const req = request({
      host: '127.0.0.1', port, path, method,
      headers: { 'content-type': 'application/json' },
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => { text += chunk; });
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        text,
        json: text === '' ? undefined : JSON.parse(text),
      }));
    });
    req.on('error', reject);
    // 故意拆成两段写，验证服务端会拼接分片。
    if (body !== undefined) {
      req.write(body.slice(0, 5));
      req.write(body.slice(5));
    }
    req.end();
  });
}

describe('plugin 启动工作台服务', () => {
  it('apply 启动后 /api/worlds 可访问，并打印可访问 URL', async () => {
    const { url } = await start();
    const res = await fetch(`${url}/api/worlds`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it('POST /api/worlds 拼接异步分片请求体', async () => {
    const { port, url } = await start();
    const body = JSON.stringify({ id: '记忆之世', config: 'name: 记忆之世\n' });
    const created = await rawRequest(port, '/api/worlds', 'POST', body);
    expect(created.status).toBe(201);
    expect(created.json).toEqual({ ok: true });

    const worlds = await fetch(`${url}/api/worlds`);
    expect(await worlds.json()).toEqual(['记忆之世']);
  });

  it('非法的 JSON 请求体返回 400 且 body 只有 error', async () => {
    const { port } = await start();
    const res = await rawRequest(port, '/api/worlds/w/nodes/n1', 'PUT', '{"id":');
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: '请求体不是合法 JSON' });
    expect(Object.keys(res.json as Record<string, unknown>)).toEqual(['error']);
  });

  it('422 校验结果原样透传', async () => {
    const { port } = await start();
    const created = await rawRequest(port, '/api/worlds', 'POST',
      JSON.stringify({ id: 'w', config: 'name: w\n' }));
    expect(created.status).toBe(201);

    const res = await rawRequest(port, '/api/worlds/w/nodes/a', 'PUT',
      JSON.stringify({ id: 'a', title: 'A', kind: 'axiom', cost: [] }));
    expect(res.status).toBe(422);
    expect(res.json).toEqual({ error: '公理必须付出代价（铁律一）' });
  });
});
