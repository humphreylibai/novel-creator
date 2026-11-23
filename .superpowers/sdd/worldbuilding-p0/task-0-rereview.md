# Re-review package — Task 0 fix round 3 (83dc148 → a50c3d3)

## git log
a50c3d3 fix: 落实评审修复（契约类型、路由测试、构建产物与元数据）

## diff --stat
 client.js                       | 103 ++++++++++++++++++++++++++++++++++++++++
 docs/plugin/DETAIL.md           |  23 ---------
 lib/host/dataRoot.js            |   8 ++++
 lib/host/ping.js                |   4 ++
 lib/host/plugin.js              |  40 ++++++++++++++++
 locale/en.json                  |   3 +-
 locale/zh.json                  |   3 +-
 package.json                    |   5 +-
 scripts/build-client.mjs        |  15 ++----
 src/host/dataRoot.ts            |   1 +
 src/host/ping.ts                |  12 +++--
 src/host/plugin.ts              |  33 +++++++++----
 src/ui/client.tsx               |  17 +++++--
 tests/host/ping.test.ts         |   7 ++-
 tests/host/plugin-route.test.ts |  57 ++++++++++++++++++++++
 15 files changed, 273 insertions(+), 58 deletions(-)

## diff -U10 (源码，排除 client.js 与 lib 产物)
diff --git a/docs/plugin/DETAIL.md b/docs/plugin/DETAIL.md
deleted file mode 100644
index 04e8ae9..0000000
--- a/docs/plugin/DETAIL.md
+++ /dev/null
@@ -1,23 +0,0 @@
-# Novel workbench
-
-管理一部小说的世界观设定：公理、条目、相互引用与一致性体检。
-
-## 用法
-
-1. 在 DSH 页面右下角点「工作台」打开面板。
-2. 建立世界，填写母题与至少三条公理（每条必须付出代价）。
-3. 写条目，用 `[[双引号]]` 之外的 `[[条目名]]` 在片段里引用。
-4. 「诊断清单」列出所有被规则咬到的问题。
-
-## 边界
-
-- 数据是纯文本，位于插件配置 `dataRoot` 下的 `worlds/<世界>/`。
-- 本版本不含 AI 归纳与审问，也不含正文编辑器。
-
-## 从源码安装
-
-```bash
-npm install && npm run build
-```
-
-构建出 `lib/` 与 `client.js` 后，再安装本目录。
diff --git a/locale/en.json b/locale/en.json
index ae11c76..351eff4 100644
--- a/locale/en.json
+++ b/locale/en.json
@@ -1,7 +1,6 @@
 {
   "meta": {
     "title": "Novel workbench",
-    "description": "Manages world settings as an assertion graph: axioms, entries, citations, and consistency checks.",
-    "detail": "docs/plugin/DETAIL.md"
+    "description": "Minimal probe: registers /novel/ping and a workbench overlay launcher inside the DSH web page."
   }
 }
diff --git a/locale/zh.json b/locale/zh.json
index cb19bd8..f79341e 100644
--- a/locale/zh.json
+++ b/locale/zh.json
@@ -1,7 +1,6 @@
 {
   "meta": {
     "title": "小说工作台",
-    "description": "以断言图管理世界设定：公理、条目、引用与一致性体检。",
-    "detail": "docs/plugin/DETAIL.md"
+    "description": "最小探针：在 DSH 网页内注册 /novel/ping 与一个工作台浮层入口。"
   }
 }
