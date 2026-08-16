import * as vscode from 'vscode';

export interface Thresholds {
  warning: number;
  critical: number;
  danger: number;
}

export interface MonitorConfig {
  /** 0 表示按模型自动检测。 */
  maxContextTokens: number;
  refreshInterval: number;
  claudeDataDir: string;
  thresholds: Thresholds;
}

/** 已知模型 → 最大 context 窗口（tokens）。 */
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
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

export const DEFAULT_MAX_CONTEXT_TOKENS = 200000;
export const DEFAULT_REFRESH_INTERVAL = 5;

export function getConfig(): MonitorConfig {
  const cfg = vscode.workspace.getConfiguration('claudeContextMonitor');
  const raw = cfg.get<{ warning?: number; critical?: number; danger?: number }>(
    'warningThresholds',
    {}
  );
  return {
    maxContextTokens: cfg.get<number>('maxContextTokens', DEFAULT_MAX_CONTEXT_TOKENS),
    refreshInterval: cfg.get<number>('refreshInterval', DEFAULT_REFRESH_INTERVAL),
    claudeDataDir: cfg.get<string>('claudeDataDir', ''),
    thresholds: {
      warning: raw.warning ?? 70,
      critical: raw.critical ?? 85,
      danger: raw.danger ?? 95,
    },
  };
}

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
