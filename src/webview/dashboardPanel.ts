import * as vscode from 'vscode';
import { ContextMonitor } from '../services/contextMonitor';
import { generateSessionSummary } from '../services/summary';
import { getConfig } from '../services/config';
import { computeHealthScore } from '../services/healthScore';
import { generateSuggestions } from '../services/suggestions';
import { evaluateWarningLevel } from '../services/warningSystem';
import { ContextSnapshot } from '../models/types';
import { getDashboardHtml } from './html';

/** 下发给 WebView 的数据：在原快照基础上补充「查看历史会话」的选中状态。 */
interface DashboardViewData extends ContextSnapshot {
  /** 真实当前会话 id（未被选中的历史会话替换，用于标记列表里的 ★ 当前）。 */
  realCurrentId?: string;
  /** 当前选中的会话 id（查看历史会话时存在，否则 undefined）。 */
  selectedSessionId?: string;
}

/**
 * 详情面板（WebView）。单例，重复调用复用已有面板。
 * 支持「查看某个历史会话」：选中后详情区渲染该会话数据，而不是永远跟随当前会话。
 */
export class DashboardPanel {
  public static current: DashboardPanel | undefined;

  public static createOrShow(
    extensionUri: vscode.Uri,
    monitor: ContextMonitor,
    sessionId?: string
  ): void {
    const column = vscode.window.activeTextEditor ? vscode.ViewColumn.Beside : vscode.ViewColumn.One;
    if (DashboardPanel.current) {
      DashboardPanel.current.setSelectedSession(sessionId);
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
    DashboardPanel.current = new DashboardPanel(panel, extensionUri, monitor, sessionId);
  }

  private readonly panel: vscode.WebviewPanel;
  private readonly monitor: ContextMonitor;
  private readonly disposables: vscode.Disposable[] = [];
  private selectedSessionId: string | undefined;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    monitor: ContextMonitor,
    sessionId?: string
  ) {
    this.panel = panel;
    this.monitor = monitor;
    this.selectedSessionId = sessionId;
    panel.webview.html = getDashboardHtml(panel.webview, extensionUri);

    const sendUpdate = (s: ContextSnapshot) => this.post('update', this.toViewData(s));
    this.disposables.push(monitor.onUpdate(sendUpdate));
    this.disposables.push(panel.webview.onDidReceiveMessage((m) => this.onMessage(m)));

    this.disposables.push(panel.onDidDispose(() => this.dispose()));
  }

  private onMessage(msg: { type?: string; text?: string; sessionId?: string }): void {
    switch (msg?.type) {
      case 'ready': {
        // webview 首次加载完成后请求一次快照，避免初始推送丢失
        const snap = this.monitor.getSnapshot();
        if (snap) {
          this.post('update', this.toViewData(snap));
        }
        break;
      }
      case 'selectSession': {
        this.setSelectedSession(msg.sessionId);
        break;
      }
      case 'backToCurrent': {
        this.setSelectedSession(undefined);
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
        if (!snap) {
          this.post('summary', { text: '暂无数据。' });
          break;
        }
        // 选中历史会话时，摘要针对选中的会话生成
        const view = this.toViewData(snap);
        const text = view.current
          ? generateSessionSummary(view.current, view.health)
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

  /** 切换「查看历史会话」目标；选中当前会话等价于返回当前。 */
  private setSelectedSession(sessionId?: string): void {
    const realCurrentId = this.monitor.getSnapshot()?.current?.meta.sessionId;
    this.selectedSessionId = sessionId && sessionId !== realCurrentId ? sessionId : undefined;
    const snap = this.monitor.getSnapshot();
    if (snap) {
      this.post('update', this.toViewData(snap));
    }
  }

  /** 组装下发给 WebView 的数据：选中历史会话时，将 current 替换为它并重算告警/建议/健康分。 */
  private toViewData(snap: ContextSnapshot): DashboardViewData {
    const realCurrentId = snap.current?.meta.sessionId;
    // 选中的会话已变成当前会话 → 视为返回当前
    if (this.selectedSessionId && this.selectedSessionId === realCurrentId) {
      this.selectedSessionId = undefined;
    }
    const selected = this.selectedSessionId
      ? snap.sessions.find((s) => s.meta.sessionId === this.selectedSessionId)
      : undefined;
    if (!selected) {
      this.selectedSessionId = undefined;
      return { ...snap, realCurrentId, selectedSessionId: undefined };
    }
    const thresholds = getConfig().thresholds;
    return {
      ...snap,
      current: selected,
      warningLevel: evaluateWarningLevel(selected.contextPercent, thresholds),
      suggestionList: generateSuggestions(selected, thresholds),
      health: computeHealthScore(selected, thresholds),
      realCurrentId,
      selectedSessionId: this.selectedSessionId,
    };
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