diff --git a/package.json b/package.json
index 700939c..6007626 100644
--- a/package.json
+++ b/package.json
@@ -1,35 +1,36 @@
 {
   "name": "@local/novel-workbench",
   "version": "0.1.0",
   "private": true,
   "type": "module",
   "description": "Novel workbench: assertion-graph worldbuilding inside DSH.",
+  "engines": { "node": ">=20" },
   "exports": {
     ".": "./index.js",
     "./client": "./client.js",
     "./locale/*.json": "./locale/*.json",
     "./icon": "./icon.svg"
   },
-  "files": ["index.js", "client.js", "lib", "cordis.patch.yml", "locale/*.json", "docs/plugin", "icon.svg"],
+  "files": ["index.js", "client.js", "lib", "cordis.patch.yml", "locale/*.json", "icon.svg"],
   "dsh": {
     "bundle": { "patch": "./cordis.patch.yml" },
     "client": {
       "platform": "web",
       "immediately": false,
       "inject": ["@deepseek-ai/dsh-client-ui-layout"]
     }
   },
   "scripts": {
     "build": "tsc -p tsconfig.build.json && node scripts/build-client.mjs",
     "test": "vitest run",
-    "check": "tsx src/host/cli.ts"
+    "verify": "npm run build && npm test"
   },
   "devDependencies": {
     "@types/node": "^22.7.4",
     "@types/react": "^18.3.11",
     "esbuild": "^0.24.0",
     "tsx": "^4.19.1",
     "typescript": "^5.6.2",
     "vitest": "^2.1.2",
     "yaml": "^2.5.1"
   }
diff --git a/scripts/build-client.mjs b/scripts/build-client.mjs
index ff6133a..3bdbddc 100644
--- a/scripts/build-client.mjs
+++ b/scripts/build-client.mjs
@@ -1,35 +1,30 @@
 import { build } from 'esbuild';
-import { writeFileSync, mkdirSync } from 'node:fs';
-import { dirname } from 'node:path';
+import { writeFileSync } from 'node:fs';
 
 const out = await build({
   entryPoints: ['src/ui/client.tsx'],
   bundle: true,
   format: 'cjs',
   platform: 'browser',
   target: 'es2020',
-  jsx: 'transform',
-  jsxFactory: 'React.createElement',
-  jsxFragment: 'React.Fragment',
-  external: ['react'],
+  jsx: 'automatic',
+  external: ['react', 'react/jsx-runtime'],
   define: { 'process.env.NODE_ENV': '"production"' },
   write: false,
   logLevel: 'info'
 });
 
 const code = out.outputFiles[0].text;
 const wrapped = `window.__ModuleLoader__.load({
   id: '@local/novel-workbench',
   factory(require) {
-    const React = require('react');
     const module = { exports: {} };
-    (function (module, exports, React) {
+    (function (module, exports) {
 ${code}
-    })(module, module.exports, React);
+    })(module, module.exports);
     return module.exports;
   },
 });
 `;
-mkdirSync('dist', { recursive: true });
 writeFileSync('client.js', wrapped, 'utf8');
 console.log('client.js written:', wrapped.length, 'chars');
diff --git a/src/host/dataRoot.ts b/src/host/dataRoot.ts
index 4317f6c..12b6528 100644
--- a/src/host/dataRoot.ts
+++ b/src/host/dataRoot.ts
@@ -1,7 +1,8 @@
 import * as path from 'node:path';
 
+// DSH 插件进程的 cwd 是 profile 目录，作品数据不能落在那里；默认以包根为准。
 export function resolveDataRoot(configured: string | undefined, packageRoot: string): string {
   const trimmed = (configured ?? '').trim();
   if (trimmed) return trimmed;
   return path.join(packageRoot, 'data');
 }
diff --git a/src/host/ping.ts b/src/host/ping.ts
index 98c151c..160d2f0 100644
--- a/src/host/ping.ts
+++ b/src/host/ping.ts
@@ -1,7 +1,11 @@
-import { readFileSync } from 'node:fs';
-
 export const VERSION = '0.1.0';
 
-export function pingHandler(root: string) {
-  return () => ({ ok: true as const, dataRoot: root, version: VERSION });
+export interface PingPayload {
+  ok: true;
+  dataRoot: string;
+  version: string;
+}
+
+export function pingPayload(dataRoot: string): PingPayload {
+  return { ok: true, dataRoot, version: VERSION };
 }
diff --git a/src/host/plugin.ts b/src/host/plugin.ts
index 804da33..88362ff 100644
--- a/src/host/plugin.ts
+++ b/src/host/plugin.ts
@@ -1,39 +1,56 @@
-// 已验证（2026-11-23，DSH desktop profile）：ctx.webServer.register 接受
-// Node 风格 handler。若后续版本形状变化，只修改这一个文件，不要把适配逻辑复制到别处。
+// 已验证（2026-11-23，desktop profile）：ctx.webServer.register({ path, kind: 'exact', handler(req, res) }) 生效，
+// GET /novel/ping 返回 200 {"ok":true,"dataRoot":"D:\\code\\novel\\data","version":"0.1.0"}。
+// 整路由形状仍是待验证部分；若后续路由不通，只改这一个文件。
 import { mkdirSync } from 'node:fs';
 import { dirname, resolve } from 'node:path';
 import { fileURLToPath } from 'node:url';
 import { resolveDataRoot } from './dataRoot.js';
+import { pingPayload } from './ping.js';
 
 export interface PluginConfig { dataRoot: string }
 
 export const inject = ['webServer'];
 
+interface PingRoute {
+  path: string;
+  kind: 'exact' | 'prefix';
+  handler: (req: any, res: any) => void;
+}
+
+export interface HostCtx {
+  webServer?: {
+    register(route: PingRoute): () => void;
+  };
+  effect(fn: () => () => void): void;
+}
+
 /** DSH 只在这里出现：路由注册与错误兜底。 */
-export function apply(ctx: any, config: PluginConfig): void {
+export function apply(ctx: HostCtx, config: PluginConfig): void {
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
   ctx.effect(() => web.register({
     path: '/novel/ping',
     kind: 'exact',
     handler: (_req: any, res: any) => {
-      const payload = dataRootError
-        ? { ok: false, error: `数据目录不可用：${dataRootError}`, dataRoot, version: '0.1.0' }
-        : { ok: true, dataRoot, version: '0.1.0' };
-      res.writeHead(dataRootError ? 500 : 200, { 'content-type': 'application/json; charset=utf-8' });
-      res.end(JSON.stringify(payload));
+      if (dataRootError) {
+        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
+        res.end(JSON.stringify({ error: `数据目录不可用：${dataRootError}` }));
+        return;
+      }
+      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
+      res.end(JSON.stringify(pingPayload(dataRoot)));
     }
   }));
 }
diff --git a/src/ui/client.tsx b/src/ui/client.tsx
index 3c67768..63ceae9 100644
--- a/src/ui/client.tsx
+++ b/src/ui/client.tsx
@@ -1,22 +1,26 @@
-import { useState } from 'react';
+import { useEffect, useState } from 'react';
 
 let open = false;
 const listeners = new Set<(v: boolean) => void>();
 export function toggleWorkbench(next?: boolean) {
   open = next ?? !open;
   for (const l of listeners) l(open);
 }
 
 export function Launcher() {
   const [visible, setVisible] = useState(open);
-  listeners.add(setVisible);
+  useEffect(() => {
+    const fn = (v: boolean) => setVisible(v);
+    listeners.add(fn);
+    return () => { listeners.delete(fn); };
+  }, []);
   return (
     <>
       <button onClick={() => toggleWorkbench()} style={{
         position: 'absolute', right: 16, bottom: 16, zIndex: 40,
         padding: '8px 14px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer'
       }}>工作台</button>
       {visible && <Workbench />}
     </>
   );
 }
@@ -34,18 +38,25 @@ function Workbench() {
       position: 'absolute', inset: 0, zIndex: 39, background: 'rgba(255,255,255,0.98)',
       padding: 24, overflow: 'auto'
     }}>
       <h2 style={{ marginTop: 0 }}>小说工作台 <button onClick={() => toggleWorkbench(false)} style={{ float: 'right' }}>关闭</button></h2>
       <button onClick={probe}>测试 Host 连接</button>
       <pre style={{ marginTop: 12 }}>{ping}</pre>
     </div>
   );
 }
 
