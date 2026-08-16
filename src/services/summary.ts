import { HEALTH_GRADE_LABELS, HealthReport } from '../models/health';
import { SessionStats } from '../models/types';
import { formatDuration, formatTime, formatTokens } from './format';

/**
 * 由当前会话统计生成一段可读的文本摘要（用于「Generate Summary」）。
 */
export function generateSessionSummary(stats: SessionStats, health: HealthReport | null): string {
  const lines = [
    'Claude Code Session 摘要',
    '=======================',
    `会话:      ${stats.meta.name || stats.meta.sessionId}`,
    `模型:      ${stats.meta.model || '未知'}`,
    `创建时间:  ${formatTime(stats.meta.startedAt)}`,
    `运行时长:  ${formatDuration(stats.elapsedMs)}`,
    `消息数:    ${stats.messageCount}`,
    '',
    `Context:   ${stats.contextPercent}% (${formatTokens(stats.contextTokens)} / ${formatTokens(stats.maxContextTokens)})`,
    `输入累计:  ${formatTokens(stats.totalInputTokens)}`,
    `输出累计:  ${formatTokens(stats.totalOutputTokens)}`,
    `文件读取:  ${stats.fileReadCount} 次`,
    '',
  ];

  if (health) {
    lines.push(`健康评分:  ${health.grade} (${health.score}/100) — ${health.label}`);
    lines.push('');
    lines.push('评分因素:');
    for (const f of health.factors) {
      lines.push(`  - ${f.name}: ${f.detail}`);
    }
    lines.push('');
  }

  if (stats.largeFiles.length > 0) {
    lines.push('Context 大头文件:');
    for (const f of stats.largeFiles.slice(0, 5)) {
      lines.push(`  - ${f.path}  (~${formatTokens(f.estimatedTokens)} tokens)`);
    }
    lines.push('');
  }

  lines.push(`结论: ${health ? health.label : HEALTH_GRADE_LABELS.A}`);
  return lines.join('\n');
}
