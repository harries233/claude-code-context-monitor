import * as fs from 'fs';
import * as path from 'path';
import { resolveMaxContextTokens } from './config';
import { getProjectDir, getSessionsDir } from './pathUtil';
import {
  SessionAccumulator,
  createAccumulator,
  finalizeStats,
  parseCompleteLines,
} from './sessionParser';
import { SessionMeta, SessionStats } from './types';

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
 * 读取并解析 Claude Code 本地数据（~/.claude）。
 * 对每个 JSONL 做增量解析：只读取新增字节，避免每次轮询全量重读大文件。
 */
export class ClaudeDataProvider {
  private readonly fileStates = new Map<string, FileState>();

  constructor(private readonly dataDir: string) {}

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
