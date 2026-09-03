import assert from 'node:assert/strict';
import test from 'node:test';
import {
  behaviorScenarioSummary,
  runBehaviorScenarios,
} from '../src/validation/behaviorScenarios';

const results = runBehaviorScenarios();

test('matriz comportamental não contém desvios fisiológicos conhecidos', async (t) => {
  for (const result of results) {
    await t.test(`${result.id}: ${result.title}`, () => {
      assert.equal(result.passed, true, `${result.expected}; observado: ${result.observed}`);
    });
  }
  assert.deepEqual(behaviorScenarioSummary(results), { passed: results.length, failed: 0 });
});
