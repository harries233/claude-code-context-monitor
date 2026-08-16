import * as vscode from 'vscode';
import { ContextMonitor } from '../services/contextMonitor';
import { generateSessionSummary } from '../services/summary';
import { ContextSnapshot } from '../models/types';
import { getDashboardHtml } from './html';

/**
 * 详情面板（WebView）。单例，重复调用复用已有面板。
 */
export class DashboardPanel {
  public static current: DashboardPanel | undefined;

  public static createOrShow(extensionUri: vscode.Uri, monitor: ContextMonitor): void {
    const column = vscode.window.activeTextEditor ? vscode.ViewColumn.Beside : vscode.ViewColumn.One;
    if (DashboardPanel.current) {
      DashboardPanel.current.panel.reveal(column);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'claudeContextMonitor.dashboard',
      'Claude Context Monitor',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')],
      }
    );
    DashboardPanel.current = new DashboardPanel(panel, extensionUri, monitor);
  }

  private readonly panel: vscode.WebviewPanel;
  private readonly monitor: ContextMonitor;
  private readonly disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    monitor: ContextMonitor
  ) {
    this.panel = panel;
    this.monitor = monitor;
    panel.webview.html = getDashboardHtml(panel.webview, extensionUri);

    const sendUpdate = (s: ContextSnapshot) => this.post('update', s);
    this.disposables.push(monitor.onUpdate(sendUpdate));
    this.disposables.push(panel.webview.onDidReceiveMessage((m) => this.onMessage(m)));

    this.disposables.push(panel.onDidDispose(() => this.dispose()));
  }

  private onMessage(msg: { type?: string; text?: string }): void {
    switch (msg?.type) {
      case 'ready': {
        // webview 首次加载完成后请求一次快照，避免初始推送丢失
        const snap = this.monitor.getSnapshot();
        if (snap) {
          this.post('update', snap);
        }
        break;
      }
      case 'refresh':
        void vscode.commands.executeCommand('claudeContextMonitor.refresh');
        break;
      case 'copyCompact':
        void vscode.env.clipboard.writeText('/compact').then(() => {
          void vscode.window.showInformationMessage('已复制 /compact 命令到剪贴板');
        });
        break;
      case 'generateSummary': {
        const snap = this.monitor.getSnapshot();
        const text = snap?.current
          ? generateSessionSummary(snap.current, snap.health)
          : '当前没有活动会话，无法生成摘要。';
        this.post('summary', { text });
        break;
      }
      case 'copySummary':
        void vscode.env.clipboard.writeText(msg.text ?? '').then(() => {
          void vscode.window.showInformationMessage('已复制摘要到剪贴板');
        });
        break;
      case 'openNewSession':
        void vscode.commands.executeCommand('claudeContextMonitor.newSession');
        break;
      default:
        break;
    }
  }

  private post(type: string, data?: unknown): void {
    void this.panel.webview.postMessage({ type, data });
  }

  private dispose(): void {
    DashboardPanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()!.dispose();
    }
  }
}
