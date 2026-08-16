import * as assert from 'node:assert';
import { test } from 'node:test';
import { DEFAULT_THRESHOLDS } from '../src/models/contextConfig';
import { SessionStats } from '../src/models/types';
import { computeHealthScore } from '../src/services/healthScore';

function makeStats(overrides: Partial<SessionStats> = {}): SessionStats {
  return {
    meta: { sessionId: 's1', name: 't', cwd: '/x', startedAt: Date.now() - 60000, active: true },
    contextTokens: 1000,
    maxContextTokens: 200000,
    contextPercent: 1,
    totalInputTokens: 1000,
    totalOutputTokens: 100,
    messageCount: 10,
    fileReadCount: 5,
    duplicateReadCount: 0,
    elapsedMs: 60000,
    largeFiles: [],
    lastActivityAt: Date.now(),
    ...overrides,
  };
}

test('健康会话 → A', () => {
  const r = computeHealthScore(makeStats(), DEFAULT_THRESHOLDS);
  assert.strictEqual(r.grade, 'A');
  assert.ok(r.score >= 85);
});

test('仅 context 超危险线 → C', () => {
  const r = computeHealthScore(
    makeStats({ contextPercent: 96, contextTokens: 192000 }),
    DEFAULT_THRESHOLDS
  );
  assert.strictEqual(r.grade, 'C');
});

test('多维度恶化 → D', () => {
  const r = computeHealthScore(
    makeStats({
      contextPercent: 96,
      contextTokens: 192000,
      messageCount: 250,
      fileReadCount: 100,
      duplicateReadCount: 40,
      largeFiles: [{ path: '/x/huge.log', estimatedTokens: 60000 }],
    }),
    DEFAULT_THRESHOLDS
  );
  assert.strictEqual(r.grade, 'D');
});
