# Review package — Task 0 (BASE edb828e → HEAD 5a6664c)

## git log
5a6664c feat: DSH 插件骨架与最小探针（路由 + overlay + 构建）

## git status (未提交物)
?? .superpowers/
?? client.js
?? lib/
?? package-lock.json

## diff --stat
 cordis.patch.yml         |  5 +++++
 docs/DETAIL.md           | 15 +++++++++++++++
 icon.svg                 |  8 ++++++++
 index.js                 |  1 +
 locale/en.json           |  7 +++++++
 locale/zh.json           |  7 +++++++
 package.json             | 36 +++++++++++++++++++++++++++++++++++
 scripts/build-client.mjs | 35 ++++++++++++++++++++++++++++++++++
 src/host/ping.ts         |  7 +++++++
 src/host/plugin.ts       | 21 +++++++++++++++++++++
 src/ui/client.tsx        | 49 ++++++++++++++++++++++++++++++++++++++++++++++++
 tests/host/ping.test.ts  | 12 ++++++++++++
 tsconfig.build.json      |  5 +++++
 tsconfig.json            |  9 +++++++++
 vitest.config.ts         |  2 ++
 15 files changed, 219 insertions(+)

## diff -U10
diff --git a/cordis.patch.yml b/cordis.patch.yml
new file mode 100644
index 0000000..1957810
--- /dev/null
+++ b/cordis.patch.yml
@@ -0,0 +1,5 @@
+- insert:
+    - id: novel-workbench
+      name: '@local/novel-workbench'
+      config:
+        dataRoot: ''
diff --git a/docs/DETAIL.md b/docs/DETAIL.md
new file mode 100644
index 0000000..d9578e5
--- /dev/null
+++ b/docs/DETAIL.md
@@ -0,0 +1,15 @@
+# Novel workbench
+
+管理一部小说的世界观设定：公理、条目、相互引用与一致性体检。
+
+## 用法
+
+1. 在 DSH 页面右下角点「工作台」打开面板。
+2. 建立世界，填写母题与至少三条公理（每条必须付出代价）。
+3. 写条目，用 `[[双引号]]` 之外的 `[[条目名]]` 在片段里引用。
+4. 「诊断清单」列出所有被规则咬到的问题。
+
+## 边界
+
+- 数据是纯文本，位于插件配置 `dataRoot` 下的 `worlds/<世界>/`。
+- 本版本不含 AI 归纳与审问，也不含正文编辑器。
diff --git a/icon.svg b/icon.svg
new file mode 100644
index 0000000..eadc26e
--- /dev/null
+++ b/icon.svg
@@ -0,0 +1,8 @@
+<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
+  <rect width="256" height="256" rx="48" fill="#2f6f4f"/>
+  <path d="M56 72h60v112H56z" fill="#f3f0e6"/>
+  <path d="M140 72h60v112h-60z" fill="#e5e0cf"/>
+  <path d="M116 72h24v112h-24z" fill="#c9c2a6"/>
+  <circle cx="86" cy="108" r="9" fill="#2f6f4f"/>
+  <circle cx="170" cy="108" r="9" fill="#2f6f4f"/>
+</svg>
diff --git a/index.js b/index.js
new file mode 100644
index 0000000..98f9bf4
--- /dev/null
+++ b/index.js
@@ -0,0 +1 @@
+export { apply } from './lib/host/plugin.js';
diff --git a/locale/en.json b/locale/en.json
new file mode 100644
index 0000000..66cf0ff
--- /dev/null
+++ b/locale/en.json
@@ -0,0 +1,7 @@
+{
+  "meta": {
+    "title": "Novel workbench",
+    "description": "Manages world settings as an assertion graph: axioms, entries, citations, and consistency checks.",
+    "detail": "docs/DETAIL.md"
+  }
+}
diff --git a/locale/zh.json b/locale/zh.json
new file mode 100644
index 0000000..dc831d8
--- /dev/null
+++ b/locale/zh.json
@@ -0,0 +1,7 @@
+{
+  "meta": {
+    "title": "小说工作台",
+    "description": "以断言图管理世界设定：公理、条目、引用与一致性体检。",
+    "detail": "docs/DETAIL.md"
+  }
+}
diff --git a/package.json b/package.json
new file mode 100644
index 0000000..0319eeb
--- /dev/null
+++ b/package.json
@@ -0,0 +1,36 @@
+{
+  "name": "@local/novel-workbench",
+  "version": "0.1.0",
+  "private": true,
+  "type": "module",
+  "description": "Novel workbench: assertion-graph worldbuilding inside DSH.",
+  "exports": {
+    ".": "./index.js",
+    "./client": "./client.js",
+    "./locale/*.json": "./locale/*.json",
+    "./icon": "./icon.svg"
+  },
+  "files": ["index.js", "client.js", "lib", "cordis.patch.yml", "locale/*.json", "docs", "icon.svg"],
+  "dsh": {
+    "bundle": { "patch": "./cordis.patch.yml" },
+    "client": {
+      "platform": "web",
+      "immediately": false,
+      "inject": ["@deepseek-ai/dsh-client-ui-layout"]
+    }
+  },
+  "scripts": {
+    "build": "tsc -p tsconfig.build.json && node scripts/build-client.mjs",
+    "test": "vitest run",
+    "check": "tsx src/host/cli.ts"
+  },
+  "devDependencies": {
+    "@types/node": "^22.7.4",
+    "@types/react": "^18.3.11",
+    "esbuild": "^0.24.0",
+    "tsx": "^4.19.1",
+    "typescript": "^5.6.2",
+    "vitest": "^2.1.2",
+    "yaml": "^2.5.1"
+  }
+}
diff --git a/scripts/build-client.mjs b/scripts/build-client.mjs
new file mode 100644
index 0000000..ff6133a
--- /dev/null
+++ b/scripts/build-client.mjs
@@ -0,0 +1,35 @@
+import { build } from 'esbuild';
+import { writeFileSync, mkdirSync } from 'node:fs';
+import { dirname } from 'node:path';
+
+const out = await build({
+  entryPoints: ['src/ui/client.tsx'],
+  bundle: true,
+  format: 'cjs',
+  platform: 'browser',
+  target: 'es2020',
+  jsx: 'transform',
+  jsxFactory: 'React.createElement',
+  jsxFragment: 'React.Fragment',
+  external: ['react'],
+  define: { 'process.env.NODE_ENV': '"production"' },
+  write: false,
+  logLevel: 'info'
+});
+
+const code = out.outputFiles[0].text;
+const wrapped = `window.__ModuleLoader__.load({
+  id: '@local/novel-workbench',
+  factory(require) {
+    const React = require('react');
+    const module = { exports: {} };
+    (function (module, exports, React) {
+${code}
+    })(module, module.exports, React);
+    return module.exports;
+  },
+});
+`;
+mkdirSync('dist', { recursive: true });
+writeFileSync('client.js', wrapped, 'utf8');
+console.log('client.js written:', wrapped.length, 'chars');
diff --git a/src/host/ping.ts b/src/host/ping.ts
new file mode 100644
index 0000000..98c151c
--- /dev/null
+++ b/src/host/ping.ts
@@ -0,0 +1,7 @@
+import { readFileSync } from 'node:fs';
+
+export const VERSION = '0.1.0';
+
+export function pingHandler(root: string) {
+  return () => ({ ok: true as const, dataRoot: root, version: VERSION });
+}
diff --git a/src/host/plugin.ts b/src/host/plugin.ts
new file mode 100644
index 0000000..95e11d2
--- /dev/null
+++ b/src/host/plugin.ts
@@ -0,0 +1,21 @@
+// 待验证的适配层：DSH 的 ctx.webServer.register 形状（Node 风格 handler vs Fetch 风格）
+// 尚未在真机确认。若安装后 /novel/ping 不通，只修改这一个文件，不要把适配逻辑复制到别处。
+export interface PluginConfig { dataRoot: string }
+
+/** DSH 只在这里出现：路由注册与错误兜底。 */
+export function apply(ctx: any, config: PluginConfig): void {
+  const dataRoot = config?.dataRoot?.trim() || `${process.cwd()}\\data`;
+  const web = ctx.webServer;
+  if (!web?.register) {
+    ctx.logger?.warn?.('[novel] webServer 不可用，工作台未挂载');
+    return;
+  }
+  ctx.effect(() => web.register({
+    path: '/novel/ping',
+    kind: 'exact',
+    handler: (_req: any, res: any) => {
+      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
+      res.end(JSON.stringify({ ok: true, dataRoot, version: '0.1.0' }));
+    }
+  }));
+}
diff --git a/src/ui/client.tsx b/src/ui/client.tsx
new file mode 100644
index 0000000..a206374
--- /dev/null
+++ b/src/ui/client.tsx
@@ -0,0 +1,49 @@
+import { useState } from 'react';
+
+let open = false;
+const listeners = new Set<(v: boolean) => void>();
+export function toggleWorkbench(next?: boolean) {
+  open = next ?? !open;
+  for (const l of listeners) l(open);
+}
+
+export function Launcher() {
+  const [visible, setVisible] = useState(open);
+  listeners.add(setVisible);
+  return (
+    <>
+      <button onClick={() => toggleWorkbench()} style={{
+        position: 'absolute', right: 16, bottom: 16, zIndex: 40,
+        padding: '8px 14px', borderRadius: 8, border: '1px solid #ccc', background: '#fff', cursor: 'pointer'
+      }}>工作台</button>
+      {visible && <Workbench />}
+    </>
+  );
+}
+
+function Workbench() {
+  const [ping, setPing] = useState<string>('未连接');
+  const probe = async () => {
+    try {
+      const r = await fetch('/novel/ping');
+      setPing(JSON.stringify(await r.json()));
+    } catch (e) { setPing(`失败：${(e as Error).message}`); }
+  };
+  return (
+    <div style={{
+      position: 'absolute', inset: 0, zIndex: 39, background: 'rgba(255,255,255,0.98)',
+      padding: 24, overflow: 'auto'
+    }}>
+      <h2 style={{ marginTop: 0 }}>小说工作台 <button onClick={() => toggleWorkbench(false)} style={{ float: 'right' }}>关闭</button></h2>
+      <button onClick={probe}>测试 Host 连接</button>
+      <pre style={{ marginTop: 12 }}>{ping}</pre>
+    </div>
+  );
+}
+
+export function apply(ctx: any) {
+  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
+    { name: 'shell.overlay', id: 'novel-workbench-launcher', order: 20 },
+    Launcher
+  ));
+}
diff --git a/tests/host/ping.test.ts b/tests/host/ping.test.ts
new file mode 100644
index 0000000..7c6c68a
--- /dev/null
+++ b/tests/host/ping.test.ts
@@ -0,0 +1,12 @@
+import { describe, it, expect } from 'vitest';
+import { pingHandler } from '../../src/host/ping';
+
+describe('ping', () => {
+  it('回显数据根目录与版本', () => {
+    const ping = pingHandler('/tmp/novel-data');
+    const r = ping();
+    expect(r.ok).toBe(true);
+    expect(r.dataRoot).toBe('/tmp/novel-data');
+    expect(typeof r.version).toBe('string');
+  });
+});
diff --git a/tsconfig.build.json b/tsconfig.build.json
new file mode 100644
index 0000000..1c5c78d
--- /dev/null
+++ b/tsconfig.build.json
@@ -0,0 +1,5 @@
+{
+  "extends": "./tsconfig.json",
+  "compilerOptions": { "noEmit": false, "outDir": "lib", "rootDir": "src", "declaration": false },
+  "include": ["src/engine", "src/host"]
+}
diff --git a/tsconfig.json b/tsconfig.json
new file mode 100644
index 0000000..c6f53a5
--- /dev/null
+++ b/tsconfig.json
@@ -0,0 +1,9 @@
+{
+  "compilerOptions": {
+    "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler",
+    "strict": true, "noUncheckedIndexedAccess": true, "jsx": "react-jsx",
+    "types": ["node", "vitest/globals"], "skipLibCheck": true, "noEmit": true,
+    "allowImportingTsExtensions": false
+  },
+  "include": ["src", "tests"]
+}
diff --git a/vitest.config.ts b/vitest.config.ts
new file mode 100644
index 0000000..bf9c3a6
--- /dev/null
+++ b/vitest.config.ts
@@ -0,0 +1,2 @@
+import { defineConfig } from 'vitest/config';
+export default defineConfig({ test: { environment: 'node', include: ['tests/**/*.test.ts'] } });

