/**
 * 共享类型定义。
 */

/** 一个 Claude Code Session 的元信息。 */
export interface SessionMeta {
  sessionId: string;
  name: string;
  cwd: string;
  /** 毫秒时间戳（会话开始时间）。 */
  startedAt: number;
  pid?: number;
  /** 是否为当前正在运行的 Session（来自 ~/.claude/sessions/*.json）。 */
  active: boolean;
  /** 从对话记录中探测到的模型名，如 claude-sonnet-4。 */
  model?: string;
  /** 会话 JSONL 文件的最后修改时间（毫秒），用于排序。 */
  lastModifiedAt?: number;
}

/** 单次 API 调用产生的 token 用量。 */
export interface TokenUsage {
  inputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
  outputTokens: number;
}

/** 一个占用较多 token 的文件。 */
export interface LargeFile {
  path: string;
  estimatedTokens: number;
}

/** 聚合后的 Session 统计。 */
export interface SessionStats {
  meta: SessionMeta;
  /** 当前 context 占用（tokens）：最近一次 assistant 消息的 input + cache_creation + cache_read。 */
  contextTokens: number;
  /** 模型最大 context 容量（tokens）。 */
  maxContextTokens: number;
  /** context 使用百分比（0-100，封顶 100）。 */
  contextPercent: number;
  /** 累计输入 tokens。 */
  totalInputTokens: number;
  /** 累计输出 tokens。 */
  totalOutputTokens: number;
  /** user + assistant 消息总数。 */
  messageCount: number;
  /** 会话已运行时长（毫秒）。 */
  elapsedMs: number;
  /** 占用 token 较多的文件（按估算 token 降序）。 */
  largeFiles: LargeFile[];
  /** 最后一条记录的时间戳（毫秒）。 */
  lastActivityAt?: number;
}

export type WarningLevel = 'normal' | 'warning' | 'critical' | 'danger';

/** 一次轮询得到的完整快照，下发给 UI 各层。 */
export interface ContextSnapshot {
  /** 当前（活动）Session 的统计，若没有则为 null。 */
  current: SessionStats | null;
  /** 当前工作区下的所有 Session 统计。 */
  sessions: SessionStats[];
  warningLevel: WarningLevel;
  suggestionList: string[];
  /** 快照生成时间（毫秒）。 */
  updatedAt: number;
}
