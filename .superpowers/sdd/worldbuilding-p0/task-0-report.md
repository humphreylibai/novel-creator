# Task 0 报告：DSH 插件最小骨架探针

- 状态：**DONE_WITH_CONCERNS**
- 分支：`feat/p0-worldbuilding`
- 提交：`5a6664c0bbab2724345c7e652acb15d624410feb`
- 提交信息：`feat: DSH 插件骨架与最小探针（路由 + overlay + 构建）`
- 执行边界：按控制器裁决，**未安装 bundle、未调用 `plugin_manager`、未做浏览器验证**（brief Step 7 未执行）。

## 1. 建了哪些文件

已提交（15 个文件，+219 行，均照 brief 原文）：

- `package.json`
- `cordis.patch.yml`
- `index.js`
- `icon.svg`
- `locale/zh.json`
- `locale/en.json`
- `docs/DETAIL.md`
- `scripts/build-client.mjs`
- `src/host/plugin.ts`
- `src/host/ping.ts`
- `src/ui/client.tsx`
- `tsconfig.json`
- `tsconfig.build.json`
- `vitest.config.ts`
- `tests/host/ping.test.ts`

构建生成但按 brief Step 8 的清单**未提交**：

- `client.js`（3441 字符）
- `lib/host/plugin.js`、`lib/host/ping.js`
- `package-lock.json`（npm install 生成，78,288 字节）
- `dist/`（构建脚本创建的空目录，被 `.gitignore` 忽略）

验证辅助（仅在 `.superpowers/` 未跟踪区，未提交）：`task-0-smoke.mjs` 及各命令日志。

## 2. 命令与输出摘要

环境：Node `v24.14.0`，npm `11.9.0`，Windows PowerShell，`D:\code\novel`。

### 2.1 `npm install`

- 结果：`added 56 packages, and audited 57 packages in 3m`
- 退出码：0
- 告警：`6 vulnerabilities (3 moderate, 1 high, 2 critical)`；未执行 `npm audit fix`，避免改动 brief 钉住的版本。
- 另有 npm 新版本提示（11.9.0 → 11.21.3），未升级。

### 2.2 `npm test -- tests/host/ping.test.ts`（RED，实现前）

- 退出码：1
- 结果：`Test Files 1 failed (1)` / `Tests no tests`
- 失败原因（预期）：

```text
Error: Failed to load url ../../src/host/ping (resolved id: ../../src/host/ping)
in D:/code/novel/tests/host/ping.test.ts. Does the file exist?
```

### 2.3 `npm test -- tests/host/ping.test.ts`（GREEN，实现后）

- 退出码：0
- 结果：`Test Files 1 passed (1)` / `Tests 1 passed (1)`（`ping > 回显数据根目录与版本`，2ms）

### 2.4 `npm run build`

- 退出码：0
- 输出：`client.js written: 3441 chars`
- `tsc -p tsconfig.build.json` 无错误；`tsconfig.build.json` 的 `src/engine` 尚不存在，但 `src/host` 有输入，TS 未报“无输入”。

### 2.5 产物校验

- `lib/host/plugin.js`：643 字节；`lib/host/ping.js`：137 字节；`client.js`：3441 字节。
- `client.js` 前缀检查：`StartsWith('window.__ModuleLoader__.load(')` → `True`。
- `node --check client.js` → 退出码 0。
- `node -e "import('./index.js').then(m => console.log(typeof m.apply))"` → `apply: function`。
- 无 DSH 模拟 smoke（`.superpowers/sdd/worldbuilding-p0/task-0-smoke.mjs`）：
  - `client smoke OK: @local/novel-workbench Launcher,apply,toggleWorkbench [["inject","shell.overlay"],["register","shell.overlay","novel-workbench-launcher",20,"function"]]`
  - `host smoke OK: 200 application/json; charset=utf-8 {"ok":true,"dataRoot":"D:\\tmp\\novel-data","version":"0.1.0"}`
  - `host fallback OK: [novel] webServer 不可用，工作台未挂载`
  - 说明：该 smoke 用假 `require`/假 `ctx` 只验证了导出、槽位调用、Node 风格 handler 的 JSON 输出；**不能替代真机验证**。

### 2.6 `npm pack --dry-run --json`

