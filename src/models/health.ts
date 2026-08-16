/** Context 健康等级。 */
export type HealthGrade = 'A' | 'B' | 'C' | 'D';

/** 单个评分因素的状态。 */
export type HealthFactorStatus = 'good' | 'ok' | 'bad';

/** 单个评分因素。 */
export interface HealthFactor {
  name: string;
  status: HealthFactorStatus;
  detail: string;
}

/** 健康评分报告。 */
export interface HealthReport {
  grade: HealthGrade;
  /** 0-100 分数（越高越健康）。 */
  score: number;
  /** 一句话结论。 */
  label: string;
  /** 各评分因素明细。 */
  factors: HealthFactor[];
}

/** 健康等级 → 一句话结论。 */
export const HEALTH_GRADE_LABELS: Record<HealthGrade, string> = {
  A: 'Context 状态良好',
  B: '建议整理',
  C: '建议 compact',
  D: '建议新 Session',
};
