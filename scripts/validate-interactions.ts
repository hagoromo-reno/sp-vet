import {
  behaviorScenarioSummary,
  runBehaviorScenarios,
} from '../src/validation/behaviorScenarios';

const verbose = process.argv.includes('--verbose');
const json = process.argv.includes('--json');
const results = runBehaviorScenarios();
const summary = behaviorScenarioSummary(results);

if (json) {
  console.log(JSON.stringify({ summary, results }, null, 2));
} else {
  console.log(`Cenários comportamentais: ${results.length} | Aprovados: ${summary.passed} | Desvios: ${summary.failed}`);
  for (const result of results) {
    if (!verbose && result.passed) continue;
    console.log(`${result.passed ? 'OK' : 'DESVIO'} | ${result.id} | ${result.title}`);
    console.log(`  Esperado: ${result.expected}`);
    console.log(`  Observado: ${result.observed}`);
  }
}

if (summary.failed > 0) process.exitCode = 1;