- 退出码：0
- 结果：`entryCount: 15`，`size: 67885`，`unpackedSize: 190546`
- 包含：`client.js`、`lib/host/*.js`、`index.js`、`cordis.patch.yml`、`locale/*.json`、`docs/DETAIL.md`、`icon.svg`、`package.json`
- 注意：`files: ["docs"]` 同时打进了既有的 `docs/superpowers/plans` 与 `specs`（见遗留问题）。

### 2.7 提交后最终复核（全新执行）

- `npm test`：`Tests 1 passed (1)`，`TEST_EXIT=0`
- `npm run build`：`client.js written: 3441 chars`，`BUILD_EXIT=0`
- `client.js` 前缀：`PREFIX_OK=True`
- 工作区未跟踪项仍为 `.superpowers/`、`client.js`、`lib/`、`package-lock.json`；源码与提交一致（`git diff HEAD` 为空）。

### 2.8 `git commit`

- `15 files changed, 219 insertions(+)`
- `HEAD = 5a6664c0bbab2724345c7e652acb15d624410feb`
- 提交时有 LF→CRLF 警告（`core.autocrlf` 行为），无功能影响。
- 提交后未跟踪项：`.superpowers/`、`client.js`、`lib/`、`package-lock.json`（前两者为 brief 明确的构建产物；lockfile 不在 brief 的 `git add` 清单）。

## 3. `client.js` 首行片段

```js
window.__ModuleLoader__.load({
  id: '@local/novel-workbench',
  factory(require) {
    const React = require('react');
    const module = { exports: {} };
    (function (module, exports, React) {
```

对应判断：首字符序列严格等于 `window.__ModuleLoader__.load(`，`apply`/`Launcher`/`toggleWorkbench` 均在导出中。

## 4. 与 brief 的偏差及原因

1. **Step 7 未执行**：控制器明确要求不安装、不碰 `plugin_manager`、不做浏览器验证。因此本任务只保证其前置条件（`lib/host/plugin.js` 与 `client.js` 已生成、前缀正确）。
2. **`src/host/plugin.ts` 顶部新增两行注释**：控制器要求写明“这是待验证的适配层，若真机不通只改这里”。除注释外，代码与 brief 一致，未写第二套 Fetch 实现。
3. **创建了 `docs/DETAIL.md`，与全局约束“不要修改 `docs/` 下的任何文件”字面冲突**：brief 的 Files 列表、Step 8 的 `git add`、以及 `locale/*.json` 的 `meta.detail` 都要求它存在。我的解释是全局约束针对既有的项目文档（`docs/superpowers/**`），`docs/DETAIL.md` 是插件产品内容。**未改动任何既有 docs 文件。** 若控制器认为不应新增，可删除该文件并调整 `files`/`locale.meta.detail`，但那样详情页会缺内容。（修复轮 1 已按控制器要求移至 `docs/plugin/DETAIL.md`。）
4. **`client.js` 实际走 `react/jsx-runtime` 而非经典 `React.createElement`**：`scripts/build-client.mjs` 已照抄 brief（`jsx: 'transform'` + `jsxFactory: 'React.createElement'`），但 esbuild 会自动读取 `tsconfig.json` 的 `jsx: "react-jsx"`，生成代码为 `require("react/jsx-runtime")`。这不是手工改动。旁证：已安装且工作的 `dsh-pet` 插件的 `lib/client.js` 同样 `require("react/jsx-runtime")`（还有 `react-dom/client`），说明 DSH module loader 支持该子路径。因此保持 brief 原样，未加 `tsconfig: false` 等修正。
5. **构建产物与 lockfile 未提交**：严格照 Step 8 的 `git add` 清单。`client.js`/`lib/` 留在工作区供控制器安装；若控制器从干净 clone 安装，需先执行 `npm install && npm run build`。（修复轮 1 已补交 `package-lock.json`；构建产物仍不提交。）
6. **未新增 brief 之外的测试文件**：`tests/` 下只有 brief 指定的 `ping.test.ts`；产物 smoke 是临时脚本，避免污染正式测试集。（修复轮 1 为注入回归新增了 `tests/host/plugin.test.ts`。）
7. 其他：`src/host/ping.ts` 的 `readFileSync` 与 `scripts/build-client.mjs` 的 `dirname` 是 brief 原文中的未使用导入，保留未删；`tsconfig` 未开 `noUnusedLocals`，构建不报错。

## 5. 遗留问题 / 需要控制器注意

