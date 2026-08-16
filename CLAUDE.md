# Claude Code Context Monitor（VS Code 扩展）

监控 Claude Code 的上下文用量。双形态：本扩展 + 终端 CLI（`../claude-context-cli`）。

## 数据契约（改动即破坏性）

- 活跃会话：`~/.claude/sessions/*.json`；对话记录：`~/.claude/projects/<hash(cwd)>/<sessionId>.jsonl`
- `hash(cwd)` = `cwd.replace(/\//g, '-')`
- context% = 最近一条 assistant 的 `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` ÷ 模型容量

## 架构

- 分层：`models/`（纯数据模型）→ `providers/`（数据源接口+实现）→ `services/`（解析/轮询/评分）→ `ui/` + `webview/`（展示）。
- `ContextMonitor` 是唯一数据源：轮询 → 组装 `ContextSnapshot` → `onUpdate` 广播。状态栏/树/面板只订阅，不直接互调。
- 数据读取通过 `ClaudeContextProvider` 接口解耦，当前实现为 `ClaudeCliProvider`（读 `~/.claude`）。
- 模型容量表在 `src/models/contextConfig.ts`（`MODEL_CONTEXT_WINDOWS`）；优先级：用户配置 > 模型表 > 默认 200K。

## 与 CLI 的同步纪律（最高优先级）

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

## 命令

`npm run compile`（tsc→dist）· `npm run watch` · F5 调试 · `npm test`（node:test 单测+集成）· `npm run package`（vsce→.vsix）· `npm run release`（发版脚本）

无 lint：`npm run lint` 是空 stub，别依赖它。

## 陷阱

- `resolveMaxContextTokens` 必须在 JSONL parse **之后**调用；parse 前 `meta.model` 未定义，deepseek-v4-pro 会误判成 200K（实际 1M）。
- 大文件 token = 字符数 ÷ 4，估算值，非精确。
- 第三方网关封顶常小于官方容量，1M 表项实际可能只有 128K。
- `claude` 未必在 PATH 上（通过 VS Code 扩展启动的 Claude Code 尤其如此）；环境探测以 `~/.claude` 数据目录 + 活跃会话文件为主信号，`claude` 命令只用于「打开新 Session」动作。

## 规范

TypeScript strict；中文 JSDoc；类 PascalCase、函数/变量 camelCase、常量 UPPER_SNAKE。
