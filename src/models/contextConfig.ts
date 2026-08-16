/**
 * 与模型 context 容量、告警阈值相关的纯配置（不依赖 vscode，可单元测试）。
 */

/** 告警阈值（百分比）。 */
export interface Thresholds {
  warning: number;
  critical: number;
  danger: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  warning: 70,
  critical: 85,
  danger: 95,
};

export const DEFAULT_MAX_CONTEXT_TOKENS = 200000;
export const DEFAULT_REFRESH_INTERVAL = 5;

/** 已知模型 → 最大 context 窗口（tokens）。 */
export const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // Anthropic Claude 系列（200K）
  'claude-opus-4': 200000,
  'claude-opus-4-1': 200000,
  'claude-opus-4-5': 200000,
  'claude-sonnet-4': 200000,
  'claude-sonnet-4-5': 200000,
  'claude-haiku-4-5': 200000,
  'claude-3-7-sonnet': 200000,
  'claude-3-5-sonnet': 200000,
  'claude-3-5-haiku': 200000,
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  // DeepSeek V4（官方 1M context；若网关/服务商封顶为 128K，请用 maxContextTokens 显式覆盖）
  'deepseek-v4-pro': 1000000,
  'deepseek-v4-flash': 1000000,
  'deepseek-v4': 1000000,
  // DeepSeek V3 / 旧版（128K）
  'deepseek-v3': 128000,
  'deepseek-v3.1': 128000,
  'deepseek-v3.2': 128000,
  'deepseek-chat': 128000,
  'deepseek-reasoner': 128000,
  'deepseek-r1': 128000,
};

/**
 * 解析模型的最大 context 容量：
 * - 用户显式配置 > 0 时优先；
 * - 否则按模型名查表；
 * - 未知模型回退默认 200000。
 */
export function resolveMaxContextTokens(model: string | undefined, configured: number): number {
  if (configured > 0) {
    return configured;
  }
  if (model && MODEL_CONTEXT_WINDOWS[model]) {
    return MODEL_CONTEXT_WINDOWS[model];
  }
  return DEFAULT_MAX_CONTEXT_TOKENS;
}