1. **`ctx.webServer.register` 形状**：原为待验证假设；修复轮 2 真机已验证，Node 风格 `(req, res)` handler、`{ path, kind: 'exact' }` 成立（`GET /novel/ping` → 200）。若未来 DSH 版本变化，只改 `src/host/plugin.ts`。
2. **`shell.overlay` 的 `ctx.slots.inject/register` 用法未在真机验证**：包括 `order`、组件 props、`inject` 返回签名；只影响 `src/ui/client.tsx`。
3. **`client.js` 依赖 `require("react/jsx-runtime")`**：虽然 `dsh-pet` 证明 loader 支持，但如果该插件被禁用/加载器版本不同，可能出现模块缺失。若真机报此错，首选让构建强制经典运行时（如 `tsconfig: false` 或 `tsconfigRaw`），而不是改包装器。
4. **profile 中已存在指向本目录的符号链接**：`C:\Users\14329\.dsh\profiles\desktop\node_modules\dsh-novel` → `D:\code\novel`（创建于 2026-11-22，早于本任务）。我未安装、未删除、未修改 profile。控制器做安装/刷新时请留意“已经链接过”这一既有状态，避免重复安装或误判。
5. **`files: ["docs"]` 会把内部计划/规格打进可安装产物**：`npm pack` 显示包含 `docs/superpowers/plans/2026-11-23-worldbuilding-p0.md` 等 5 个内部文档（整个包 67,885 字节）。无功能影响，但会泄露过程文档、增大安装体积。建议后续把 `files` 收紧为 `docs/DETAIL.md`；本任务为照抄 brief 未改。（修复轮 1 已改为 `docs/plugin`，产物降至 10 个文件 / 3,615 字节。）
6. **`package-lock.json` 未提交**：安装可复现性依赖 lockfile；若后续要求可复现构建，建议补一次 `chore:` 提交。（修复轮 1 已随 `fix:` 提交。）
7. **`client.tsx` 的 `listeners.add(setVisible)` 无清理**：每次渲染都会累积 setter，面板反复挂载可能泄漏；这是 brief 原文行为，最小探针阶段未改。
8. **`dataRoot` 默认值**：第一轮使用 `${process.cwd()}\\data`，真机发现插件进程 cwd 是 profile 目录；修复轮 2 已改为包根 `<packageRoot>/data` 并显式 `mkdir -p`。详见「修复轮 2」。
9. **npm 审计 6 条漏洞**：来自 brief 钉住的旧版本工具链（devDependencies）；未自动修复以免改变版本。
10. **真机验证状态**：bundle 安装、激活、`GET /novel/ping` 已由控制器验证（见修复轮 2）；右下角按钮/面板（`shell.overlay` UI）未在该诊断中确认，仍需浏览器侧复核。

---

# 修复轮 1（真机诊断后）

- 状态：**DONE**
- 分支：`feat/p0-worldbuilding`
- 提交：`cae38aaf2abea7a806bf334928938e2d63e090d8`
- 提交信息：`fix: 补 webServer/slots 注入并收紧插件打包范围`
- 说明：本轮起详情文档以 `docs/plugin/DETAIL.md` 为准；上文第一轮记录保留为历史。

## F1.1 触发诊断（控制器原文）

```text
dsh: warning: 1 entry did not activate
novel-workbench (@local/novel-workbench): Error: cannot get property "webServer" without inject
```

## F1.2 改了什么

1. **Host 注入（阻塞项）**：`src/host/plugin.ts` 增加模块级 `export const inject = ['webServer'];`；兜底提示由 `ctx.logger?.warn?.(...)` 改为 `console.warn(...)`。`logger` 同为 service，未声明会抛同类错误，因此不再为它增加注入。`apply` 其余逻辑未动。
2. **入口重导出 `inject`（额外但必需）**：`index.js` 从 `export { apply } ...` 改为 `export { apply, inject } from './lib/host/plugin.js';`。Cordis 加载的是包入口 `index.js`，若入口只导出 `apply`，`plugin.ts` 里的 `inject` 不会出现在入口模块的命名空间上，诊断错误会原样复现。该问题由无 DSH smoke 发现（首次跑出 `host inject missing`），修复后通过。
3. **Client 注入**：`src/ui/client.tsx` 增加模块级 `export const inject = ['slots'];`，与 `apply` 并列。构建产物 `client.js` 的导出表明确包含：
   ```js
     Launcher: () => Launcher,
     apply: () => apply,
     inject: () => inject,
     toggleWorkbench: () => toggleWorkbench
   ```
   以及 `exports.inject` 等价形式；smoke 断言其值为 `['slots']`。
