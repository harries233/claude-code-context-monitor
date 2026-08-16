import {
  ContextUsage,
  ProviderDetection,
  SessionInfo,
  TokenUsageSummary,
} from '../models/provider';
import { SessionMeta, SessionStats } from '../models/types';

/**
 * Claude Code 上下文数据 Provider 接口。
 *
 * 当前实现：
 *   - ClaudeCliProvider（读取 ~/.claude 本地数据）
 * 未来可扩展：
 *   - Claude VS Code Extension Provider
 *   - 其他 AI Coding Agent Provider（Copilot / Cursor / …）
 *
 * 新增 Provider 只需实现本接口并在 providers/index.ts 注册即可，UI 层无需改动。
 */
export interface ClaudeContextProvider {
  /** 唯一标识。 */
  readonly id: string;
  /** 展示名。 */
  readonly name: string;

  /** 探测环境是否可用（Claude Code 是否安装、数据目录是否存在）。 */
  detect(): ProviderDetection;

  /** 列出当前活跃（运行中）的 Session。 */
  listActiveSessions(): SessionMeta[];

  /** 构建某个工作区目录下所有 Session 的统计。 */
  buildSessionStats(
    cwd: string,
    activeSessions: SessionMeta[],
    configuredMax: number,
    now: number
  ): SessionStats[];

  /** 获取当前工作区当前会话的上下文用量。 */
  getContextUsage(cwd?: string): ContextUsage | null;

  /** 获取当前工作区当前会话的信息。 */
  getSessionInfo(cwd?: string): SessionInfo | null;

  /** 获取当前工作区当前会话的 token 用量汇总。 */
  getTokenUsage(cwd?: string): TokenUsageSummary | null;
}
