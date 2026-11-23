## Task 0: 最小可运行插件探针（揭盲三个未知）

**为什么先做这个**：有三个点我无法从文档确认，必须先落地验证，否则后面 16 个任务都建在假设上：

1. `ctx.webServer.register(route)` 的 `handler` 签名与请求体读取方式
2. `shell.overlay` 槽位的注册方式与 props
3. Client 半用 esbuild 打成 module-loader 格式是否被接受（`require('react')` 能否解析）

**Files:**
- Create: `package.json`, `cordis.patch.yml`, `index.js`, `icon.svg`, `locale/zh.json`, `locale/en.json`, `docs/DETAIL.md`, `scripts/build-client.mjs`, `src/host/plugin.ts`, `src/host/ping.ts`, `src/ui/client.tsx`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`
- Test: `tests/host/ping.test.ts`

**Interfaces:**
- Produces:
  - `src/host/ping.ts` → `export function pingHandler(root: string): () => { ok: true; dataRoot: string; version: string }`
  - `src/host/plugin.ts` → `export function apply(ctx: HostCtx, config: PluginConfig): void`、`export interface PluginConfig { dataRoot: string }`
  - `client.js` 导出 module-loader 注册（含 `apply`），在 `shell.overlay` 渲染一个浮动按钮 + 面板

- [ ] **Step 1: 写失败测试**

```ts
// tests/host/ping.test.ts
import { describe, it, expect } from 'vitest';
import { pingHandler } from '../../src/host/ping';