4. **打包口径**：
   - `git mv docs/DETAIL.md docs/plugin/DETAIL.md`，正文内容不变；
   - `locale/zh.json`、`locale/en.json` 的 `meta.detail` 改为 `docs/plugin/DETAIL.md`；
   - `package.json` 的 `files` 中 `"docs"` 改为 `"docs/plugin"`；
   - 未改动 `docs/superpowers/**` 任何文件。
5. **可复现**：提交 `package-lock.json`（2,483 行）。`lib/` 与 `client.js` 仍不提交。
6. **详情文档补充**：`docs/plugin/DETAIL.md` 末尾新增「从源码安装」节：
   ```bash
   npm install && npm run build
   ```
   构建出 `lib/` 与 `client.js` 后再安装本目录。
7. **回归测试**：新增 `tests/host/plugin.test.ts`（2 个测试：`inject` 值、`console.warn` 兜底）。

## F1.3 命令与输出

### 新测试 RED（修改前）

- `npm test -- tests/host/plugin.test.ts` → 退出码 1
- `2 tests | 2 failed`
- `expected undefined to deeply equal [ 'webServer' ]`
- `expected "warn" to be called ... Number of calls: 0`

### 修复后 GREEN / 最终复核

- `npm test`：`Test Files 2 passed (2)` / `Tests 3 passed (3)`，`TEST_EXIT=0`
- `npm run build`：`client.js written: 3489 chars`，`BUILD_EXIT=0`
- `node .superpowers/sdd/worldbuilding-p0/task-0-smoke.mjs`：
  - `client smoke OK: @local/novel-workbench Launcher,apply,inject,toggleWorkbench [["inject","shell.overlay"],["register","shell.overlay","novel-workbench-launcher",20,"function"]]`
  - `host smoke OK: 200 application/json; charset=utf-8 {"ok":true,"dataRoot":"D:\\tmp\\novel-data","version":"0.1.0"}`
  - `host fallback OK: [novel] webServer 不可用，工作台未挂载`
  - `SMOKE_EXIT=0`
- `index.js` 内容：`export { apply, inject } from './lib/host/plugin.js';`
- `client.js` 前缀仍为 `window.__ModuleLoader__.load(`；大小 3,489 字符。

### 打包验证

`npm pack --dry-run --json`：

- `entryCount: 10`，`size: 3615`，`unpackedSize: 6951`
- 包含 `client.js`、`lib/host/*.js`、`index.js`、`cordis.patch.yml`、`locale/*.json`、`docs/plugin/DETAIL.md`、`icon.svg`、`package.json`
- **不再包含** `docs/superpowers/**`（第一轮为 15 个文件 / 67,885 字节）
- `package-lock.json` 按 npm 默认不进 tarball，但已在仓库中

### 提交

- `9 files changed, 2518 insertions(+), 5 deletions(-)`
- `HEAD = cae38aaf2abea7a806bf334928938e2d63e090d8`
- 提交后未跟踪项仅 `.superpowers/`、`client.js`、`lib/`（后两者为约定的构建产物）。

## F1.4 修复轮遗留

1. **真机状态**：Host `inject`、Node 风格 `register`、`GET /novel/ping` 已验证；`shell.overlay` 的注册 props 与面板 UI 仍未被诊断覆盖；若面板异常，只改 `src/ui/client.tsx`。
2. **Client `inject = ['slots']`**：若真机 loader 对 client 半的注入名或 factory 返回形状另有要求，以真机错误为准最小修改。
3. **`package-lock.json` 与 npm 11 绑定**：锁文件由 npm 11.9.0 生成；低版本 npm 安装可能提示 lockfile 版本差异。
4. **未再安装 bundle**：本轮只做源码、测试、构建、打包验证；安装与浏览器验证仍由控制器执行。

---

# 修复轮 2（真机验证后）

- 状态：**DONE**
- 分支：`feat/p0-worldbuilding`
- 提交：`83dc148daae757f7b8422619158f828a7038e961`
- 提交信息：`fix: dataRoot 默认到包根并显式创建数据目录`

## F2.1 真机已验证事实（控制器提供，作为事实记录）

