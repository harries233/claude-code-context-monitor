# Claude Code Context Monitor

一个 VS Code 插件，实时监控 **Claude Code** 的上下文（Context）使用情况，帮助开发者管理 AI Coding Session。

> MVP 版本：实时读取本地 Claude Code 数据并可视化，不包含复杂 AI 分析。

## ✨ 功能

1. **Status Bar Context Monitor** — 底部状态栏显示 `Claude Context: XX%`，颜色随使用率变化，点击打开详情面板。
2. **Context Dashboard（WebView）** — 可视化展示：
   - Context 使用百分比（环形仪表盘）
   - 当前 token 数量 / 最大 context 容量
   - 输入 / 输出 token
   - Session 运行时长、消息数量
3. **Context Warning System** — 按使用率分级告警：
   - ≥ 70% 黄色提示
   - ≥ 85% 红色提示
   - ≥ 95% 强烈建议开启新 Session
4. **Session Manager（侧边栏）** — 列出当前工作区所有 Session：名称、创建时间、Context 使用率、运行状态。
5. **Context Optimization Suggestions** — 规则化建议（建议 /compact、新建 Session、找出占用 token 较多的大文件等）。

## 🔌 数据来源

插件直接读取 Claude Code 的本地数据目录（默认 `~/.claude`）：

| 数据 | 位置 |
| --- | --- |
| 运行中的 Session | `~/.claude/sessions/*.json` |
| 对话记录（含 token 用量） | `~/.claude/projects/<hash(cwd)>/<sessionId>.jsonl` |
| 会话标题 | JSONL 中的 `ai-title` 行 |
| 模型名 | assistant 消息的 `message.model` |

其中 `<hash(cwd)>` 是把工作目录里的 `/` 替换成 `-` 得到的目录名。

**Context 使用率** = 最近一次 assistant 消息的 `input_tokens + cache_creation_input_tokens + cache_read_input_tokens` 除以模型最大 context 容量。

## 🚀 运行 / 调试

### 1. 安装依赖

```bash
cd claude-code-context-monitor
npm install
```

### 2. 编译

```bash
npm run compile        # 一次性编译到 dist/
npm run watch          # 监听模式（开发时推荐）
```

### 3. 在 VS Code 中调试（F5）

1. 用 VS Code 打开本项目目录。
2. 按 `F5`（或「运行和调试」→「Run Extension」）。
3. 会启动一个新的「扩展开发宿主」（Extension Development Host）窗口，插件已在其中激活。
4. 在该宿主窗口底部状态栏即可看到 `Claude Context: XX%`；点击它，或在命令面板运行 `Claude Context Monitor: 打开 Dashboard` 查看详情面板。

> 调试配置见 `.vscode/launch.json`，它会先执行 `npm run watch`（`preLaunchTask`）保证 `dist/` 最新。

### 4. 打包成 .vsix

```bash
npm run package
```

然后在 VS Code 中：`Extensions` → `...` → `Install from VSIX...` 选择生成的 `*.vsix`。

## ⚙️ 配置

在 VS Code 设置中搜索 `claudeContextMonitor`：

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `maxContextTokens` | `200000` | 模型最大 context 容量。设为 `0` 按模型自动检测（未知模型回退 200000）。 |
| `refreshInterval` | `5` | 轮询间隔（秒）。 |
| `claudeDataDir` | `""` | Claude Code 数据目录，留空默认 `~/.claude`。 |
| `warningThresholds` | `{warning:70, critical:85, danger:95}` | 告警阈值（百分比）。 |

> ⚠️ 如果你的 Claude Code 实际使用的模型 context 容量不是 200k（例如某些第三方模型），请把 `maxContextTokens` 设为该模型的实际容量，否则百分比会失真。

## 📁 项目结构

```
claude-code-context-monitor/
├── package.json              # 插件清单、命令、视图、配置
├── tsconfig.json
├── .vscode/
│   ├── launch.json           # F5 调试配置
│   └── tasks.json            # npm watch 任务
├── media/
│   ├── icon.svg              # 活动栏图标
│   ├── style.css             # Dashboard 样式
│   └── main.js               # Dashboard 前端逻辑
└── src/
    ├── extension.ts          # 入口：激活、注册命令/视图
    ├── types.ts              # 共享类型
    ├── config.ts             # 配置读取、模型 context 容量表
    ├── format.ts             # 数字/时长格式化
    ├── pathUtil.ts           # 数据目录 / hash(cwd) 路径工具
    ├── sessionParser.ts      # JSONL 解析、增量聚合
    ├── dataProvider.ts       # 读取本地数据、增量更新
    ├── contextMonitor.ts     # 轮询调度、快照组装、当前 Session 判定
    ├── warningSystem.ts      # 告警等级判定
    ├── suggestions.ts        # 优化建议生成
    ├── statusBar.ts          # 底部状态栏
    ├── sessionTree.ts        # 侧边栏 Session 列表
    ├── dashboardPanel.ts     # WebView 面板
    └── html.ts               # WebView HTML 模板
```

## 🧭 实现要点

- **增量解析**：对每个 JSONL 记录已消费的字节偏移，每次轮询只读取新增字节，避免重读大文件；文件被截断/轮转时自动重置。
- **单例面板**：Dashboard 复用同一个 WebView，避免重复创建。
- **事件驱动**：`ContextMonitor` 是唯一数据源，通过 `onUpdate` 事件广播快照给状态栏、侧边栏、面板。
- **主题适配**：Dashboard 使用 VS Code 主题变量（`--vscode-*`），自动适配浅色/深色主题。

## 🗺️ 后续规划（非 MVP）

- 结合 `/compact` 前后 token 变化的历史曲线
- 跨工作区的全局 Session 聚合
- 更精确的 token 估算（tiktoken 类分词）
- 点击 Session 项跳转到对应工作区
