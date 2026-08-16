import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import { ClaudeCliProvider } from '../src/providers/ClaudeCliProvider';

/** 构造一个最小可用的 Claude 数据目录 fixture。 */
function makeFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccm-'));
  fs.mkdirSync(path.join(root, 'sessions'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'sessions', '100.json'),
    JSON.stringify({
      sessionId: 'sess-1',
      name: 'demo',
      cwd: '/workspace',
      startedAt: Date.now() - 60000,
      pid: 100,
    })
  );

  const proj = path.join(root, 'projects', '-workspace');
  fs.mkdirSync(proj, { recursive: true });
  fs.writeFileSync(
    path.join(proj, 'sess-1.jsonl'),
    JSON.stringify({ type: 'user', message: { content: 'hi' } }) +
      '\n' +
      JSON.stringify({
        type: 'assistant',
        message: { model: 'claude-sonnet-4', usage: { input_tokens: 2000, output_tokens: 100 } },
      }) +
      '\n'
  );
  return root;
}

test('ClaudeCliProvider 探测与解析真实 fixture', () => {
  const root = makeFixture();
  const provider = new ClaudeCliProvider(root);

  const detection = provider.detect();
  assert.strictEqual(detection.available, true);
  assert.strictEqual(detection.activeSessionCount, 1);

  const active = provider.listActiveSessions();
  assert.strictEqual(active.length, 1);
  assert.strictEqual(active[0].sessionId, 'sess-1');

  const stats = provider.buildSessionStats('/workspace', active, 0, Date.now());
  assert.strictEqual(stats.length, 1);
  assert.strictEqual(stats[0].contextTokens, 2000);
  assert.strictEqual(stats[0].meta.model, 'claude-sonnet-4');
  assert.strictEqual(stats[0].contextPercent, 1); // 2000 / 200000 = 1%

  const usage = provider.getContextUsage('/workspace');
  assert.strictEqual(usage?.contextTokens, 2000);
});

test('数据目录不存在 → 不可用', () => {
  const missing = path.join(os.tmpdir(), 'ccm-not-exist-' + Math.random().toString(36).slice(2));
  const provider = new ClaudeCliProvider(missing);
  assert.strictEqual(provider.detect().available, false);
});
