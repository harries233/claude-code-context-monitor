import * as assert from 'node:assert';
import { test } from 'node:test';
import { compareVersions, hasUpdate, normalizeVersion } from '../src/services/updateChecker';

test('normalizeVersion 去掉 v 前缀与空白', () => {
  assert.strictEqual(normalizeVersion('0.2.1'), '0.2.1');
  assert.strictEqual(normalizeVersion('v0.2.1'), '0.2.1');
  assert.strictEqual(normalizeVersion('  V0.2.1  '), '0.2.1');
});

test('compareVersions 基本大小比较', () => {
  assert.strictEqual(compareVersions('0.2.1', '0.2.0'), 1);
  assert.strictEqual(compareVersions('0.2.0', '0.2.1'), -1);
  assert.strictEqual(compareVersions('0.2.1', '0.2.1'), 0);
  assert.strictEqual(compareVersions('v0.2.1', '0.2.1'), 0);
});

test('compareVersions 逐段数值比较（非字典序）', () => {
  assert.strictEqual(compareVersions('0.10.0', '0.9.0'), 1);
  assert.strictEqual(compareVersions('1.0.0', '0.99.99'), 1);
  assert.strictEqual(compareVersions('0.2.1', '0.2.1-beta'), 0);
});

test('hasUpdate 仅在最新版高于当前版时为 true', () => {
  assert.strictEqual(hasUpdate('0.2.0', '0.2.1'), true);
  assert.strictEqual(hasUpdate('0.2.1', '0.2.1'), false);
  assert.strictEqual(hasUpdate('0.2.2', '0.2.1'), false);
  assert.strictEqual(hasUpdate('v0.2.0', 'v0.2.1'), true);
});
