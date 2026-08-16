import * as assert from 'node:assert';
import { test } from 'node:test';
import { DEFAULT_THRESHOLDS } from '../src/models/contextConfig';
import { evaluateWarningLevel } from '../src/services/warningSystem';

test('告警等级按阈值分级', () => {
  assert.strictEqual(evaluateWarningLevel(50, DEFAULT_THRESHOLDS), 'normal');
  assert.strictEqual(evaluateWarningLevel(70, DEFAULT_THRESHOLDS), 'warning');
  assert.strictEqual(evaluateWarningLevel(85, DEFAULT_THRESHOLDS), 'critical');
  assert.strictEqual(evaluateWarningLevel(95, DEFAULT_THRESHOLDS), 'danger');
});