+interface ClientCtx {
+  slots: {
+    inject(name: string, fn: () => unknown): void;
+    register(options: Record<string, unknown>, component: unknown): unknown;
+  };
+}
+
 export const inject = ['slots'];
 
-export function apply(ctx: any) {
+export function apply(ctx: ClientCtx) {
   ctx.slots.inject('shell.overlay', () => ctx.slots.register(
     { name: 'shell.overlay', id: 'novel-workbench-launcher', order: 20 },
     Launcher
   ));
 }
diff --git a/tests/host/ping.test.ts b/tests/host/ping.test.ts
index 7c6c68a..c1fe7b6 100644
--- a/tests/host/ping.test.ts
+++ b/tests/host/ping.test.ts
@@ -1,12 +1,11 @@
 import { describe, it, expect } from 'vitest';
-import { pingHandler } from '../../src/host/ping';
+import { pingPayload } from '../../src/host/ping';
 
-describe('ping', () => {
+describe('ping payload', () => {
   it('回显数据根目录与版本', () => {
-    const ping = pingHandler('/tmp/novel-data');
-    const r = ping();
+    const r = pingPayload('/tmp/novel-data');
     expect(r.ok).toBe(true);
     expect(r.dataRoot).toBe('/tmp/novel-data');
     expect(typeof r.version).toBe('string');
   });
 });
diff --git a/tests/host/plugin-route.test.ts b/tests/host/plugin-route.test.ts
new file mode 100644
index 0000000..06bc8e3
--- /dev/null
+++ b/tests/host/plugin-route.test.ts
@@ -0,0 +1,57 @@
+import { beforeEach, describe, expect, it, vi } from 'vitest';
+import { mkdirSync } from 'node:fs';
+
+vi.mock('node:fs', () => ({ mkdirSync: vi.fn() }));
+
+import { apply } from '../../src/host/plugin';
+
+type CapturedRoute = {
+  path: string;
+  kind: 'exact' | 'prefix';
+  handler: (req: unknown, res: unknown) => void;
+};
+
+function mount(dataRoot: string) {
+  let captured: CapturedRoute | undefined;
+  apply({
+    webServer: {
+      register: (route) => {
+        captured = route;
+        return () => {};
+      },
+    },
+    effect: (fn) => fn(),
+  }, { dataRoot });
+  if (!captured) throw new Error('route not registered');
+  let status = 0;
+  let body = '';
+  captured.handler({ url: '/', method: 'GET' }, {
+    writeHead: (code: number) => { status = code; },
+    end: (chunk: string) => { body += chunk; },
+  });
+  return { status, body, json: JSON.parse(body) as Record<string, unknown> };
+}
+
+describe('plugin route', () => {
+  beforeEach(() => {
+    vi.mocked(mkdirSync).mockReset();
+  });
+
+  it('注册 /novel/ping 并返回数据根目录', () => {
+    const result = mount('X');
+    expect(result.status).toBe(200);
+    expect(result.json).toEqual({ ok: true, dataRoot: 'X', version: '0.1.0' });
+  });
+
+  it('数据目录创建失败时只返回 error 字段', () => {
+    vi.mocked(mkdirSync).mockImplementationOnce(() => { throw new Error('boom'); });
+    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
+    try {
+      const result = mount('X');
+      expect(result.status).toBe(500);
+      expect(result.json).toEqual({ error: '数据目录不可用：boom' });
+    } finally {
+      warn.mockRestore();
+    }
+  });
+});

## 新增/修改的文件清单
A	client.js
D	docs/plugin/DETAIL.md
A	lib/host/dataRoot.js
A	lib/host/ping.js
A	lib/host/plugin.js
M	locale/en.json
M	locale/zh.json
M	package.json
M	scripts/build-client.mjs
M	src/host/dataRoot.ts
M	src/host/ping.ts
M	src/host/plugin.ts
M	src/ui/client.tsx
M	tests/host/ping.test.ts
A	tests/host/plugin-route.test.ts

