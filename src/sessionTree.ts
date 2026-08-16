import * as vscode from 'vscode';
import { ContextMonitor } from './contextMonitor';
import { formatDuration, formatTime, formatTokens } from './format';
import { ContextSnapshot, SessionStats } from './types';

/** 侧边栏里的一条 Session。 */
class SessionItem extends vscode.TreeItem {
  constructor(
    public readonly stats: SessionStats,
    public readonly isCurrent: boolean
  ) {
    super(stats.meta.name || stats.meta.sessionId, vscode.TreeItemCollapsibleState.None);
    this.description = `${stats.contextPercent}% · ${formatTokens(stats.contextTokens)} tok`;
    this.iconPath = new vscode.ThemeIcon(stats.meta.active ? 'broadcast' : 'history');
    this.contextValue = 'session';
    this.command = {
      command: 'claudeContextMonitor.openDashboard',
      title: '打开 Dashboard',
    };

    const state = stats.meta.active ? '● 运行中' : '○ 已结束';
    const badge = isCurrent ? ' · ★ 当前' : '';
    this.tooltip = [
      `${stats.meta.name || stats.meta.sessionId}${badge}`,
      state,
      `创建时间: ${formatTime(stats.meta.startedAt)}`,
      `Context:   ${stats.contextPercent}% (${formatTokens(stats.contextTokens)} / ${formatTokens(stats.maxContextTokens)})`,
      `消息数:   ${stats.messageCount}`,
      `运行时长: ${formatDuration(stats.elapsedMs)}`,
    ].join('\n');
  }
}

/**
 * Session 列表 TreeDataProvider（侧边栏）。
 */
export class SessionTreeProvider implements vscode.TreeDataProvider<SessionItem> {
  private items: SessionItem[] = [];
  private readonly emitter = new vscode.EventEmitter<SessionItem | undefined>();

  readonly onDidChangeTreeData = this.emitter.event;

  constructor(private readonly monitor: ContextMonitor) {
    this.monitor.onUpdate((s) => this.applySnapshot(s));
  }

  private applySnapshot(s: ContextSnapshot): void {
    const currentId = s.current?.meta.sessionId;
    this.items = s.sessions
      .map((st) => new SessionItem(st, st.meta.sessionId === currentId))
      .sort((a, b) => {
        if (a.stats.meta.active !== b.stats.meta.active) {
          return a.stats.meta.active ? -1 : 1;
        }
        return b.stats.meta.startedAt - a.stats.meta.startedAt;
      });
    this.emitter.fire(undefined);
  }

  getTreeItem(element: SessionItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: SessionItem): vscode.ProviderResult<SessionItem[]> {
    if (element) {
      return [];
    }
    return this.items;
  }
}