- `plugin_manager` 安装成功，bundle 已登记为 `@local/novel-workbench` → `link:D:/code/novel`。
- 首次激活失败；补 `inject` 后通过 `set_bundle` 重新启用 → `application: applied`。
- `GET http://127.0.0.1:54453/novel/ping` → **200**，返回：
  ```json
  {"ok":true,"dataRoot":"C:\\Users\\14329\\.dsh\\profiles\\desktop\\data","version":"0.1.0"}
  ```
- 结论：`ctx.webServer.register({ path, kind: 'exact', handler(req,res) })` 的 **Node 风格 handler 猜测成立**。`src/host/plugin.ts` 顶部注释已由“待验证”改为“已验证（2026-11-23，DSH desktop profile）”。

## F2.2 问题

`dataRoot` 默认值使用了 `process.cwd()`，而插件进程的 cwd 是 **profile 目录**，因此数据落到了 `C:\Users\14329\.dsh\profiles\desktop\data`。作品设定数据不应进 profile。

## F2.3 改了什么

1. **新增纯函数** `src/host/dataRoot.ts`：
   ```ts
   export function resolveDataRoot(configured: string | undefined, packageRoot: string): string {
     const trimmed = (configured ?? '').trim();
     if (trimmed) return trimmed;
     return path.join(packageRoot, 'data');
   }
   ```
2. **`src/host/plugin.ts`**：
   - `packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')`（`lib/host/plugin.js` → 上两级，本地 link 时为 `D:\code\novel`）；
   - `dataRoot = resolveDataRoot(config?.dataRoot, packageRoot)`，**不再使用 `process.cwd()`**；
   - 挂载前 `mkdirSync(dataRoot, { recursive: true })`；已存在则忽略；失败则 `console.warn`，并让 `/novel/ping` 返回 **500** 和 `{ ok:false, error, dataRoot, version }`，不静默；
   - 保留 `export const inject = ['webServer']`、`console.warn` 兜底与 Node 风格 handler。
3. **新增测试** `tests/host/dataRoot.test.ts`（2 个测试，不依赖真实文件系统）：
   - `undefined` / 纯空白 → `<packageRoot>/data`；
   - 含前后空格的配置 → trim 后原样返回。
4. **未改**：`index.js` 的 `inject` 重导出、`src/ui/client.tsx` 的 `inject = ['slots']`、`lib/`/`client.js` 的提交口径（仍不提交）。

## F2.4 命令与输出

### 新测试 RED（实现前）

- `npm test -- tests/host/dataRoot.test.ts` → 退出码 1
- `Failed to load url ../../src/host/dataRoot ... Does the file exist?` / `no tests`

### 修复后 GREEN / 最终复核

- `npm test`：`Test Files 3 passed (3)` / `Tests 5 passed (5)`，`TEST_EXIT=0`
- `npm run build`：`client.js written: 3489 chars`，`BUILD_EXIT=0`
- `node .superpowers/sdd/worldbuilding-p0/task-0-smoke.mjs`（`SMOKE_EXIT=0`）：
  - `client smoke OK: @local/novel-workbench Launcher,apply,inject,toggleWorkbench [...]`
  - `host configured OK: 200 {"ok":true,"dataRoot":"D:\\code\\novel\\.superpowers\\sdd\\worldbuilding-p0\\smoke-data","version":"0.1.0"}`（配置值前后空格被 trim）
  - `host package-root default OK: D:\code\novel\data`（包根默认，不再落到 profile）
  - `host mkdir failure OK: 500 {"ok":false,"error":"数据目录不可用：EEXIST: ...","dataRoot":"...","version":"0.1.0"}`
  - `host fallback OK: [novel] webServer 不可用，工作台未挂载`
- smoke 清理：`data/`、`smoke-data/`、`smoke-file` 均无残留（`Test-Path` 均为 False）。

### 打包验证

`npm pack --dry-run --json`：

- `entryCount: 11`，`size: 4118`，`unpackedSize: 8106`
- 新增 `lib/host/dataRoot.js`（227 字节）；仍不包含 `docs/superpowers/**`
- `package-lock.json` 在仓库中但不进 tarball

### 提交

- `3 files changed, 42 insertions(+), 5 deletions(-)`
- `HEAD = 83dc148daae757f7b8422619158f828a7038e961`
- 提交后未跟踪项仅 `.superpowers/`、`client.js`、`lib/`（后两者为约定的构建产物）。

