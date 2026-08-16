/**
 * Provider 相关的数据形状（与具体实现解耦，便于未来扩展多 Provider）。
 */

/** Provider 环境探测结果。 */
export interface ProviderDetection {
  available: boolean;
  /** 不可用时的原因描述，或可用时的简短说明。 */
  reason: string;
  /** 探测到的 Claude 数据目录。 */
  claudeDataDir?: string;
  /** 探测到的 claude 可执行文件（可能为空）。 */
  claudeBinary?: string;
  /** 当前活跃会话数量。 */
  activeSessionCount?: number;
}

/** 当前会话的上下文用量。 */
export interface ContextUsage {
  contextTokens: number;
  maxContextTokens: number;
  contextPercent: number;
}

/** 当前会话的信息。 */
export interface SessionInfo {
  sessionId: string;
  name: string;
  cwd: string;
  startedAt: number;
  durationMs: number;
  messageCount: number;
  model?: string;
  active: boolean;
}

/** 当前会话的 token 用量汇总。 */
export interface TokenUsageSummary {
  /** 最近一次输入的 input tokens。 */
  latestInputTokens: number;
  /** 最近一次输出 tokens。 */
  latestOutputTokens: number;
  /** 累计输入 tokens。 */
  totalInputTokens: number;
  /** 累计输出 tokens。 */
  totalOutputTokens: number;
  /** 最近一次的缓存写入/读取 tokens。 */
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}
