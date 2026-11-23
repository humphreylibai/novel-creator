import { readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

// 1) client.js 产物：loader 包装、导出、注入、槽位注册
const clientCode = readFileSync('client.js', 'utf8');
let registration;
const React = {
  useState: (initial) => [initial, () => {}],
  useEffect: () => {},
};
const jsxRuntime = { jsx: () => null, jsxs: () => null, Fragment: Symbol('Fragment') };
const fakeRequire = (id) => {
  if (id === 'react') return React;
  if (id === 'react/jsx-runtime') return jsxRuntime;
  if (id === 'react/jsx-dev-runtime') return jsxRuntime;
  throw new Error(`unexpected require: ${id}`);
};
const sandbox = {
  window: { __ModuleLoader__: { load: (entry) => { registration = entry; } } },
  console,
  fetch: async () => { throw new Error('fetch should not run during load'); },
};
vm.runInNewContext(clientCode, sandbox, { filename: 'client.js' });
if (!registration || registration.id !== '@local/novel-workbench') throw new Error('loader registration missing');
const exported = registration.factory(fakeRequire);
for (const name of ['apply', 'Launcher', 'toggleWorkbench', 'inject']) {
  if (!(name in exported)) throw new Error(`missing export: ${name}`);
}
if (JSON.stringify(exported.inject) !== JSON.stringify(['slots'])) throw new Error('client inject wrong');
const slotCalls = [];
exported.apply({
  slots: {
    inject: (name, fn) => { slotCalls.push(['inject', name]); fn(); },
    register: (meta, component) => {
      slotCalls.push(['register', meta.name, meta.id, meta.order, typeof component]);
    },
  },
});
if (slotCalls.length !== 2 || slotCalls[0][1] !== 'shell.overlay' || slotCalls[1][1] !== 'shell.overlay') {
  throw new Error(`slot registration wrong: ${JSON.stringify(slotCalls)}`);
}
console.log('client smoke OK:', Object.keys(exported).sort().join(','), clientCode.slice(0, 30).replace(/\n/g, '\\n'), clientCode.length);

// 2) lib/host/plugin.js 产物：真实 Node 流 + 真实临时目录
const smokeDir = resolve('.superpowers/sdd/worldbuilding-p0/task-5-smoke-data');
rmSync(smokeDir, { recursive: true, force: true });
const host = await import(pathToFileURL(resolve('index.js')).href + '?smoke=' + Date.now());

const routes = [];
host.apply({
  webServer: { register: (route) => { routes.push(route); return () => {}; } },
  effect: (fn) => fn(),
}, { dataRoot: smokeDir });
const pingRoute = routes.find((r) => r.path === '/novel/ping');
const prefix = routes.find((r) => r.path === '/novel');
if (routes.length !== 2 || pingRoute?.kind !== 'exact' || prefix?.kind !== 'prefix') {
  throw new Error(`route shape wrong: ${JSON.stringify(routes.map((r) => [r.path, r.kind]))}`);
}
console.log('routes OK:', routes.map((r) => `${r.path}:${r.kind}`).join(','));

async function call(route, { url, method = 'GET', body }) {
  let status = 0;
  let headers;
  let text = '';
  const chunks = body === undefined ? [] : [Buffer.from(body, 'utf8').subarray(0, 7), Buffer.from(body, 'utf8').subarray(7)];
  const req = {
    url,
    method,
    async *[Symbol.asyncIterator]() { for (const c of chunks) yield c; },
  };
  const res = {
    writeHead: (code, h) => { status = code; headers = h; },
    end: (chunk = '') => { text += chunk; },
  };
  await route.handler(req, res);
  return { status, headers, text, json: text ? JSON.parse(text) : undefined };
}

const ping = await call(pingRoute, { url: '/novel/ping' });
if (ping.status !== 200 || ping.json?.ok !== true) throw new Error(`ping failed: ${ping.text}`);
console.log('ping exact OK:', ping.status, ping.text);

const pingByPrefix = await call(prefix, { url: '/novel/ping' });
if (pingByPrefix.status !== 200 || pingByPrefix.json?.ok !== true) throw new Error(`prefix ping fallback failed: ${pingByPrefix.text}`);
console.log('ping via prefix fallback OK:', pingByPrefix.status);

const empty = await call(prefix, { url: '/novel/worlds' });
if (empty.status !== 200 || !Array.isArray(empty.json) || empty.json.length !== 0) throw new Error(`empty worlds failed: ${empty.text}`);
if (empty.headers['content-type'] !== 'application/json; charset=utf-8') throw new Error('content-type wrong');
console.log('GET /novel/worlds OK:', empty.status, empty.text);

const created = await call(prefix, {
  url: '/novel/worlds', method: 'POST',
  body: JSON.stringify({ id: '记忆之世', config: 'name: 记忆之世\ntone: 冷\n' }),
});
if (created.status !== 201) throw new Error(`create world failed: ${created.text}`);
const listed = await call(prefix, { url: '/novel/worlds' });
if (JSON.stringify(listed.json) !== JSON.stringify(['记忆之世'])) throw new Error(`world not listed: ${listed.text}`);
if (!statSync(smokeDir).isDirectory()) throw new Error('data root not created');
if (readdirSync(smokeDir).length === 0) throw new Error('data root empty');
console.log('POST /novel/worlds OK:', created.status, listed.text);

const saved = await call(prefix, {
  url: '/novel/worlds/%E8%AE%B0%E5%BF%86%E4%B9%8B%E4%B8%96/nodes/%E8%BF%98%E8%84%89%E7%A4%BC',
  method: 'PUT',
  body: JSON.stringify({ id: '还脉礼', title: '还脉礼', kind: 'entry', body: '以血还脉。' }),
});
if (saved.status !== 200 || saved.json?.title !== '还脉礼') throw new Error(`save node failed: ${saved.text}`);
const readBack = await call(prefix, {
  url: '/novel/worlds/%E8%AE%B0%E5%BF%86%E4%B9%8B%E4%B8%96/nodes/%E8%BF%98%E8%84%89%E7%A4%BC',
});
if (readBack.status !== 200 || readBack.json?.body !== '以血还脉。') throw new Error(`read node failed: ${readBack.text}`);
console.log('PUT/GET node OK:', saved.status, readBack.json.title, readBack.json.file);

const axiom = await call(prefix, {
  url: '/novel/worlds/%E8%AE%B0%E5%BF%86%E4%B9%8B%E4%B8%96/nodes/%E5%85%AC%E7%90%86',
  method: 'PUT',
  body: JSON.stringify({ id: '公理', title: '公理', kind: 'axiom', cost: [] }),
});
if (axiom.status !== 422 || axiom.json?.error !== '公理必须付出代价（铁律一）') {
  throw new Error(`422 passthrough failed: ${axiom.text}`);
}
console.log('422 passthrough OK:', axiom.status, axiom.text);

const bad = await call(prefix, {
  url: '/novel/worlds/x/nodes/y', method: 'PUT', body: '{"id":',
});
if (bad.status !== 400 || bad.json?.error !== '请求体不是合法 JSON') throw new Error(`bad json failed: ${bad.text}`);
console.log('400 bad JSON OK:', bad.status, bad.text);

rmSync(smokeDir, { recursive: true, force: true });
console.log('SMOKE OK');
