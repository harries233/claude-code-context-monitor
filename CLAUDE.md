# Claude Code Context Monitor（VS Code 扩展）

> **状态（2026-08-16）**：三个 Bug 已修复（侧边栏点击切换详情 · 多窗口当前会话按最近活动跟随 · 悬停提示不再被轮询重建打断）· 23 测试全绿 · 本次未发版，待 `bash scripts/release.sh 0.2.1` · 下一步：可选上架 VS Code Marketplace

监控 Claude Code 的上下文用量。双形态：本扩展 + 终端 CLI（`../claude-context-cli`）。

## 0. 当前状态（2026-08-16）

| 项 | 值 |
|---|---|
| 当前版本 | **v0.2.0**（已发布；Provider 架构 + Context 健康评分 + 17 测试）· 三个 Bug 修复已完成，待发版 **v0.2.1** |
| 分支 | `main`，本次修复已提交（未推送，领先 `origin`） |
| 工作区 | 干净（`dist/` 已 gitignore） |
| 发布 | 最近一次 `v0.2.0`（vsix 资产 + tap `harries233/homebrew-context` 同步）；本次未发版 |
| 安装方式 | 方式一 `code --install-extension claude-code-context-monitor-0.2.0.vsix` ✅ · 方式二 `brew install claude-context-monitor` ✅ |
| 最近修复 | ① 侧边栏点击 Session 时详情面板跟随切换对应会话（`openDashboard` 携带 sessionId + Dashboard 选中态）；② 多 Claude 窗口/终端时底部 Claude Context 按「最近活动」判定当前会话（`resolveCurrentSession` 改按 `lastActivityAt`/`lastModifiedAt`，不再锁定最新开启的），并在窗口获焦/切终端时立即刷新；③ 悬停提示改为 diff 式树更新（稳定实例 + 内容变化才刷新），轮询不再重建整棵树、悬停内容保持到鼠标离开 |
| 下一步 | 可选：`bash scripts/release.sh 0.2.1` 发版；`vsce publish` 上架 Marketplace（需 Azure DevOps PAT） |

## 1. 数据契约（改动即破坏性）

- 活跃会话：`~/.claude/sessions/*.json`；对话记录：`~/.claude/projects/<hash(cwd)>/<sessionId>.jsonl`
- `hash(cwd)` = `cwd.replace(/\//g, '-')`
- context% = 最近一条 assistant 的 `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` ÷ 模型容量

## 2. 架构

- 分层：`models/`（纯数据模型）→ `providers/`（数据源接口+实现）→ `services/`（解析/轮询/评分）→ `ui/` + `webview/`（展示）。
- `ContextMonitor` 是唯一数据源：轮询 → 组装 `ContextSnapshot` → `onUpdate` 广播。状态栏/树/面板只订阅，不直接互调。
- 数据读取通过 `ClaudeContextProvider` 接口解耦，当前实现为 `ClaudeCliProvider`（读 `~/.claude`）。
- 模型容量表在 `src/models/contextConfig.ts`（`MODEL_CONTEXT_WINDOWS`）；优先级：用户配置 > 模型表 > 默认 200K。

## 3. 与 CLI 的同步纪律（最高优先级）

CLI（`../claude-context-cli/bin/claude-context`）是扩展**解析后端**的内联拷贝。改 UI/扩展专属文件**不用**动 CLI：
`src/extension.ts` / `src/ui/**` / `src/webview/**` / `media/**` / `src/services/summary.ts` / `src/services/healthScore.ts` / `src/providers/**`（Provider 抽象与探测为扩展专属）。

改**解析/数据契约**相关文件必须同步 CLI 对应段，反之亦然：
- `src/models/contextConfig.ts` ↔ CLI 顶部 `MODEL_CONTEXT_WINDOWS` + `resolveMaxTokens`
- `src/services/sessionParser.ts` ↔ CLI 的 JSONL 解析段
- `src/services/currentSession.ts` ↔ CLI 的当前会话判定段
- `src/services/warningSystem.ts` / `suggestions.ts` ↔ CLI 的告警/建议段
- `src/services/format.ts` ↔ CLI 的格式化段
- `src/utils/pathUtil.ts` ↔ CLI 的 hash(cwd)/路径段

> 已知差异（扩展领先，CLI 未同步）：`sessionParser` 新增 `fileReadCount`/`duplicateReadCount` 供健康评分使用，CLI 不输出这两个字段，不影响 context% 一致性。改后端后，用真实 `~/.claude` 跑 `node ../claude-context-cli/bin/claude-context` 冒烟。

## 4. 命令

`npm run compile`（tsc→dist）· `npm run watch` · F5 调试 · `npm test`（node:test 单测+集成）· `npm run package`（vsce→.vsix）· `npm run release`（发版脚本）

无 lint：`npm run lint` 是空 stub，别依赖它。

## 5. 陷阱

- `resolveMaxContextTokens` 必须在 JSONL parse **之后**调用；parse 前 `meta.model` 未定义，deepseek-v4-pro 会误判成 200K（实际 1M）。
- 大文件 token = 字符数 ÷ 4，估算值，非精确。
- 第三方网关封顶常小于官方容量，1M 表项实际可能只有 128K。
- `claude`/`code` 未必在 PATH 上（通过 VS Code 扩展启动的 Claude Code 尤其如此）；环境探测以 `~/.claude` 数据目录 + 活跃会话文件为主信号，`claude` 命令只用于「打开新 Session」动作。formula 的 `code_cli` 按标准 app bundle 路径兜底，不依赖 PATH。
- Homebrew formula 类名必须匹配文件名：`claude-context-monitor.rb` ↔ `ClaudeContextMonitor`。`release.sh` 只替换 version/sha256/url、不碰类名；改类名需同时改源仓库与 tap 两处 Formula 并各自 push。

## 6. 规范

TypeScript strict；中文 JSDoc；类 PascalCase、函数/变量 camelCase、常量 UPPER_SNAKE。
