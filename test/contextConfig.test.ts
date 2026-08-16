import * as assert from 'node:assert';
import { test } from 'node:test';
import { resolveMaxContextTokens } from '../src/models/contextConfig';

test('用户显式配置优先', () => {
  assert.strictEqual(resolveMaxContextTokens('claude-sonnet-4', 128000), 128000);
});

test('按模型名查表', () => {
  assert.strictEqual(resolveMaxContextTokens('claude-sonnet-4', 0), 200000);
  assert.strictEqual(resolveMaxContextTokens('deepseek-v4-pro', 0), 1000000);
});

test('未知模型回退默认 200K', () => {
  assert.strictEqual(resolveMaxContextTokens(undefined, 0), 200000);
  assert.strictEqual(resolveMaxContextTokens('unknown-model', 0), 200000);
});
