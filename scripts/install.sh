#!/usr/bin/env bash
set -euo pipefail

# Claude Context Monitor — 安装脚本
# 职责：检查 code 命令 → 安装 VS Code 扩展。
# 用法：bash scripts/install.sh [path/to/claude-code-context-monitor-*.vsix]

VSIX="${1:-}"

# 1. 找 code 命令
CODE=""
if command -v code >/dev/null 2>&1; then
  CODE="$(command -v code)"
elif [[ -x "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" ]]; then
  CODE="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
elif [[ -x "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code" ]]; then
  CODE="/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code"
elif [[ -x "/Applications/VSCodium.app/Contents/Resources/app/bin/code" ]]; then
  CODE="/Applications/VSCodium.app/Contents/Resources/app/bin/code"
fi

if [[ -z "$CODE" ]]; then
  echo "错误：未找到 code 命令。" >&2
  echo "请先安装 Visual Studio Code，并在命令面板执行「Shell Command: Install 'code' command in PATH」。" >&2
  exit 1
fi
echo "找到 code: ${CODE}"

# 2. 解析 vsix 路径
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -z "$VSIX" ]]; then
  VSIX="$(ls -1 "$ROOT"/claude-code-context-monitor-*.vsix 2>/dev/null | head -n1 || true)"
fi
if [[ -z "$VSIX" || ! -f "$VSIX" ]]; then
  echo "错误：未指定或找不到 .vsix 文件。用法: bash scripts/install.sh <path/to.vsix>" >&2
  exit 1
fi

# 3. 安装
echo "安装扩展: ${VSIX}"
"$CODE" --install-extension "$VSIX" --force

echo ""
echo "完成。重新加载 VS Code 窗口后，Claude Context Monitor 将自动运行。"
