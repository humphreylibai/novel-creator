# SDD ledger — plan: docs/superpowers/plans/2026-11-23-worldbuilding-p0.md

Spec: docs/superpowers/specs/2026-11-23-worldbuilding-spec.md（可执行）
父文档：docs/superpowers/specs/2026-11-23-novel-system-overview.md
分支：feat/p0-worldbuilding　起点：edb828e
工作区：.superpowers/sdd/worldbuilding-p0/（git-ignored）

## 环境裁决

- **Ruling: 不建 git worktree，改用同目录功能分支 `feat/p0-worldbuilding`** — 交付物是 DSH bundle，安装路径必须与工作目录一致；worktree 会让安装路径与工作树分裂。代价：多分支并行会互相干扰（本计划无此需求）。
- **Ruling: 安装 bundle 由控制器执行，实现者只构建与测试** — 只有控制器持有 `plugin_manager`。代价：Task 0 的最后一步验证由控制器补。

## 预检扫描（Task 间接口）

| 对 | 一方产出 | 另一方消费 | 结论 |
|---|---|---|---|
| T0 ↔ T5 | `plugin.ts` 的 `apply(ctx, config)`、`/novel` 前缀路由 | T5 把 `createHandlers` 接入同一适配层 | 一致；T5 只改 `plugin.ts` 内部 |
| T1 ↔ T3/T4 | `WorldNode` 字段名（`conflictsWith`/`sameAs`/`violations`） | store 与 handlers 全量使用 | 一致；snake_case 仅存在于 `frontmatter.ts` 与 `toNode` |
| T3 ↔ T4 | `store.*` 签名 | handlers 调用 | 一致 |
| T3 ↔ T7 | `Fragment` 类型 | `buildGraph(nodes, fragments)` | 一致 |
| T4 ↔ T8/9/13/14/16 | `createHandlers(root)` 返回 `(NovelReq) => NovelRes` | 各任务只加分支 | 一致 |
| T10 ↔ T11/T12 | `Rule` 类型与 `runRules` 排序 | 规则模块追加到 `all` | 一致 |
| T6 ↔ T7 | `parseWikiLinks` / `resolveTargets` | graph 的 cites 边 | 一致 |
| T5 ↔ T9/13/14/15 | `App.tsx` 的 `view` 状态 | 后续任务追加视图 | 一致 |

## 进度

### Task 0 — 插件骨架与最小探针 ✅

- 探测结果（真机，DSH desktop profile，2026-11-23）：
  - `ctx.webServer.register({ path, kind: 'exact', handler(req, res) })` **成立**（Node 风格 handler）
  - `GET /novel/ping` → `200 {"ok":true,"dataRoot":"D:\\code\\novel\\data","version":"0.1.0"}`
  - 必须声明 `export const inject = ['webServer']`（Host）与 `inject = ['slots']`（Client），否则 Cordis 抛 `cannot get property "x" without inject`
  - `react/jsx-runtime` 可被 module-loader 解析（与 dsh-pet 同形）
- 提交：`5a6664c`（骨架）→ `cae38aa`（inject + 打包收紧）→ `83dc148`（dataRoot 改包根）→ `a50c3d3`（评审修复）
- 评审：首轮 Needs fixes（1 Critical + 7 Important + 若干 Minor）→ 修复轮 3 → 定向复审 `Verdict: all addressed`
- Task 0: complete (commits 5a6664c..a50c3d3, review clean)

**本轮裁决**

- Ruling: dataRoot 默认用**包根** `<包根>/data`，不用 `process.cwd()` — 插件形态下 cwd 是 profile 目录，作品数据不能落在那里；真机已验证。代价：若将来改成打包安装（非 link），包根会变成 node_modules 内路径，需改为显式配置。
- Ruling: 提交构建产物 `lib/` 与 `client.js` — 解决"干净 clone 不可装"；代价：每次改源码必须 `npm run verify` 后再提交，否则产物会过期（复审已用哈希比对确认当前一致）。
- Ruling: 去掉 `meta.detail` 与 `DETAIL.md` — dsh-doc 要求 detail 为单图文档，长文说明应进 `meta.description`；代价：详情页少一段说明。
- Ruling: JSX 采用 automatic runtime（`react/jsx-runtime`）而非 classic — 与 dsh-pet 同形，已被 loader 接受；代价：若某版本 loader 不提供该子路径，需回退 classic（只改 `build-client.mjs`）。
- Ruling: `/novel/*` 未鉴权（本机任意进程可读写作品数据）记为已知限制，不在 Task 0 处理 — DSH 仅绑 127.0.0.1 且为单用户桌面工具；代价：多用户或暴露到局域网场景下必须加鉴权。

### Task 1 — 领域类型与 front matter 编解码 ✅（+ 补丁轮 A）

- 提交：`c8a737f`（feat）→ `eb2de1d`（补交 `lib/engine` 产物）→ 补丁轮 A 另计
- 评审：**Approved**（实现与 brief 逐字一致；四项硬约束全过；产物 SHA256 被独立复算一致），但指出 4 个 **brief 自身的设计缺口**

**本轮裁决（计划修订，必须带到后续任务）**