## F2.5 已知限制（本轮记录，不修改）

- **`/novel/*` 是未鉴权的命名路由**：本机任何进程都能读写作品数据。DSH 只绑 `127.0.0.1`，且这是单用户桌面工具，风险低；后续可加 Origin 校验。
- `shell.overlay` 面板 UI 未包含在本次真机诊断中，仍需浏览器侧确认。
- `resolveDataRoot` 对已配置值只做 trim，不展开 `~`、不转为绝对路径；这是按控制器指定的语义实现。

---

# 修复轮 3（评审后，DONE 但 Needs fixes）

- 状态：**DONE**
- 分支：`feat/p0-worldbuilding`
- 提交：`a50c3d35b293a28ed3df361e0354e9a3b8401998`
- 提交信息：`fix: 落实评审修复（契约类型、路由测试、构建产物与元数据）`
- 说明：本轮删除 `docs/plugin/DETAIL.md` 与 locale 的 `meta.detail`；此前报告中关于详情文档的记录由本节取代。

## F3.1 裁决落实（R1–R5）

| 条目 | 落实位置与做法 |
|---|---|
| **R1** dataRoot 保持包根 | `src/host/dataRoot.ts` 第 3 行新增注释：`// DSH 插件进程的 cwd 是 profile 目录，作品数据不能落在那里；默认以包根为准。` 逻辑仍为 `<packageRoot>/data`，未改回 `process.cwd()`。 |
| **R2** 提交构建产物 | `lib/`、`client.js` 未被 `.gitignore` 忽略（`git check-ignore -v lib client.js` 退出码 1，无输出），本轮随提交纳入版本库；`package.json` 新增 `"verify": "npm run build && npm test"`。以后每次改源码，提交前必须跑 `npm run verify`。 |
| **R3** 去掉 detail | `git rm docs/plugin/DETAIL.md`；`locale/zh.json`、`locale/en.json` 删除 `meta.detail`，`meta.description` 改为已实现能力（中文：`最小探针：在 DSH 网页内注册 /novel/ping 与一个工作台浮层入口。`；英文对应翻译）；`package.json` 的 `files` 去掉 `"docs/plugin"`。未动 `docs/superpowers/**`。 |
| **R4** JSX automatic runtime | `scripts/build-client.mjs`：`jsx: 'automatic'`、`external: ['react', 'react/jsx-runtime']`，删除 `jsxFactory`/`jsxFragment`；包装器删除 `const React = require('react')` 与 IIFE 的 `React` 参数。构建产物 `client.js` 第 3–6 行仅保留 `factory(require)`、`module` 与 IIFE；`var import_react = require("react")` 仍存在且被 `useState` 使用，`var import_jsx_runtime = require("react/jsx-runtime")` 为 automatic runtime，未见未使用的 `React` 绑定。 |
| **R5** `index.js` 重导出 `inject` | 保持 `export { apply, inject } from './lib/host/plugin.js';` 不变。 |

## F3.2 Important / Minor（F1–F7）

