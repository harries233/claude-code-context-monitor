import * as os from 'os';
import * as vscode from 'vscode';
import { getConfig } from './config';
import { ClaudeDataProvider } from './dataProvider';
import { generateSuggestions } from './suggestions';
import { ContextSnapshot, SessionMeta, SessionStats } from './types';
import { evaluateWarningLevel } from './warningSystem';

/**
 * 轮询调度器：周期性读取 Claude Code 数据，组装快照并广播给 UI 各层。
 */
export class ContextMonitor {
  private timer: NodeJS.Timeout | undefined;
  private snapshot: ContextSnapshot | null = null;
  private readonly emitter = new vscode.EventEmitter<ContextSnapshot>();

  /** UI 层订阅该事件接收最新快照。 */
  readonly onUpdate = this.emitter.event;

  constructor(private readonly provider: ClaudeDataProvider) {}

  start(): void {
    this.refresh();
    const interval = Math.max(1, getConfig().refreshInterval);
    this.timer = setInterval(() => this.refresh(), interval * 1000);
  }

  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.emitter.dispose();
  }

  getSnapshot(): ContextSnapshot | null {
    return this.snapshot;
  }

  refresh(): void {
    try {
      this.snapshot = this.buildSnapshot();
      this.emitter.fire(this.snapshot);
    } catch (e) {
      console.error('[ClaudeContextMonitor] 刷新失败', e);
    }
  }

  private buildSnapshot(): ContextSnapshot {
    const config = getConfig();
    const now = Date.now();

    const active = this.provider.listActiveSessions();
    const cwd = this.resolveWorkspaceCwd(active);

    const sessions = this.provider.buildSessionStats(cwd, active, config.maxContextTokens, now);
    const current = this.resolveCurrentSession(sessions, active, cwd);

    const warningLevel = current
      ? evaluateWarningLevel(current.contextPercent, config.thresholds)
      : 'normal';
    const suggestionList = current ? generateSuggestions(current, config.thresholds) : [];

    return {
      current,
      sessions,
      warningLevel,
      suggestionList,
      updatedAt: now,
    };
  }

  /** 优先取 VS Code 打开的工作区目录，否则取活跃 Session 的 cwd，最后回退用户主目录。 */
  private resolveWorkspaceCwd(active: SessionMeta[]): string {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      return folders[0].uri.fsPath;
    }
    const act = active.find((a) => a.cwd);
    return act ? act.cwd : os.homedir();
  }

  /**
   * 确定「当前」Session：
   *   1. cwd 匹配工作区且 active 的最新 Session
   *   2. 最新的 active Session
   *   3. 列表中最后修改的 Session
   */
  private resolveCurrentSession(
    sessions: SessionStats[],
    active: SessionMeta[],
    cwd: string
  ): SessionStats | null {
    const activeMatching = active
      .filter((a) => a.cwd === cwd)
      .sort((a, b) => b.startedAt - a.startedAt);
    if (activeMatching.length > 0) {
      const found = sessions.find((s) => s.meta.sessionId === activeMatching[0].sessionId);
      if (found) {
        return found;
      }
    }

    const activeSorted = [...active].sort((a, b) => b.startedAt - a.startedAt);
    if (activeSorted.length > 0) {
      const found = sessions.find((s) => s.meta.sessionId === activeSorted[0].sessionId);
      if (found) {
        return found;
      }
    }

    if (sessions.length > 0) {
      return [...sessions].sort(
        (a, b) => (b.meta.lastModifiedAt || 0) - (a.meta.lastModifiedAt || 0)
      )[0];
    }
    return null;
  }
}