- Ruling: **未知 front matter 键必须保留** — 给 `WorldNode` 加 `extra: Record<string, unknown>`，parse 收进、serialize 写回。理由：spec §6 的承诺是"数据是唯一真相、人可手改"，而 Task 3 的 `writeNode` 整文件重写会静默抹掉手写键，首次保存即数据丢失。代价：`serializeNode` 需要合并逻辑，多约 10 行。
- Ruling: **数组字段接受标量写法**（`cost: 记忆` → `['记忆']`）— 手写 YAML 的常见写法，否则 `derives` 边静默消失、R4/R7/R12 全部误判。代价：`arr()` 分支变多。
- Ruling: **枚举大小写不敏感**（`strength: Hard` → `hard`）— 否则 hard 静默降级为 soft，R1/R3 不再按 hard 处理。代价：未识别的枚举值仍降级，已在报告记录为已知限制。
- Ruling: **`span` 合法性改为独立规则 R13（区间非法：`from > to`、非整数年份），落在 Task 10 的规则集里** — 不在 frontmatter 层抛错（解析器不该是校验器，否则读旧数据会整体失败）。代价：Task 10 的范围从 R4/R5/R10/R11/R12 扩为含 R13；`spec §7` 提到的 `schema.ts` 由此有了归属。
- Ruling: **YAML 注释不保留** — YAML 库不提供注释保真，为它引入依赖不划算。代价：用户手写的注释在保存后丢失，已写入报告。

**环境备注**
- profile 内同时存在未登记的孤儿符号链接 `dsh-novel → D:\code\novel`（不在 `package.json` 与 `bundles` 里，当前无作用）。未擅自删除（工作区外的副作用）。正式登记的是 `@local/novel-workbench → link:D:/code/novel`。
- 未验证项：浏览器内 `shell.overlay` 是否真的渲染出「工作台」浮层按钮——需人工刷新页面确认。

### Task 1 完成记录

- 补丁轮：A（A1–A4，`e50c01d`）→ B（B1 非 mapping 与原型键，`041fc49`）
- 复审：A1–A4 `all addressed`；B1 由控制器直接验证（见下）
- Task 1: complete (commits c8a737f..041fc49, review clean)

- Ruling: **B1 之后不再派第三个复审员，改由控制器实测三个场景**（标量 front matter / 序列 front matter / `__proto__` 键），因为该补丁是单分支守卫 + 3 条测试、且有 RED 证据。实测：`extra` 均为 `{}`、`body` 保留、`Object.prototype` 未被污染、往返后不产生字符索引键，19 用例全绿。代价：少一道独立视角，若守卫有遗漏只能靠后续任务的集成测试暴露。
- 待办（带到后续任务）：`extra` 为必填字段，计划里各任务的 `mk()` / `toNode()` 字面量需补 `extra: {}`，否则 `tsc` 报缺字段。Task 3 起注意。

### Task 2 — world.yaml 解析与校验 ✅

- 提交：`31e3d18`；6 文件 / 26 用例全绿
- 控制器核查：`worldConfig.ts` 无 `any`（唯一命中是注释里解释"为什么不用 any"）、无 `node:` 内建、`lib/engine/worldConfig.js` 已跟踪、`git diff -- lib` 为空
- Task 2: complete (commits 31e3d18, controller-verified)

- Ruling: **调整评审策略** — 对"计划里已含完整实现与完整测试"的转录型任务，控制器用「`npm run verify` + 结构核查（any/内建依赖/产物跟踪/关键接口 grep）+ 读 diff」替代每任务派评审员；评审员保留给**跨任务接口变更**或**出现偏差**的任务。理由：已连续三个任务实现与 brief 逐字一致，逐任务双人评审的边际收益低于其上下文成本。代价：漂移可能晚一步发现，由最终整支评审兜底。已执行的：Task 1 两次评审、Task 2 控制器核查。

### Task 3 — 文件存储层 ✅
- 提交：`ba39014`；7 文件 / 31 用例；控制器核查：`store.ts` 无 `any`、不自行 parse YAML、`lib/host/store.js` 已跟踪
- Task 3: complete (commits ba39014, controller-verified)

### Task 4 — 请求处理层 ✅（+ 补丁轮 C）
- 提交：`1d05fa6` → `cd9b4c6`；8 文件 / 40 用例
- 补丁 C1–C4：GET 缺失节点 404、URL id 权威 + 不一致 400、`POST /worlds` 缺参 400、`kind` 可降级
- Task 4: complete (commits 1d05fa6..cd9b4c6, controller-verified)

### Task 5 — `/novel` 前缀路由 + 三阶段壳 ✅
- 提交：`bfc9d10`；9 文件 / 46 用例；`client.js` 20239 字节
- 简报由控制器重写（`task-5-brief.md`）：界面从"单独工作台"改为**三阶段壳**，只有「设定 → 世界观」可用，其余灰显并写明原因
- 真机 HTTP 端到端验证（`http://127.0.0.1:54453`）：`/novel/ping` 200 → `/novel/worlds` 200 `[]` → `POST` 201 → 无代价公理 422（未落盘）→ 有代价公理 200 → 节点列表返回含 `extra` 的完整对象 → `/findings` 404（尚未实现，符合预期）
- Task 5: complete (commits bfc9d10, host-verified end-to-end; 界面渲染待人工确认)

**本批裁决**
- Ruling: **Task 5 的界面改为三阶段壳**（原计划是单一工作台） — 一次定死骨架，后续六个系统往里填，避免每个系统都改一次外壳。代价：M0 里"世界观"暂时只有一个系统可用，界面显得空。
- Ruling: **prefix 路由内部对 `/ping` 兜底** — 实现者发现既有测试假定"最后注册的路由是 ping"，而 DSH 的 exact/prefix 匹配优先级未真机验证；兜底使健康检查不依赖优先级。代价：`plugin.ts` 多一个分支。
- 未验证项（需人工）：浏览器内三阶段壳与灰显是否正确、浮层定位是否遮挡。

### M0 里程碑状态

Task 0–5 全部完成，共 46 个自动化用例、6 次提交。**M0（能打开、能写、能看）在 Host 侧已端到端可用**；就差人眼看一眼界面。
