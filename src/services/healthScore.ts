import { Thresholds } from '../models/contextConfig';
import { HEALTH_GRADE_LABELS, HealthFactor, HealthGrade, HealthReport } from '../models/health';
import { SessionStats } from '../models/types';
import { formatTokens } from './format';

/**
 * Context 健康评分系统。
 *
 * 从 100 分起扣，依据以下维度逐项打分：
 *   1. Context 使用率
 *   2. 消息数量
 *   3. 文件读取数量
 *   4. 大文件数量 / 最大文件
 *   5. 重复内容（重复读取同一文件）
 *
 * 等级映射：
 *   >= 85  A（状态良好）
 *   >= 70  B（建议整理）
 *   >= 55  C（建议 compact）
 *   否则    D（建议新 Session）
 */
export function computeHealthScore(stats: SessionStats, t: Thresholds): HealthReport {
  let score = 100;
  const factors: HealthFactor[] = [];
  const p = stats.contextPercent;

  // 1. Context 使用率
  if (p >= t.danger) {
    score -= 40;
    factors.push({ name: 'Context 使用率', status: 'bad', detail: `${p}% 已达 ${t.danger}% 危险线` });
  } else if (p >= t.critical) {
    score -= 28;
    factors.push({ name: 'Context 使用率', status: 'bad', detail: `${p}% 超过 ${t.critical}%，即将耗尽` });
  } else if (p >= t.warning) {
    score -= 14;
    factors.push({ name: 'Context 使用率', status: 'ok', detail: `${p}% 超过 ${t.warning}% 提醒线` });
  } else {
    factors.push({ name: 'Context 使用率', status: 'good', detail: `${p}% 状态良好` });
  }

  // 2. 消息数量
  const m = stats.messageCount;
  if (m > 200) {
    score -= 20;
    factors.push({ name: '消息数量', status: 'bad', detail: `${m} 条消息，建议 compact 或新会话` });
  } else if (m > 100) {
    score -= 10;
    factors.push({ name: '消息数量', status: 'ok', detail: `${m} 条消息，偏多` });
  } else if (m > 60) {
    score -= 4;
    factors.push({ name: '消息数量', status: 'ok', detail: `${m} 条消息` });
  } else {
    factors.push({ name: '消息数量', status: 'good', detail: `${m} 条消息` });
  }

  // 3. 文件读取数量
  const fr = stats.fileReadCount;
  if (fr > 80) {
    score -= 15;
    factors.push({ name: '文件读取', status: 'bad', detail: `读取 ${fr} 次，较多` });
  } else if (fr > 40) {
    score -= 8;
    factors.push({ name: '文件读取', status: 'ok', detail: `读取 ${fr} 次` });
  } else if (fr > 20) {
    score -= 3;
    factors.push({ name: '文件读取', status: 'ok', detail: `读取 ${fr} 次` });
  } else {
    factors.push({ name: '文件读取', status: 'good', detail: `读取 ${fr} 次` });
  }

  // 4. 大文件
  const top = stats.largeFiles[0]?.estimatedTokens ?? 0;
  if (top > 50000) {
    score -= 15;
    factors.push({ name: '大文件', status: 'bad', detail: `最大文件约 ${formatTokens(top)} tokens` });
  } else if (top > 20000) {
    score -= 8;
    factors.push({ name: '大文件', status: 'ok', detail: `最大文件约 ${formatTokens(top)} tokens` });
  } else if (top > 8000) {
    score -= 3;
    factors.push({ name: '大文件', status: 'ok', detail: `最大文件约 ${formatTokens(top)} tokens` });
  } else {
    factors.push({ name: '大文件', status: 'good', detail: '无明显超大文件' });
  }

  // 5. 重复内容
  const dup = stats.duplicateReadCount;
  if (dup > 30) {
    score -= 10;
    factors.push({ name: '重复内容', status: 'bad', detail: `重复读取 ${dup} 次` });
  } else if (dup > 15) {
    score -= 5;
    factors.push({ name: '重复内容', status: 'ok', detail: `重复读取 ${dup} 次` });
  } else if (dup > 5) {
    score -= 2;
    factors.push({ name: '重复内容', status: 'ok', detail: `重复读取 ${dup} 次` });
  } else {
    factors.push({ name: '重复内容', status: 'good', detail: '重复读取较少' });
  }

  score = clamp(score);
  const grade: HealthGrade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D';

  return { grade, score, label: HEALTH_GRADE_LABELS[grade], factors };
}

function clamp(n: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, n));
}