| 条目 | 落实位置与做法 |
|---|---|
| **F1** 去掉 `any` | `src/host/plugin.ts` 定义 `PingRoute` / `HostCtx`（`webServer.register`、`effect` 两项），`apply(ctx: HostCtx, config: PluginConfig)`；`src/ui/client.tsx` 定义 `ClientCtx`（`slots.inject`、`slots.register`），`apply(ctx: ClientCtx)`。源码中不再有裸 `ctx`/`config` 的 `any`；仅 `req`/`res` 按控制器给定签名保留 `any`。未声明未使用的 DSH 成员。 |
| **F2** 真实路由测试 | `src/host/ping.ts` 导出 `pingPayload(dataRoot): { ok: true; dataRoot; version }`，`src/host/plugin.ts` 的 handler 实际调用 `JSON.stringify(pingPayload(dataRoot))`；删除孤儿 `pingHandler`。`tests/host/ping.test.ts` 改为测 `pingPayload`；新增 `tests/host/plugin-route.test.ts`：假 ctx 捕获 `register` 的路由，假 `req`/`res` 调 handler，断言 200 与 `{ ok:true, dataRoot:'X', version:'0.1.0' }`。测试用 `vi.mock('node:fs')` 替换 `mkdirSync`，避免在仓库里创建 `X` 目录。 |
| **F3** 错误体对齐 | `plugin.ts` 的 mkdir 失败分支只返回 `{ error: string }`（HTTP 500），不再带 `ok/dataRoot/version`；`plugin-route.test.ts` 第二例断言 `toEqual({ error: '数据目录不可用：boom' })`。 |
| **F4** 监听器泄漏 | `src/ui/client.tsx` 的 `Launcher` 改用 `useEffect(() => { const fn = ...; listeners.add(fn); return () => { listeners.delete(fn); }; }, [])`，不再在渲染期 `listeners.add`。 |
| **F5** 死代码 | `src/host/ping.ts` 删除未用 `readFileSync`；`scripts/build-client.mjs` 删除 `dirname`、`mkdirSync('dist')` 与 `dist` 创建；`package.json` 删除指向不存在文件的 `"check": "tsx src/host/cli.ts"`。`tsx`/`yaml` 依赖保留。 |
| **F6** engines | `package.json` 增加 `"engines": { "node": ">=20" }`。 |
| **F7** 顶部注释 | `src/host/plugin.ts` 顶部改为有证据的表述：`已验证（2026-11-23，desktop profile）... GET /novel/ping 返回 200 ... 整路由形状仍是待验证部分；若后续路由不通，只改这一个文件。` |

## F3.3 命令与输出

### 新测试 RED（实现前）

- `npm test -- tests/host/ping.test.ts tests/host/plugin-route.test.ts` → 退出码 1
- `pingPayload` 不存在（`ping.test.ts` 失败）
- 失败响应仍有 `ok:false/dataRoot/version` 多余字段（`plugin-route.test.ts` 的 `{error}` 断言失败）
- 结果：`Tests 2 failed | 1 passed (3)`

### 最终 `npm run verify`（build + test，fresh）

- `client.js written: 3572 chars`
- `Test Files 4 passed (4)` / `Tests 7 passed (7)`
- 明细：`dataRoot` 2、`ping` 1、`plugin` 2、`plugin-route` 2
- 退出码 0
- `plugin-route` 覆盖了：路由注册、200 成功响应、500 `{error}` 响应

### 无 DSH smoke（`.superpowers/sdd/worldbuilding-p0/task-0-smoke.mjs`，退出码 0）

- `client smoke OK: @local/novel-workbench Launcher,apply,inject,toggleWorkbench [...]`
- `host configured OK: 200 {"ok":true,"dataRoot":"...\\smoke-data","version":"0.1.0"}`
- `host package-root default OK: D:\code\novel\data`
- `host mkdir failure OK: 500 {"error":"数据目录不可用：EEXIST: ..."}`（仅 `error` 字段）
- `host fallback OK: [novel] webServer 不可用，工作台未挂载`

### 产物与打包

- `client.js`：3572 字符；首行 `window.__ModuleLoader__.load({`；包装器无 `React` 参数/绑定；导出表含 `Launcher/apply/inject/toggleWorkbench`。
- `npm pack --dry-run --json`：`entryCount: 10`，`size: 3675`，`unpackedSize: 7727`；不再包含任何 `docs/` 文件。
- `lib/host/`：`dataRoot.js`、`ping.js`、`plugin.js` 均已生成并提交。

### 提交

- `15 files changed, 273 insertions(+), 58 deletions(-)`
- 新增 `client.js`、`lib/host/*.js`、`tests/host/plugin-route.test.ts`
- 删除 `docs/plugin/DETAIL.md`
- `HEAD = a50c3d35b293a28ed3df361e0354e9a3b8401998`
- 提交后 `git status` 仅剩未跟踪的 `.superpowers/`（报告与临时验证脚本）。

## F3.4 备注

- 改源码后的固定流程：`npm run verify`（构建 + 测试）→ 检查 `client.js`/`lib/` 已更新 → 一起提交。构建产物已纳入版本库，漏跑 verify 会提交过期产物。
- 本轮仍未安装 bundle、未派发 subagent。
- `/novel/*` 未鉴权、`shell.overlay` UI 未在真机诊断中确认，这两条限制继续有效。
- 最终复核时发现空目录 `data/`（创建于 22:55，内容是 0 项）。它应是运行中的 DSH 实例重载插件后按包根创建的数据根，不是测试残留，未删除；`git status` 仍只显示未跟踪的 `.superpowers/`。
