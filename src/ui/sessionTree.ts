import * as vscode from 'vscode';
import { ContextSnapshot, SessionStats } from '../models/types';
import { ContextMonitor } from '../services/contextMonitor';
import { formatDuration, formatTime, formatTokens } from '../services/format';

/**
 * 树的展示指纹（不含 elapsedMs：运行时长每秒都在变，若计入会导致轮询时反复重建树、打断悬停提示）。
 * 指纹不变 → 该行无需刷新 → 原生悬停提示保持显示直到鼠标离开。
 */
function itemKey(st: SessionStats, isCurrent: boolean): string {
  return [
    st.meta.sessionId,
    st.meta.active ? 1 : 0,
    st.meta.name,
    st.meta.model ?? '',
    isCurrent ? 1 : 0,
    st.contextPercent,
    st.contextTokens,
    st.maxContextTokens,
    st.messageCount,
    st.fileReadCount,
    st.duplicateReadCount,
    st.totalInputTokens,
    st.totalOutputTokens,
    st.lastActivityAt ?? 0,
    JSON.stringify(st.largeFiles),
  ].join('|');
}

/** 排序：活跃会话在前，其次按创建时间倒序。 */
function sortStats(a: SessionStats, b: SessionStats): number {
  if (a.meta.active !== b.meta.active) {
    return a.meta.active ? -1 : 1;
  }
  return b.meta.startedAt - a.meta.startedAt;
}

/** 侧边栏里的一条 Session。实例在轮询间复用，保证行 DOM 稳定、悬停提示不被周期性刷新打断。 */
class SessionItem extends vscode.TreeItem {
  private key: string;

  constructor(
    public stats: SessionStats,
    public isCurrent: boolean
  ) {
    super(stats.meta.name || stats.meta.sessionId, vscode.TreeItemCollapsibleState.None);
    this.key = itemKey(stats, isCurrent);
    this.command = {
      command: 'claudeContextMonitor.openDashboard',
      title: '打开 Dashboard',
      arguments: [stats.meta.sessionId],
    };
    this.applyToView();
  }

  /** 就地更新展示数据；仅当可见内容变化时返回 true（供 Provider 决定是否刷新该行）。 */
  apply(stats: SessionStats, isCurrent: boolean): boolean {
    this.stats = stats;
    this.isCurrent = isCurrent;
    const next = itemKey(stats, isCurrent);
    if (next === this.key) {
      return false;
    }
    this.key = next;
    this.applyToView();
    return true;
  }

  private applyToView(): void {
    const st = this.stats;
    this.label = st.meta.name || st.meta.sessionId;
    this.description = `${st.contextPercent}% · ${formatTokens(st.contextTokens)} tok`;
    this.iconPath = new vscode.ThemeIcon(st.meta.active ? 'broadcast' : 'history');
    this.contextValue = 'session';

    const badge = this.isCurrent ? ' · ★ 当前' : '';
    const state = st.meta.active ? '● 运行中' : '○ 已结束';
    this.tooltip = [
      `${st.meta.name || st.meta.sessionId}${badge}`,
      state,
      `创建时间: ${formatTime(st.meta.startedAt)}`,
      `最近活动: ${st.lastActivityAt ? formatTime(st.lastActivityAt) : '—'}`,
      `Context:   ${st.contextPercent}% (${formatTokens(st.contextTokens)} / ${formatTokens(st.maxContextTokens)})`,
      `消息数:   ${st.messageCount}`,
      `运行时长: ${formatDuration(st.elapsedMs)}`,
    ].join('\n');
  }
}

/**
 * Session 列表 TreeDataProvider（侧边栏）。
 *
 * 轮询快照到来时做 diff：会话集合/顺序变化才全量重建；仅内容变化的行就地刷新；
 * 完全无变化时不触发刷新——避免每 5 秒重建整棵树、把正在查看的悬停提示几秒钟就关掉。
 */
export class SessionTreeProvider implements vscode.TreeDataProvider<SessionItem> {
  private items: SessionItem[] = [];
  private readonly byId = new Map<string, SessionItem>();
  private readonly emitter = new vscode.EventEmitter<SessionItem | undefined | null>();

  readonly onDidChangeTreeData = this.emitter.event;

  constructor(monitor: ContextMonitor) {
    monitor.onUpdate((s) => this.applySnapshot(s));
  }

  private applySnapshot(s: ContextSnapshot): void {
    const currentId = s.current?.meta.sessionId ?? undefined;
    const ordered = [...s.sessions].sort(sortStats);

    // 结构性变化：会话集合或顺序变化（新增/结束/重排）
    const structural =
      ordered.length !== this.items.length ||
      ordered.some((st, i) => st.meta.sessionId !== this.items[i].stats.meta.sessionId);

    // 清理已消失的会话
    const keep = new Set(ordered.map((st) => st.meta.sessionId));
    for (const id of [...this.byId.keys()]) {
      if (!keep.has(id)) {
        this.byId.delete(id);
      }
    }

    // 复用稳定实例；仅当可见内容变化时标记
    const changed: SessionItem[] = [];
    for (const st of ordered) {
      let item = this.byId.get(st.meta.sessionId);
      const isCurrent = st.meta.sessionId === currentId;
      if (item) {
        if (item.apply(st, isCurrent)) {
          changed.push(item);
        }
      } else {
        item = new SessionItem(st, isCurrent);
        this.byId.set(st.meta.sessionId, item);
      }
    }
    this.items = ordered.map((st) => this.byId.get(st.meta.sessionId)!);

    if (structural) {
      this.emitter.fire(undefined);
    } else if (changed.length > 0) {
      for (const item of changed) {
        this.emitter.fire(item);
      }
    }
    // 无变化：不触发刷新，悬停提示保持显示
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
