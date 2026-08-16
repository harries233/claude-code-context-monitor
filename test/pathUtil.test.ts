import * as assert from 'node:assert';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import { getClaudeDataDir, hashCwd } from '../src/utils/pathUtil';

test('hashCwd 把斜杠替换成连字符', () => {
  assert.strictEqual(hashCwd('/Users/foo'), '-Users-foo');
});

test('getClaudeDataDir 默认 ~/.claude', () => {
  assert.strictEqual(getClaudeDataDir(''), path.join(os.homedir(), '.claude'));
});

test('getClaudeDataDir 支持 ~ 前缀', () => {
  assert.strictEqual(getClaudeDataDir('~/custom'), path.join(os.homedir(), 'custom'));
});
