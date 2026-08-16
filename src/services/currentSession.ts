import { SessionMeta, SessionStats } from '../models/types';

/**
 * 确定「当前」Session：
 *   1. cwd 匹配工作区且 active 的最新 Session
 *   2. 最新的 active Session
 *   3. 列表中最后修改的 Session
 */
export function resolveCurrentSession(
  sessions: SessionStats[],
  active: SessionMeta[],
  cwd: string
): SessionStats | null {
  const activeMatching = active
    .filter((a) => a.cwd === cwd)
    .sort((a, b) => b.startedAt - a.startedAt);
  if (activeMatching.length > 0) {
    const found = sessions.find((s) => s.meta.sessionId === activeMatching[0].sessionId);
    if (found) {
      return found;
    }
  }

  const activeSorted = [...active].sort((a, b) => b.startedAt - a.startedAt);
  if (activeSorted.length > 0) {
    const found = sessions.find((s) => s.meta.sessionId === activeSorted[0].sessionId);
    if (found) {
      return found;
    }
  }

  if (sessions.length > 0) {
    return [...sessions].sort(
      (a, b) => (b.meta.lastModifiedAt || 0) - (a.meta.lastModifiedAt || 0)
    )[0];
  }
  return null;
}