describe('ping', () => {
  it('回显数据根目录与版本', () => {
    const ping = pingHandler('/tmp/novel-data');
    const r = ping();
    expect(r.ok).toBe(true);
    expect(r.dataRoot).toBe('/tmp/novel-data');
    expect(typeof r.version).toBe('string');
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -- tests/host/ping.test.ts`
Expected: FAIL，找不到 `src/host/ping`

- [ ] **Step 3: 建 bundle 骨架**

`package.json`：

```json
{
  "name": "@local/novel-workbench",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Novel workbench: assertion-graph worldbuilding inside DSH.",
  "exports": {
    ".": "./index.js",
    "./client": "./client.js",
    "./locale/*.json": "./locale/*.json",
    "./icon": "./icon.svg"
  },
  "files": ["index.js", "client.js", "lib", "cordis.patch.yml", "locale/*.json", "docs", "icon.svg"],
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
    "check": "tsx src/host/cli.ts"
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
}
```

`cordis.patch.yml`：

```yaml
- insert:
    - id: novel-workbench
      name: '@local/novel-workbench'
      config:
        dataRoot: ''
```

`index.js`：

```js
export { apply } from './lib/host/plugin.js';
```

`icon.svg`（256×256 viewBox，原创简单图形）：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <rect width="256" height="256" rx="48" fill="#2f6f4f"/>
  <path d="M56 72h60v112H56z" fill="#f3f0e6"/>
  <path d="M140 72h60v112h-60z" fill="#e5e0cf"/>
  <path d="M116 72h24v112h-24z" fill="#c9c2a6"/>
  <circle cx="86" cy="108" r="9" fill="#2f6f4f"/>
  <circle cx="170" cy="108" r="9" fill="#2f6f4f"/>
</svg>
```

`locale/zh.json`：

```json
{
  "meta": {
    "title": "小说工作台",
    "description": "以断言图管理世界设定：公理、条目、引用与一致性体检。",
    "detail": "docs/DETAIL.md"
  }
}
```

`locale/en.json`：

```json
{
  "meta": {
    "title": "Novel workbench",
    "description": "Manages world settings as an assertion graph: axioms, entries, citations, and consistency checks.",
    "detail": "docs/DETAIL.md"
  }
}
```

`docs/DETAIL.md`：

```markdown
# Novel workbench

管理一部小说的世界观设定：公理、条目、相互引用与一致性体检。

## 用法

1. 在 DSH 页面右下角点「工作台」打开面板。
2. 建立世界，填写母题与至少三条公理（每条必须付出代价）。
3. 写条目，用 `[[双引号]]` 之外的 `[[条目名]]` 在片段里引用。
4. 「诊断清单」列出所有被规则咬到的问题。

## 边界

- 数据是纯文本，位于插件配置 `dataRoot` 下的 `worlds/<世界>/`。
- 本版本不含 AI 归纳与审问，也不含正文编辑器。
```

`tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "bundler",
    "strict": true, "noUncheckedIndexedAccess": true, "jsx": "react-jsx",
    "types": ["node", "vitest/globals"], "skipLibCheck": true, "noEmit": true,
    "allowImportingTsExtensions": false
  },
  "include": ["src", "tests"]
}
```

`tsconfig.build.json`：

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": false, "outDir": "lib", "rootDir": "src", "declaration": false },
  "include": ["src/engine", "src/host"]
}
```

`vitest.config.ts`：

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'node', include: ['tests/**/*.test.ts'] } });
```

- [ ] **Step 4: 实现 ping 与 Host 适配层**

```ts
// src/host/ping.ts
import { readFileSync } from 'node:fs';

export const VERSION = '0.1.0';

export function pingHandler(root: string) {
  return () => ({ ok: true as const, dataRoot: root, version: VERSION });
}
```

```ts
// src/host/plugin.ts
export interface PluginConfig { dataRoot: string }

/** DSH 只在这里出现：路由注册与错误兜底。 */
export function apply(ctx: any, config: PluginConfig): void {
  const dataRoot = config?.dataRoot?.trim() || `${process.cwd()}\\data`;
  const web = ctx.webServer;
  if (!web?.register) {
    ctx.logger?.warn?.('[novel] webServer 不可用，工作台未挂载');
    return;
  }
  ctx.effect(() => web.register({
    path: '/novel/ping',
    kind: 'exact',
    handler: (_req: any, res: any) => {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, dataRoot, version: '0.1.0' }));
    }
  }));
}
```

> 这段适配层是探针要验证的部分。若 `register` 的形状与此不同（例如接受 `{ resource }` 或 fetch 风格 `Request → Response`），**只改这一个文件**，不要动 `handlers.ts`。

- [ ] **Step 5: 实现 Client 入口与构建脚本**

`src/ui/client.tsx`：

```tsx
import { useState } from 'react';

let open = false;
const listeners = new Set<(v: boolean) => void>();
export function toggleWorkbench(next?: boolean) {
  open = next ?? !open;
  for (const l of listeners) l(open);
}

export function Launcher() {
  const [visible, setVisible] = useState(open);
  listeners.add(setVisible);
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

function Workbench() {
  const [ping, setPing] = useState<string>('未连接');
  const probe = async () => {
    try {
      const r = await fetch('/novel/ping');
      setPing(JSON.stringify(await r.json()));
    } catch (e) { setPing(`失败：${(e as Error).message}`); }
  };
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 39, background: 'rgba(255,255,255,0.98)',
      padding: 24, overflow: 'auto'
    }}>
      <h2 style={{ marginTop: 0 }}>小说工作台 <button onClick={() => toggleWorkbench(false)} style={{ float: 'right' }}>关闭</button></h2>
      <button onClick={probe}>测试 Host 连接</button>
      <pre style={{ marginTop: 12 }}>{ping}</pre>
    </div>
  );
}

export function apply(ctx: any) {
  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'novel-workbench-launcher', order: 20 },
    Launcher
  ));
}
```

`scripts/build-client.mjs`：

```js
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const out = await build({
  entryPoints: ['src/ui/client.tsx'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  external: ['react'],
  define: { 'process.env.NODE_ENV': '"production"' },
  write: false,
  logLevel: 'info'
});

const code = out.outputFiles[0].text;
const wrapped = `window.__ModuleLoader__.load({
  id: '@local/novel-workbench',
  factory(require) {
    const React = require('react');
    const module = { exports: {} };
    (function (module, exports, React) {
${code}
    })(module, module.exports, React);
    return module.exports;
  },
});
`;
mkdirSync('dist', { recursive: true });
writeFileSync('client.js', wrapped, 'utf8');
console.log('client.js written:', wrapped.length, 'chars');
```

- [ ] **Step 6: 构建并运行测试**

Run: `npm install && npm test -- tests/host/ping.test.ts && npm run build`
Expected: 测试 PASS；`lib/host/plugin.js` 与 `client.js` 均生成，`client.js` 以 `window.__ModuleLoader__.load(` 开头。

- [ ] **Step 7: 安装并验证（这一步揭盲，必须由人确认）**

用 `plugin_manager` 以本目录为 `target` 安装 `@local/novel-workbench`，然后：

1. 新开一个会话，刷新页面
2. 确认右下角出现「工作台」按钮 → 点开 → 出现全屏面板
3. 点「测试 Host 连接」→ 必须显示 `{"ok":true,"dataRoot":"...","version":"0.1.0"}`
4. 关掉面板再打开，状态正常
5. 在 DSH 的插件列表里确认标题「小说工作台」与详情页文案

**若第 3 步失败**：只改 `src/host/plugin.ts` 的适配层（换 `handler` 为 `resource`，或用 `registerUpgrade`/`webServer` 的其他入口），再重新构建安装。**不要把适配层逻辑复制到别处。**

- [ ] **Step 8: 提交**

```bash
git add package.json cordis.patch.yml index.js icon.svg locale docs/DETAIL.md scripts src tsconfig.json tsconfig.build.json vitest.config.ts tests/host/ping.test.ts
git commit -m "feat: DSH 插件骨架与最小探针（路由 + overlay + 构建）"
```

---

