import * as vscode from 'vscode';
import { getConfig } from './config';
import { ContextMonitor } from './contextMonitor';
import { ClaudeDataProvider } from './dataProvider';
import { DashboardPanel } from './dashboardPanel';
import { getClaudeDataDir } from './pathUtil';
import { SessionTreeProvider } from './sessionTree';
import { StatusBarController } from './statusBar';

export function activate(context: vscode.ExtensionContext): void {
  const config = getConfig();
  const dataDir = getClaudeDataDir(config.claudeDataDir);

  const provider = new ClaudeDataProvider(dataDir);
  const monitor = new ContextMonitor(provider);

  // UI 层
  const statusBar = new StatusBarController(monitor);
  const treeProvider = new SessionTreeProvider(monitor);

  context.subscriptions.push(statusBar);
  context.subscriptions.push(monitor);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('claudeContextMonitor.sessions', treeProvider)
  );

  // 命令
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeContextMonitor.openDashboard', () => {
      DashboardPanel.createOrShow(context.extensionUri, monitor);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeContextMonitor.refresh', () => monitor.refresh())
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeContextMonitor.compactHint', async () => {
      await vscode.env.clipboard.writeText('/compact');
      void vscode.window.showInformationMessage('已复制 /compact 命令到剪贴板');
    })
  );

  monitor.start();
}

export function deactivate(): void {}
