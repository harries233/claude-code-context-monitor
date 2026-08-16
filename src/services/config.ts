import * as vscode from 'vscode';
import {
  DEFAULT_MAX_CONTEXT_TOKENS,
  DEFAULT_REFRESH_INTERVAL,
  DEFAULT_THRESHOLDS,
  Thresholds,
} from '../models/contextConfig';

export interface MonitorConfig {
  /** 0 表示按模型自动检测。 */
  maxContextTokens: number;
  refreshInterval: number;
  claudeDataDir: string;
  thresholds: Thresholds;
}

/** 从 VS Code 配置读取扩展设置（带默认值兜底）。 */
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
      warning: raw.warning ?? DEFAULT_THRESHOLDS.warning,
      critical: raw.critical ?? DEFAULT_THRESHOLDS.critical,
      danger: raw.danger ?? DEFAULT_THRESHOLDS.danger,
    },
  };
}
