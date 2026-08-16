import * as assert from 'node:assert';
import { test } from 'node:test';
import { formatDuration, formatTime, formatTokens } from '../src/services/format';

test('formatTokens 千分位格式化', () => {
  assert.strictEqual(formatTokens(999), '999');
  assert.strictEqual(formatTokens(1000), '1.0k');
  assert.strictEqual(formatTokens(1500), '1.5k');
  assert.strictEqual(formatTokens(1000000), '1.00M');
});

test('formatDuration 时长格式化', () => {
  assert.strictEqual(formatDuration(0), '0s');
  assert.strictEqual(formatDuration(59000), '59s');
  assert.strictEqual(formatDuration(60000), '1m 0s');
  assert.strictEqual(formatDuration(9000000), '2h 30m 0s');
});

test('formatTime 空值兜底', () => {
  assert.strictEqual(formatTime(0), '—');
});
