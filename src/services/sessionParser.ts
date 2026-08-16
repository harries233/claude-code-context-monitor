import { LargeFile, SessionMeta, SessionStats } from '../models/types';

/**
 * 解析 Claude Code 的 JSONL 会话记录，并聚合成统计。
 *
 * JSONL 每行一个 JSON 对象，常见顶层 type：
 *   - "user"      用户消息
 *   - "assistant" 助手消息（含 message.usage / message.model）
 *   - "ai-title"  会话标题（aiTitle 字段）
 *   - 其余（thinking / text / attachment / queue-operation / ...）忽略
 */

/** 增量解析过程中的累积状态。 */
export interface SessionAccumulator {
  meta: SessionMeta;
  totalInputTokens: number;
  totalOutputTokens: number;
  latestContextTokens: number;
  latestInputTokens: number;
  messageCount: number;
  /** 本会话读取/打开文件的次数。 */
  fileReadCount: number;
  /** 重复读取同一文件的次数。 */
  duplicateReadCount: number;
  /** 已读取过的文件路径（去重）。 */
  readFilePaths: Set<string>;
  /** 文件路径 → 估算 tokens。 */
  largeFiles: Map<string, number>;
  /** tool_use id → 文件路径，用于把 tool_result 归因到具体文件。 */
  toolFileById: Map<string, string>;
  lastActivityAt: number;
}

export function createAccumulator(meta: SessionMeta): SessionAccumulator {
  return {
    meta,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    latestContextTokens: 0,
    latestInputTokens: 0,
    messageCount: 0,
    fileReadCount: 0,
    duplicateReadCount: 0,
    readFilePaths: new Set(),
    largeFiles: new Map(),
    toolFileById: new Map(),
    lastActivityAt: 0,
  };
}

/**
 * 解析一段「完整行」文本（保证每行都以换行结尾），逐行应用到累积器。
 */
export function parseCompleteLines(acc: SessionAccumulator, text: string): void {
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    let entry: unknown;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue; // 忽略无法解析的行
    }
    applyEntry(acc, entry as Record<string, unknown>);
  }
}

function applyEntry(acc: SessionAccumulator, entry: Record<string, unknown>): void {
  const type = entry.type as string | undefined;

  // 记录最后活动时间
  const ts = typeof entry.timestamp === 'string' ? Date.parse(entry.timestamp) : NaN;
  if (!Number.isNaN(ts) && ts > acc.lastActivityAt) {
    acc.lastActivityAt = ts;
  }

  // 会话标题
  if (type === 'ai-title' && typeof entry.aiTitle === 'string') {
    acc.meta.name = entry.aiTitle;
    return;
  }

  const message = entry.message as Record<string, unknown> | undefined;
  if (!message || typeof message !== 'object') {
    return;
  }

  // 模型名（仅首次）
  if (typeof message.model === 'string' && !acc.meta.model) {
    acc.meta.model = message.model;
  }

  // 消息计数：只统计顶层 user / assistant
  if (type === 'user' || type === 'assistant') {
    acc.messageCount++;
  }

  // token 用量（仅 assistant 消息携带 usage）
  const usage = message.usage as Record<string, unknown> | undefined;
  if (usage && typeof usage === 'object') {
    const input = num(usage.input_tokens);
    const cacheCreation = num(usage.cache_creation_input_tokens);
    const cacheRead = num(usage.cache_read_input_tokens);
    const output = num(usage.output_tokens);

    acc.totalInputTokens += input;
    acc.totalOutputTokens += output;
    acc.latestInputTokens = input;
    acc.latestContextTokens = input + cacheCreation + cacheRead;
  }

  // 扫描内容块，找出占用 token 较大的文件，并统计文件读取次数
  const content = message.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (!block || typeof block !== 'object') {
        continue;
      }
      const b = block as Record<string, unknown>;
      if (b.type === 'tool_use') {
        const name = String(b.name || '');
        const input = (b.input || {}) as Record<string, unknown>;
        const fp = input.file_path || input.path || input.uri;
        if (b.id && fp && /read|open|edit|write|view/i.test(name)) {
          acc.toolFileById.set(String(b.id), String(fp));
        }
        // 统计「读取/打开」类工具的文件读取次数与重复读取
        if (fp && /^(read|open|view)/i.test(name)) {
          acc.fileReadCount++;
          const key = String(fp);
          if (acc.readFilePaths.has(key)) {
            acc.duplicateReadCount++;
          } else {
            acc.readFilePaths.add(key);
          }
        }
      } else if (b.type === 'tool_result') {
        const est = estimateTokens(b.content);
        if (est > 0) {
          const id = b.tool_use_id ? String(b.tool_use_id) : undefined;
          const key = (id && acc.toolFileById.get(id)) || '(工具输出)';
          acc.largeFiles.set(key, (acc.largeFiles.get(key) || 0) + est);
        }
      }
    }
  }
}

/** 由累积器生成最终统计。 */
export function finalizeStats(
  acc: SessionAccumulator,
  maxContextTokens: number,
  now: number
): SessionStats {
  const contextTokens = acc.latestContextTokens || acc.latestInputTokens;
  const contextPercent =
    maxContextTokens > 0 ? Math.min(100, Math.round((contextTokens / maxContextTokens) * 100)) : 0;

  const largeFiles: LargeFile[] = Array.from(acc.largeFiles.entries())
    .map(([path, estimatedTokens]) => ({ path, estimatedTokens }))
    .sort((a, b) => b.estimatedTokens - a.estimatedTokens)
    .slice(0, 10);

  return {
    meta: acc.meta,
    contextTokens,
    maxContextTokens,
    contextPercent,
    totalInputTokens: acc.totalInputTokens,
    totalOutputTokens: acc.totalOutputTokens,
    messageCount: acc.messageCount,
    fileReadCount: acc.fileReadCount,
    duplicateReadCount: acc.duplicateReadCount,
    elapsedMs: Math.max(0, now - acc.meta.startedAt),
    largeFiles,
    lastActivityAt: acc.lastActivityAt,
  };
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 粗略估算一段内容占用的 token 数（字符数 / 4）。 */
function estimateTokens(content: unknown): number {
  if (content == null) {
    return 0;
  }
  if (typeof content === 'string') {
    return Math.round(content.length / 4);
  }
  try {
    return Math.round(JSON.stringify(content).length / 4);
  } catch {
    return 0;
  }
}
