# Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循 [SemVer](https://semver.org/lang/zh-CN/)。

## [0.2.0] - 2026-08-16

### 新增
- **Provider 架构**：引入 `ClaudeContextProvider` 接口 + `ClaudeCliProvider` 实现 + 工厂，数据读取逻辑与 UI 解耦，为未来扩展 Claude VS Code Extension / 其他 AI Coding Agent 预留。
- **环境自动发现**：启动时检测 Claude Code 是否安装、当前工作区、当前 Session；未检测到则显示 `Claude Code not detected`。
- **Context 健康评分系统**：A/B/C/D 四级评分，综合 Context 百分比、消息数量、文件读取数量、大文件数量、重复内容五个维度。
- **Token 消耗分析**：`Largest Context Consumers` 展示占用 token 最多的文件，并给出加入 ignore 规则的建议。
- **智能提醒操作**：Dashboard 新增 `Generate Summary`、`Open New Session`、`复制 /compact` 按钮。
- **Session 摘要**：一键生成当前会话的文本摘要并复制到剪贴板。
- **单元 / 集成测试**：基于 Node 内置 `node:test`，覆盖格式化、阈值、健康评分、路径工具、JSONL 解析与 Provider 集成。

### 变更
- 项目结构重组为 `models / providers / services / webview / ui / utils` 分层。
- 新增 `fileReadCount` / `duplicateReadCount` 统计字段，用于健康评分与重复内容检测。
- 配置项新增 `claudeContextMonitor.showHealthScore`。
- 新增命令 `claudeContextMonitor.newSession` 与 `claudeContextMonitor.generateSummary`。

### 交付
- Homebrew Formula（`Formula/claude-context-monitor.rb`）。
- 安装脚本 `scripts/install.sh`、发布脚本 `scripts/release.sh`。

## [0.1.0] - 2026-08-16

### 新增
- 首个 MVP：实时读取 `~/.claude` 数据并可视化。
- Status Bar Context Monitor、Context Dashboard（WebView）、告警分级、Session 列表、优化建议。
