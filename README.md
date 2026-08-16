# Claude Context Monitor

一个生产级 VS Code 插件，实时监控 **Claude Code** 的上下文（Context）使用情况，提供健康评分、分级告警与 Session 管理，帮助开发者把 AI Coding Session 维持在健康状态。

> 无需打开源码、无需 F5 调试宿主：`brew install claude-context-monitor` 后打开 VS Code 即可使用。

## ✨ 功能

1. **自动激活** — 通过 `onStartupFinished` 启动后自动初始化监控、创建状态栏、加载 Dashboard、开启数据监听。
2. **环境自动发现** — 检测 Claude Code 是否安装、当前工作区与当前 Session；未检测到则显示 `Claude Code not detected`。
3. **Status Bar Context Monitor** — 底部状态栏显示 `Claude Context: XX%`，颜色随使用率变化，点击打开详情面板。
4. **Context Dashboard（WebView）** — 环形仪表盘 + 进度条 + Token 明细（Input / Output / Total）+ Session 时长与消息数。
5. **Context 健康评分系统** — A/B/C/D 四级评分，综合 Context 百分比、消息数量、文件读取数量、大文件数量、重复内容五个维度。
6. **智能提醒** — 70% 黄色 / 85% 红色 / 95% 强提醒，并提供 `Generate Summary`、`Open New Session`、`复制 /compact` 操作。
7. **Session 管理** — 侧边栏与 Dashboard 列出 Session 名称、创建时间、Context 使用率、最近活动、运行状态。
8. **Token 消耗分析** — `Largest Context Consumers` 列出占用 token 最多的文件，并给出加入 ignore 规则的建议。

## 🔌 数据来源

插件读取 Claude Code 的本地数据目录（默认 `~/.claude`）：

| 数据 | 位置 |
| --- | --- |
| 运行中的 Session | `~/.claude/sessions/*.json` |
| 对话记录（含 token 用量） | `~/.claude/projects/<hash(cwd)>/<sessionId>.jsonl` |
| 会话标题 | JSONL 中的 `ai-title` 行 |
| 模型名 | assistant 消息的 `message.model` |

其中 `<hash(cwd)>` 是把工作目录里的 `/` 替换成 `-` 得到的目录名。

**Context 使用率** = 最近一次 assistant 消息的 `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` 除以模型最大 context 容量。

## 🚀 安装

### 方式一：Homebrew（推荐）

```bash
brew tap harries233/homebrew-context
brew install claude-context-monitor
```

安装脚本会自动检测 `code` 命令并执行 `code --install-extension`。

### 方式二：手动安装 VSIX

```bash
git clone https://github.com/harries233/claude-code-context-monitor.git
cd claude-code-context-monitor
npm install
npm run package       # 生成 claude-code-context-monitor-0.2.0.vsix
code --install-extension claude-code-context-monitor-0.2.0.vsix
```

## 🧪 本地开发

```bash
npm install
npm run compile     # 一次性编译到 dist/
npm run watch       # 监听模式（开发推荐）
npm test            # 运行单元 + 集成测试
```

调试：用 VS Code 打开本项目，按 `F5` 启动扩展开发宿主。

## ⚙️ 配置

在 VS Code 设置中搜索 `claudeContextMonitor`：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `maxContextTokens` | `200000` | 模型最大 context 容量。设为 `0` 按模型自动检测（未知模型回退 200000）。 |
| `refreshInterval` | `5` | 轮询间隔（秒）。 |
| `claudeDataDir` | `""` | Claude Code 数据目录，留空默认 `~/.claude`。 |
| `warningThresholds` | `{warning:70, critical:85, danger:95}` | 告警阈值（百分比）。 |
| `showHealthScore` | `true` | 是否展示 Context 健康评分。 |

> ⚠️ 如果你的 Claude Code 实际使用的模型 context 容量不是 200k（例如某些第三方网关封顶 128K），请把 `maxContextTokens` 设为该模型的实际容量，否则百分比会失真。

## 🏗️ 项目结构

```
claude-code-context-monitor/
├── package.json              # 插件清单、命令、视图、配置
├── tsconfig.json
├── media/                    # Dashboard 前端（icon/style/main.js）
├── Formula/                  # Homebrew formula
├── scripts/                  # 安装 / 发布脚本
├── test/                     # 单元 + 集成测试
└── src/
    ├── extension.ts          # 入口：激活、注册命令/视图
    ├── models/               # 纯数据模型（types/health/contextConfig/provider）
    ├── providers/            # Provider 接口 + CLI 实现 + 工厂
    │   ├── ClaudeContextProvider.ts
    │   ├── ClaudeCliProvider.ts
    │   └── index.ts
    ├── services/             # 核心逻辑（解析/轮询/健康评分/告警/建议/摘要）
    │   ├── sessionParser.ts
    │   ├── contextMonitor.ts
    │   ├── healthScore.ts
    │   ├── warningSystem.ts
    │   ├── suggestions.ts
    │   ├── summary.ts
    │   ├── currentSession.ts
    │   ├── config.ts
    │   └── format.ts
    ├── ui/                   # Status Bar / Session Tree
    ├── webview/              # Dashboard WebView 面板
    └── utils/                # pathUtil / env 探测
```

## 🧭 实现要点

- **Provider 架构**：`ContextMonitor` 只依赖 `ClaudeContextProvider` 接口，不绑定具体实现，新增 Provider 无需改动 UI 层。
- **增量解析**：对每个 JSONL 记录已消费的字节偏移，每次轮询只读取新增字节，避免重读大文件；文件被截断/轮转时自动重置。
- **单例面板**：Dashboard 复用同一个 WebView，避免重复创建。
- **事件驱动**：`ContextMonitor` 是唯一数据源，通过 `onUpdate` 事件广播快照给状态栏、侧边栏、面板。
- **主题适配**：Dashboard 使用 VS Code 主题变量（`--vscode-*`），自动适配浅色/深色主题。

## 🗺️ 后续规划

- Provider 2：Claude VS Code Extension；Provider 3：其他 AI Coding Agent。
- 结合 `/compact` 前后 token 变化的历史曲线。
- 跨工作区的全局 Session 聚合。
- 更精确的 token 估算（tiktoken 类分词）。

## 📄 许可证

[MIT](LICENSE)
