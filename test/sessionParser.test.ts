import * as assert from 'node:assert';
import { test } from 'node:test';
import { SessionMeta } from '../src/models/types';
import { createAccumulator, finalizeStats, parseCompleteLines } from '../src/services/sessionParser';

function meta(): SessionMeta {
  return { sessionId: 's1', name: 't', cwd: '/x', startedAt: 1000000, active: true };
}

test('解析 token 用量、消息数与模型名', () => {
  const acc = createAccumulator(meta());
  const text =
    JSON.stringify({ type: 'user', message: { content: 'hi' }, timestamp: '2026-08-16T00:00:00Z' }) +
    '\n' +
    JSON.stringify({
      type: 'assistant',
      message: {
        model: 'claude-sonnet-4',
        content: 'yo',
        usage: { input_tokens: 1000, cache_read_input_tokens: 500, output_tokens: 200 },
      },
    }) +
    '\n';
  parseCompleteLines(acc, text);

  const stats = finalizeStats(acc, 200000, 2000000);
  assert.strictEqual(stats.messageCount, 2);
  assert.strictEqual(stats.contextTokens, 1500);
  assert.strictEqual(stats.totalInputTokens, 1000);
  assert.strictEqual(stats.totalOutputTokens, 200);
  assert.strictEqual(stats.meta.model, 'claude-sonnet-4');
});

test('统计文件读取次数与重复读取', () => {
  const acc = createAccumulator(meta());
  const text =
    JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/x/a.ts' } },
          { type: 'tool_result', tool_use_id: 't1', content: 'aaaa' },
          { type: 'tool_use', id: 't2', name: 'Read', input: { file_path: '/x/a.ts' } },
          { type: 'tool_use', id: 't3', name: 'Read', input: { file_path: '/x/b.ts' } },
        ],
      },
    }) +
    '\n';
  parseCompleteLines(acc, text);

  const stats = finalizeStats(acc, 200000, 2000000);
  assert.strictEqual(stats.fileReadCount, 3);
  assert.strictEqual(stats.duplicateReadCount, 1);
});
