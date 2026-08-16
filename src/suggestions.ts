import { Thresholds } from './config';
import { formatTokens } from './format';
import { SessionStats } from './types';

/**
 * 基于统计数据生成规则化的优化建议（MVP：不做 AI 分析）。
 */
export function generateSuggestions(stats: SessionStats, t: Thresholds): string[] {
  const p = stats.contextPercent;
  const out: string[] = [];

  if (p >= t.danger) {
    out.push(`⚠️ Context 已超过 ${t.danger}%，强烈建议开启新 Session 以释放上下文。`);
  }
  if (p >= t.critical) {
    out.push(`🔴 Context 超过 ${t.critical}%，建议执行 /compact 压缩上下文。`);
  }
  if (p >= t.warning) {
    out.push(`🟡 Context 超过 ${t.warning}%，后续长输出可能触发截断，请留意。`);
  }

  if (stats.messageCount > 100) {
    out.push(`💬 本会话已产生 ${stats.messageCount} 条消息，可考虑 /compact 或新建 Session。`);
  }

  if (stats.largeFiles.length > 0) {
    const top = stats.largeFiles[0];
    out.push(`📄 占用 token 最多的文件：${top.path}（约 ${formatTokens(top.estimatedTokens)} tokens）。`);
  }

  if (out.length === 0) {
    out.push('✅ Context 使用正常，无需处理。');
  }
  return out;
}
