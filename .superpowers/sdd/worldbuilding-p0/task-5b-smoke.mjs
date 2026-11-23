import { mkdtempSync, readFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (pkg.dsh?.client !== undefined) throw new Error('dsh.client still present');
if (pkg.exports?.['./client'] !== undefined) throw new Error('exports["./client"] still present');
if (!pkg.files?.includes('public')) throw new Error('package files missing public');
if (pkg.scripts?.build !== 'tsc -p tsconfig.build.json && node scripts/build-ui.mjs') {
  throw new Error(`unexpected build script: ${pkg.scripts?.build}`);
}
if (existsSync('client.js')) throw new Error('client.js still exists');
if (!existsSync('public/app.js')) throw new Error('public/app.js missing');
if (!existsSync('public/index.html')) throw new Error('public/index.html missing');
console.log('package layout OK:', pkg.files.join(','), '| app.js bytes=', statSync('public/app.js').size);

const appJs = readFileSync('public/app.js', 'utf8');
if (!appJs.includes('/api')) throw new Error('app.js missing /api base');
if (appJs.includes('__ModuleLoader__')) throw new Error('app.js still uses module-loader wrapper');
if (!appJs.includes('react-dom')) throw new Error('app.js does not bundle react-dom');
console.log('bundle OK: iife, /api base, react-dom bundled, bytes=', appJs.length);

const host = await import(pathToFileURL(resolve('index.js')).href + '?smoke=' + Date.now());
if (typeof host.apply !== 'function') throw new Error('host apply missing');
if ('inject' in host) throw new Error('host still exports inject');

const dataRoot = mkdtempSync(join(tmpdir(), 'novel-5b-smoke-'));
const publicDir = resolve('public');
const logs = [];
const originalLog = console.log;
console.log = (...args) => { logs.push(args.map(String).join(' ')); };
let cleanup;
try {
  await host.apply({
    effect: (fn) => { cleanup = fn(); },
  }, { dataRoot, port: 0 });
} finally {
  console.log = originalLog;
}
const url = /(http:\/\/127\.0\.0\.1:\d+)/.exec(logs.join('\n'))?.[1];
if (!url) throw new Error(`startup URL missing: ${logs.join(' / ')}`);
console.log('apply OK:', logs.join(' / '));

try {
  const home = await fetch(`${url}/`);
  const html = await home.text();
  if (home.status !== 200 || !html.includes('id="root"')) throw new Error('index.html not served');
  if (home.headers.get('content-type') !== 'text/html; charset=utf-8') throw new Error('index content-type wrong');
  console.log('GET / OK:', home.status, html.length, 'chars');

  const js = await fetch(`${url}/app.js`);
  if (js.status !== 200) throw new Error(`app.js status ${js.status}`);
  if (!String(js.headers.get('content-type')).startsWith('text/javascript')) throw new Error('app.js content-type wrong');
  console.log('GET /app.js OK:', js.status, js.headers.get('content-type'), (await js.text()).length, 'chars');

  const fallback = await fetch(`${url}/some/deep/route`);
  if (fallback.status !== 200 || !(await fallback.text()).includes('id="root"')) throw new Error('SPA fallback failed');
  console.log('SPA fallback OK:', fallback.status);

  const worlds = await fetch(`${url}/api/worlds`);
  if (worlds.status !== 200 || JSON.stringify(await worlds.json()) !== '[]') throw new Error('GET /api/worlds failed');
  console.log('GET /api/worlds OK:', worlds.status);

  const created = await fetch(`${url}/api/worlds`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: '记忆之世', config: 'name: 记忆之世\n' }),
  });
  if (created.status !== 201) throw new Error(`POST /api/worlds failed: ${created.status} ${await created.text()}`);
  console.log('POST /api/worlds OK:', created.status);

  const traversal = await fetch(`${url}/%2e%2e/secret.txt`);
  if ((await traversal.text()).includes('TOP-SECRET')) throw new Error('traversal leaked');
  console.log('traversal blocked OK:', traversal.status);
} finally {
  if (cleanup) await cleanup();
  rmSync(dataRoot, { recursive: true, force: true });
}

let afterClose = 'still-open';
try {
  await fetch(`${url}/api/worlds`);
} catch {
  afterClose = 'closed';
}
if (afterClose !== 'closed') throw new Error('port still open after cleanup');
console.log('cleanup OK: port closed');

console.log('SMOKE OK');
