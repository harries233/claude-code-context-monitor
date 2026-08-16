import * as os from 'os';
import * as vscode from 'vscode';
import { ProviderDetection } from '../models/provider';
import { ContextSnapshot, SessionMeta } from '../models/types';
import { ClaudeContextProvider } from '../providers/ClaudeContextProvider';
import { getConfig } from './config';
import { resolveCurrentSession } from './currentSession';
import { computeHealthScore } from './healthScore';
import { generateSuggestions } from './suggestions';
import { evaluateWarningLevel } from './warningSystem';

/**
 * 轮询调度器：周期性读取 Claude Code 数据，组装快照并广播给 UI 各层。
 *
 * 只依赖 ClaudeContextProvider 接口，不绑定具体实现，便于未来切换 Provider。
 */
export class ContextMonitor {
  private timer: NodeJS.Timeout | undefined;
  private snapshot: ContextSnapshot | null = null;
  private readonly emitter = new vscode.EventEmitter<ContextSnapshot>();
  private readonly detection: ProviderDetection | null;

  /** UI 层订阅该事件接收最新快照。 */
  readonly onUpdate = this.emitter.event;

  constructor(
    private readonly provider: ClaudeContextProvider,
    detection?: ProviderDetection | null
  ) {
    this.detection = detection ?? null;
  }

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
    const current = resolveCurrentSession(sessions, active, cwd);

    const warningLevel = current
      ? evaluateWarningLevel(current.contextPercent, config.thresholds)
      : 'normal';
    const suggestionList = current ? generateSuggestions(current, config.thresholds) : [];
    const health = current ? computeHealthScore(current, config.thresholds) : null;

    return {
      current,
      sessions,
      warningLevel,
      suggestionList,
      health,
      detection: this.detection,
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
}
