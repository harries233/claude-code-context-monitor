import { SessionMeta, SessionStats } from '../models/types';

/**
 * 确定「当前」Session（多个 Claude Code 窗口/终端同时活跃时，跟随最近使用的那个）：
 *   1. cwd 匹配工作区、且最近有活动的 Session
 *   2. 所有活跃 Session 中最近有活动的
 *   3. 列表中最后修改的 Session
 *
 * 按「最近活动时间」而非「创建时间」排序：用户可能一直在旧窗口里工作，
 * 而新建的窗口是后开的；若按 startedAt 选，状态栏会一直锁定在最新开的会话上。
 */
export function resolveCurrentSession(
  sessions: SessionStats[],
  active: SessionMeta[],
  cwd: string
): SessionStats | null {
  const byId = new Map(sessions.map((s) => [s.meta.sessionId, s]));

  /** 最近活动时间：优先 JSONL 最后一条消息的时间，其次文件修改时间，最后创建时间。 */
  const lastActivity = (s: SessionStats): number =>
    s.lastActivityAt ?? s.meta.lastModifiedAt ?? s.meta.startedAt ?? 0;

  /** 从活跃会话列表里挑出最近有活动的一个（前提是其统计已解析出来）。 */
  const pick = (candidates: SessionMeta[]): SessionStats | null => {
    const matched = candidates
      .filter((a) => byId.has(a.sessionId))
      .sort((a, b) => lastActivity(byId.get(b.sessionId)!) - lastActivity(byId.get(a.sessionId)!));
    return matched.length > 0 ? byId.get(matched[0].sessionId)! : null;
  };

  return (
    pick(active.filter((a) => a.cwd === cwd)) ??
    pick(active) ??
    [...sessions].sort((a, b) => lastActivity(b) - lastActivity(a))[0] ??
    null
  );
}
