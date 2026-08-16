/**
 * 格式化工具，供 Status Bar、Tree 标签、WebView 数据展示复用。
 */

/** 数字千分位格式化，例如 24344 -> "24.3k"。 */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return (n / 1_000_000).toFixed(2) + 'M';
  }
  if (n >= 1000) {
    return (n / 1000).toFixed(1) + 'k';
  }
  return String(n);
}

/** 毫秒 → "2h 3m 5s" 形式。 */
export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
}

/** 毫秒时间戳 → 本地可读时间。 */
export function formatTime(ts: number): string {
  if (!ts) {
    return '—';
  }
  return new Date(ts).toLocaleString();
}
