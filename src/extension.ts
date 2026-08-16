import * as vscode from 'vscode';
import { ClaudeContextProvider } from './providers/ClaudeContextProvider';
import { createProvider } from './providers';
import { getConfig } from './services/config';
import { ContextMonitor } from './services/contextMonitor';
import { generateSessionSummary } from './services/summary';
import { SessionTreeProvider } from './ui/sessionTree';
import { StatusBarController } from './ui/statusBar';
import { findClaudeBinary } from './utils/env';
import { getClaudeDataDir } from './utils/pathUtil';
import { DashboardPanel } from './webview/dashboardPanel';

/**
 * 扩展激活入口。
 *
 * 启动流程：探测环境 → 创建 Provider → 启动 ContextMonitor → 挂载 UI 层。
 * 通过 `onStartupFinished` 自动激活，无需用户手动触发。
 */
export function activate(context: vscode.ExtensionContext): void {
  const config = getConfig();
  const dataDir = getClaudeDataDir(config.claudeDataDir);

  const provider: ClaudeContextProvider = createProvider(dataDir);
  const detection = provider.detect();

  const monitor = new ContextMonitor(provider, detection);

  // UI 层
  const statusBar = new StatusBarController(monitor, detection);
  const treeProvider = new SessionTreeProvider(monitor);

  context.subscriptions.push(
    statusBar,
    monitor,
    vscode.window.registerTreeDataProvider('claudeContextMonitor.sessions', treeProvider)
  );

  // 命令
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'claudeContextMonitor.openDashboard',
      (sessionId?: string) => {
        // 侧边栏点击 Session 时带上 sessionId，让详情面板切换到对应会话
        DashboardPanel.createOrShow(context.extensionUri, monitor, sessionId);
      }
    ),
    vscode.commands.registerCommand('claudeContextMonitor.refresh', () => monitor.refresh()),
    vscode.commands.registerCommand('claudeContextMonitor.compactHint', async () => {
      await vscode.env.clipboard.writeText('/compact');
      void vscode.window.showInformationMessage('已复制 /compact 命令到剪贴板');
    }),
    vscode.commands.registerCommand('claudeContextMonitor.newSession', () => openNewSession()),
    vscode.commands.registerCommand('claudeContextMonitor.generateSummary', async () => {
      const snap = monitor.getSnapshot();
      if (!snap?.current) {
        void vscode.window.showWarningMessage('当前没有活动会话，无法生成摘要。');
        return;
      }
      const text = generateSessionSummary(snap.current, snap.health);
      await vscode.env.clipboard.writeText(text);
      void vscode.window.showInformationMessage('已生成 Session 摘要并复制到剪贴板');
    })
  );

  // 窗口获得焦点 / 切换终端时立即刷新，保证底部状态栏跟随当前正在使用的 Session，而不是等下一轮轮询
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((e) => {
      if (e.focused) {
        monitor.refresh();
      }
    }),
    vscode.window.onDidChangeActiveTerminal(() => monitor.refresh())
  );

  // 未检测到 Claude Code 时给出一次性提示
  if (!detection.available) {
    void vscode.window.showWarningMessage(`Claude Code not detected：${detection.reason}`);
  }

  monitor.start();
}

/** 打开一个新终端并运行 claude。 */
function openNewSession(): void {
  const claude = findClaudeBinary();
  const term = vscode.window.createTerminal({ name: 'Claude Code' });
  term.show();
  term.sendText(claude ?? 'claude');
  if (!claude) {
    void vscode.window.showInformationMessage(
      '未找到 claude 命令，已输入 `claude`，请确认 Claude Code 已安装。'
    );
  }
}

export function deactivate(): void {}
