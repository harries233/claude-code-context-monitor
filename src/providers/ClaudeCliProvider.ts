import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveMaxContextTokens } from '../models/contextConfig';
import {
  ContextUsage,
  ProviderDetection,
  SessionInfo,
  TokenUsageSummary,
} from '../models/provider';
import { SessionMeta, SessionStats } from '../models/types';
import { resolveCurrentSession } from '../services/currentSession';
import {
  SessionAccumulator,
  createAccumulator,
  finalizeStats,
  parseCompleteLines,
} from '../services/sessionParser';
import { findClaudeBinary, isDirectory } from '../utils/env';
import { getProjectDir, getSessionsDir } from '../utils/pathUtil';
import { ClaudeContextProvider } from './ClaudeContextProvider';

/** 单个 JSONL 文件的增量解析状态。 */
interface FileState {
  acc: SessionAccumulator;
  /** 已从文件消费到的字节偏移。 */
  offset: number;
  /** 上次读取残留的「不完整行」缓冲。 */
  pending: string;
  /** 上次记录的文件大小，用于检测文件被截断/轮转。 */
  size: number;
}

/**
 * Claude Code CLI Provider：读取本地数据目录（默认 ~/.claude），
 * 自动发现环境、增量解析 JSONL 会话记录。
 */
export class ClaudeCliProvider implements ClaudeContextProvider {
  readonly id = 'claude-cli';
  readonly name = 'Claude Code CLI';

  private readonly fileStates = new Map<string, FileState>();

  constructor(private readonly dataDir: string = path.join(os.homedir(), '.claude')) {}

  /** 探测环境：数据目录是否存在、是否有活跃会话、是否找到 claude 命令。 */
  detect(): ProviderDetection {
    const claudeBinary = findClaudeBinary();
    if (!isDirectory(this.dataDir)) {
      return {
        available: false,
        reason: `未找到 Claude 数据目录：${this.dataDir}（可检查 claudeContextMonitor.claudeDataDir 配置）`,
        claudeBinary,
        activeSessionCount: 0,
      };
    }

    const active = this.listActiveSessions();
    return {
      available: true,
      reason:
        active.length > 0
          ? `检测到 ${active.length} 个活跃会话`
          : '检测到 Claude 数据目录（暂无活跃会话）',
      claudeDataDir: this.dataDir,
      claudeBinary,
      activeSessionCount: active.length,
    };
  }

