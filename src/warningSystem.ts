import { Thresholds } from './config';
import { WarningLevel } from './types';

export interface WarningInfo {
  level: WarningLevel;
  /** 人话描述。 */
  label: string;
  /** 状态栏 / 面板用的颜色。 */
  color: string;
  /** 状态栏图标（codicon）。 */
  icon: string;
}

/**
 * 根据 context 使用百分比判定告警等级：
 *   >= danger   危险（强烈建议新 Session）
 *   >= critical 红色告警
 *   >= warning  黄色提示
 *   否则        normal
 */
export function evaluateWarningLevel(percent: number, t: Thresholds): WarningLevel {
  if (percent >= t.danger) {
    return 'danger';
  }
  if (percent >= t.critical) {
    return 'critical';
  }
  if (percent >= t.warning) {
    return 'warning';
  }
  return 'normal';
}

export function describeWarning(level: WarningLevel): WarningInfo {
  switch (level) {
    case 'danger':
      return { level, label: '强烈建议开启新 Session', color: '#ff3b30', icon: 'flame' };
    case 'critical':
      return { level, label: 'Context 即将耗尽，建议 /compact', color: '#f85149', icon: 'warning' };
    case 'warning':
      return { level, label: 'Context 偏高，注意观察', color: '#d29922', icon: 'alert' };
    default:
      return { level, label: 'Context 正常', color: '#3fb950', icon: 'check' };
  }
}
