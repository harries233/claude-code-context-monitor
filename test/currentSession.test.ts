import * as assert from 'node:assert';
import { test } from 'node:test';
import { resolveCurrentSession } from '../src/services/currentSession';
import { SessionMeta, SessionStats } from '../src/models/types';

function meta(partial: Partial<SessionMeta>): SessionMeta {
  return {
    sessionId: 'sess-1',
    name: 'sess-1',
    cwd: '/ws',
    startedAt: 0,
    active: true,
    ...partial,
  };
}

function stats(sessionId: string, over: Partial<SessionStats> = {}): SessionStats {
  return {
    meta: meta({ sessionId, name: sessionId, cwd: '/ws' }),
    contextTokens: 0,
    maxContextTokens: 200000,
    contextPercent: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    messageCount: 0,
    fileReadCount: 0,
    duplicateReadCount: 0,
    elapsedMs: 0,
    largeFiles: [],
    ...over,
  };
}

test('cwd 匹配的活跃会话：按最近活动而非创建时间选当前', () => {
  const newerStarted = stats('sess-newer', {
    meta: meta({ sessionId: 'sess-newer', cwd: '/ws', startedAt: 1000 }),
    lastActivityAt: 100,
  });
  const olderActive = stats('sess-older', {
    meta: meta({ sessionId: 'sess-older', cwd: '/ws', startedAt: 100 }),
    lastActivityAt: 900,
  });
  const active = [
    meta({ sessionId: 'sess-newer', cwd: '/ws', startedAt: 1000 }),
    meta({ sessionId: 'sess-older', cwd: '/ws', startedAt: 100 }),
  ];
  const current = resolveCurrentSession([newerStarted, olderActive], active, '/ws');
  // 后开的新窗口一直没用，旧窗口最近有活动 → 应选旧的
  assert.strictEqual(current?.meta.sessionId, 'sess-older');
});

test('无 cwd 匹配时：取所有活跃会话中最近活动的', () => {
  const a = stats('a', {
    meta: meta({ sessionId: 'a', cwd: '/other', startedAt: 200 }),
    lastActivityAt: 50,
  });
  const b = stats('b', {
    meta: meta({ sessionId: 'b', cwd: '/other2', startedAt: 100 }),
    lastActivityAt: 300,
  });
  const active = [
    meta({ sessionId: 'a', cwd: '/other', startedAt: 200 }),
    meta({ sessionId: 'b', cwd: '/other2', startedAt: 100 }),
  ];
  const current = resolveCurrentSession([a, b], active, '/ws');
  assert.strictEqual(current?.meta.sessionId, 'b');
});

test('无活跃会话时：取最后修改的会话', () => {
  const s1 = stats('s1', {
    meta: meta({ sessionId: 's1', cwd: '/ws', startedAt: 100, active: false }),
    lastActivityAt: 100,
  });
  const s2 = stats('s2', {
    meta: meta({ sessionId: 's2', cwd: '/ws', startedAt: 200, active: false }),
    lastActivityAt: 400,
  });
  const current = resolveCurrentSession([s1, s2], [], '/ws');
  assert.strictEqual(current?.meta.sessionId, 's2');
});

test('活跃但未解析出统计的会话被跳过', () => {
  const parsed = stats('parsed', { meta: meta({ sessionId: 'parsed', cwd: '/ws' }) });
  const active = [
    meta({ sessionId: 'missing', cwd: '/ws' }),
    meta({ sessionId: 'parsed', cwd: '/ws' }),
  ];
  const current = resolveCurrentSession([parsed], active, '/ws');
  assert.strictEqual(current?.meta.sessionId, 'parsed');
});

test('无 lastActivityAt 时回退用 meta.lastModifiedAt', () => {
  const s1 = stats('s1', {
    meta: meta({ sessionId: 's1', cwd: '/ws', startedAt: 100, lastModifiedAt: 100 }),
  });
  const s2 = stats('s2', {
    meta: meta({ sessionId: 's2', cwd: '/ws', startedAt: 200, lastModifiedAt: 500 }),
  });
  const active = [
    meta({ sessionId: 's1', cwd: '/ws' }),
    meta({ sessionId: 's2', cwd: '/ws' }),
  ];
  const current = resolveCurrentSession([s1, s2], active, '/ws');
  assert.strictEqual(current?.meta.sessionId, 's2');
});

test('无任何会话 → null', () => {
  assert.strictEqual(resolveCurrentSession([], [], '/ws'), null);
});