  /** 读取当前正在运行的 Session（~/.claude/sessions/*.json）。 */
  listActiveSessions(): SessionMeta[] {
    const dir = getSessionsDir(this.dataDir);
    const result: SessionMeta[] = [];
    let files: string[] = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
    } catch {
      return result;
    }
    for (const f of files) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        if (!raw.sessionId) {
          continue;
        }
        result.push({
          sessionId: raw.sessionId,
          name: raw.name || raw.sessionId,
          cwd: raw.cwd || '',
          startedAt: raw.startedAt || 0,
          pid: raw.pid,
          active: true,
        });
      } catch {
        // 忽略损坏的 session 元数据文件
      }
    }
    return result;
  }

  /** 构建某个工作区目录下所有 Session 的统计。 */
  buildSessionStats(
    cwd: string,
    activeSessions: SessionMeta[],
    configuredMax: number,
    now: number
  ): SessionStats[] {
    const dir = getProjectDir(this.dataDir, cwd);
    let files: string[] = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'));
    } catch {
      return [];
    }

    const activeById = new Map(activeSessions.map((a) => [a.sessionId, a]));
    const result: SessionStats[] = [];

    for (const f of files) {
      const file = path.join(dir, f);
      const sessionId = f.replace(/\.jsonl$/, '');
      const activeMeta = activeById.get(sessionId);

      let meta: SessionMeta;
      if (activeMeta) {
        meta = { ...activeMeta, lastModifiedAt: this.fileMtime(file) };
      } else {
        meta = {
          sessionId,
          name: sessionId.slice(0, 8),
          cwd,
          startedAt: this.fileBirthtime(file),
          active: false,
          lastModifiedAt: this.fileMtime(file),
        };
      }

      try {
        const acc = this.updateFile(file, meta);
        const max = resolveMaxContextTokens(acc.meta.model, configuredMax);
        result.push(finalizeStats(acc, max, now));
      } catch (e) {
        console.error(`[ClaudeContextMonitor] 解析失败: ${file}`, e);
      }
    }

    return result;
  }

  /** 获取当前工作区当前会话的上下文用量。 */
  getContextUsage(cwd?: string): ContextUsage | null {
    const cur = this.currentStats(cwd);
    if (!cur) {
      return null;
    }
    return {
      contextTokens: cur.contextTokens,
      maxContextTokens: cur.maxContextTokens,
      contextPercent: cur.contextPercent,
    };
  }

  /** 获取当前工作区当前会话的信息。 */
  getSessionInfo(cwd?: string): SessionInfo | null {
    const cur = this.currentStats(cwd);
    if (!cur) {
      return null;
    }
    return {
      sessionId: cur.meta.sessionId,
      name: cur.meta.name,
      cwd: cur.meta.cwd,
      startedAt: cur.meta.startedAt,
      durationMs: cur.elapsedMs,
      messageCount: cur.messageCount,
      model: cur.meta.model,
      active: cur.meta.active,
    };
  }

  /** 获取当前工作区当前会话的 token 用量汇总。 */
  getTokenUsage(cwd?: string): TokenUsageSummary | null {
    const cur = this.currentStats(cwd);
    if (!cur) {
      return null;
    }
    return {
      latestInputTokens: cur.contextTokens,
      latestOutputTokens: cur.totalOutputTokens,
      totalInputTokens: cur.totalInputTokens,
      totalOutputTokens: cur.totalOutputTokens,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    };
  }

  /** 计算当前会话统计（复用增量解析，非热路径）。 */
  private currentStats(cwd?: string): SessionStats | null {
    const target = cwd ?? os.homedir();
    const active = this.listActiveSessions();
    const sessions = this.buildSessionStats(target, active, 0, Date.now());
    return resolveCurrentSession(sessions, active, target);
  }

  /**
   * 增量更新一个 JSONL 文件，返回累积器。
   * 若文件被截断（大小小于上次记录），则重置并全量重读。
   */
  private updateFile(file: string, meta: SessionMeta): SessionAccumulator {
    let state = this.fileStates.get(file);
    if (!state) {
      state = { acc: createAccumulator(meta), offset: 0, pending: '', size: 0 };
      this.fileStates.set(file, state);
    }

    let size = 0;
    try {
      size = fs.statSync(file).size;
    } catch {
      // 文件暂时不存在，返回当前状态
      return state.acc;
    }

    // 文件被截断/轮转 → 重置累积器
    if (size < state.size) {
      state.acc = createAccumulator(meta);
      state.offset = 0;
      state.pending = '';
    }
    state.size = size;

    if (size > state.offset) {
      const content = this.readFrom(file, state.offset, size);
      const merged = state.pending + content;
      const lastNewline = merged.lastIndexOf('\n');
      if (lastNewline >= 0) {
        parseCompleteLines(state.acc, merged.slice(0, lastNewline + 1));
        state.pending = merged.slice(lastNewline + 1);
      } else {
        // 仍无完整行，继续缓冲
        state.pending = merged;
      }
      state.offset = size;
    }

    return state.acc;
  }

  private readFrom(file: string, offset: number, size: number): string {
    const fd = fs.openSync(file, 'r');
    try {
      const length = size - offset;
      if (length <= 0) {
        return '';
      }
      const buf = Buffer.alloc(length);
      fs.readSync(fd, buf, 0, length, offset);
      return buf.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  }

  private fileMtime(file: string): number {
    try {
      return fs.statSync(file).mtimeMs;
    } catch {
      return 0;
    }
  }

  private fileBirthtime(file: string): number {
    try {
      return fs.statSync(file).birthtimeMs;
    } catch {
      return 0;
    }
  }
}
