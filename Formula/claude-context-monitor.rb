# Homebrew formula for claude-code-context-monitor（VS Code 扩展）
#
# 这是给 Homebrew tap 用的 formula。典型安装方式：
#   1. 把这个文件放进 tap 仓库（harries233/homebrew-context 的 Formula/ 目录）
#   2. 用户在终端执行：
#        brew tap harries233/homebrew-context
#        brew install claude-context-monitor
#
# 更新：跑 `bash scripts/release.sh <version>`，会自动重算 sha256 并替换下方字段。
class ClaudeContextMonitor < Formula
  desc "VS Code extension to monitor Claude Code context usage"
  homepage "https://github.com/harries233/claude-code-context-monitor"
  url "https://github.com/harries233/claude-code-context-monitor/releases/download/v0.2.1/claude-code-context-monitor-0.2.1.vsix"
  sha256 "594512dd2dadc15d3d23ac54ce6f915ecbe4cae2b785d4222c16c2b3bd49a26d" # 由 scripts/release.sh 自动填充
  license "MIT"
  version "0.2.1"

  # 依赖 VS Code 的 code 命令，但不强制 Homebrew 安装 VS Code（它本身是 cask）。
  # 未找到 code 时只保存 vsix 副本并提示手动安装。

  def code_cli
    return @code_cli if defined?(@code_cli)
    @code_cli = [
      "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
      "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code",
      "/Applications/VSCodium.app/Contents/Resources/app/bin/code",
    ].find { |p| File.executable?(p) }
    @code_cli ||= which("code")
  end

  def install
    vsix = cached_download
    # 保存副本到 prefix，便于 code 安装失败时手动安装
    cp vsix, prefix/"claude-code-context-monitor.vsix"

    if (cli = code_cli)
      system cli, "--install-extension", vsix.to_s, "--force"
    else
      opoo "未找到 code 命令，已保存扩展到 #{prefix}/claude-code-context-monitor.vsix。"
      opoo "手动安装：code --install-extension #{prefix}/claude-code-context-monitor.vsix"
    end
  end

  test do
    assert_predicate prefix/"claude-code-context-monitor.vsix", :exist?
  end
end
