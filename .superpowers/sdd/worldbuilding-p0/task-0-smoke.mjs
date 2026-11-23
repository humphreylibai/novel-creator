import { readFileSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const clientCode = readFileSync('client.js', 'utf8');
let registration;
const React = {
  useState: (initial) => [initial, () => {}],
  createElement: () => null,
  Fragment: Symbol('Fragment'),
};
const jsxRuntime = {
  jsx: () => null,
  jsxs: () => null,
  Fragment: Symbol('jsx.Fragment'),
};
const fakeRequire = (id) => {
  if (id === 'react') return React;
  if (id === 'react/jsx-runtime') return jsxRuntime;
  throw new Error(`unexpected require: ${id}`);
};
const sandbox = {
  window: { __ModuleLoader__: { load: (entry) => { registration = entry; } } },
  console,
};
vm.runInNewContext(clientCode, sandbox, { filename: 'client.js' });
if (!registration || registration.id !== '@local/novel-workbench') {
  throw new Error('module loader registration missing or wrong id');
}
const exported = registration.factory(fakeRequire);
for (const name of ['apply', 'Launcher', 'toggleWorkbench']) {
  if (typeof exported[name] !== 'function') throw new Error(`missing export: ${name}`);
}
if (JSON.stringify(exported.inject) !== JSON.stringify(['slots'])) {
  throw new Error(`unexpected client inject: ${JSON.stringify(exported.inject)}`);
}
const slotCalls = [];
exported.apply({
  slots: {
    inject: (name, fn) => { slotCalls.push(['inject', name]); fn(); },
    register: (meta, component) => { slotCalls.push(['register', meta.name, meta.id, meta.order, typeof component]); },
  },
});
console.log('client smoke OK:', registration.id, Object.keys(exported).sort().join(','), JSON.stringify(slotCalls));

const host = await import(pathToFileURL(resolve('index.js')).href + '?smoke=' + Date.now());
if (typeof host.apply !== 'function') throw new Error('host apply missing');
if (JSON.stringify(host.inject) !== JSON.stringify(['webServer'])) throw new Error('host inject missing');

function mount(dataRoot) {
  const routes = [];
  let effects = 0;
  host.apply({
    webServer: { register: (route) => { routes.push(route); return () => {}; } },
    effect: (fn) => { effects++; return fn(); },
  }, { dataRoot });
  if (effects !== 2 || routes.length !== 2) throw new Error('route registration failed');
  const route = routes.find((r) => r.path === '/novel/ping');
  const prefix = routes.find((r) => r.path === '/novel');
  if (route?.kind !== 'exact' || prefix?.kind !== 'prefix') throw new Error('route shape wrong');
  let status;
  let headers;
  let body = '';
  route.handler({}, {
    writeHead: (code, h) => { status = code; headers = h; },
    end: (chunk) => { body += chunk; },
  });
  return { status, headers, body, payload: JSON.parse(body) };
}

const smokeDir = resolve('.superpowers/sdd/worldbuilding-p0/smoke-data');
rmSync(smokeDir, { recursive: true, force: true });
const configured = mount(`  ${smokeDir}  `);
if (configured.status !== 200 || configured.payload.ok !== true) {
  throw new Error(`unexpected configured ping: ${configured.body}`);
}
if (configured.payload.dataRoot !== smokeDir) throw new Error('configured dataRoot not trimmed');
if (!statSync(smokeDir).isDirectory()) throw new Error('dataRoot directory not created');
console.log('host configured OK:', configured.status, configured.body);
rmSync(smokeDir, { recursive: true, force: true });

const defaultRoot = resolve('data');
const hadDefault = existsSync(defaultRoot);
const fallback = mount('');
if (fallback.status !== 200 || fallback.payload.dataRoot !== defaultRoot) {
  throw new Error(`package-root default wrong: ${fallback.body}`);
}
console.log('host package-root default OK:', fallback.payload.dataRoot);
if (!hadDefault) rmSync(defaultRoot, { recursive: true, force: true });

const badPath = resolve('.superpowers/sdd/worldbuilding-p0/smoke-file');
writeFileSync(badPath, 'not a directory');
const warnings = [];
const originalWarn = console.warn;
console.warn = (m) => warnings.push(m);
let broken;
try {
  broken = mount(badPath);
} finally {
  console.warn = originalWarn;
  rmSync(badPath, { force: true });
}
if (broken.status !== 500 || Object.keys(broken.payload).join(',') !== 'error' || !String(broken.payload.error).startsWith('数据目录不可用：')) {
  throw new Error(`mkdir failure not reported in {error} shape: ${broken.body}`);
}
if (warnings.length !== 1) throw new Error('mkdir failure warning missing');
console.log('host mkdir failure OK:', broken.status, broken.body);

warnings.length = 0;
console.warn = (m) => warnings.push(m);
try {
  host.apply({ effect: () => {} }, { dataRoot: '' });
} finally {
  console.warn = originalWarn;
}
if (warnings.length !== 1) throw new Error('webServer fallback warning missing');
console.log('host fallback OK:', warnings[0]);
