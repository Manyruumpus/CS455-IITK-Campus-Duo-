const assert = require('node:assert/strict');
const {
  evaluatePerformanceCompatibility,
  expectedColumns,
  expectedIndexes,
  hasInitializedResumeConfirmation
} = require('./performanceCompatibility');

const valid = () => ({
  databaseOwner: 'campus_duo_migrator',
  schemaOwner: 'campus_duo_migrator',
  extension: 'btree_gist|public|postgres',
  historyKind: 'r',
  historyOwner: 'campus_duo_migrator',
  columns: expectedColumns,
  primaryKey: ['installed_rank'],
  notNullColumns: expectedColumns.filter((column) => column[2] === 'NO').map((column) => column[0]),
  indexes: expectedIndexes,
  historyRows: 0,
  unexpectedRelations: [],
  unexpectedRoutines: []
});

function assertPasses() {
  assert.equal(evaluatePerformanceCompatibility(valid()).candidate, true);
}

function assertFails(mutator, checkName) {
  const input = valid();
  mutator(input);
  const result = evaluatePerformanceCompatibility(input);
  assert.equal(result.candidate, false);
  assert.equal(result.checks.find((check) => check.name === checkName).status, 'FAIL');
}

assertPasses();
assertFails((input) => { input.databaseOwner = 'postgres'; }, 'database owner');
assertFails((input) => { input.historyRows = 1; }, 'empty history');
assertFails((input) => { input.unexpectedRelations = ['other_table']; }, 'no unexpected relations');
assertFails((input) => { input.unexpectedRoutines = ['other_function']; }, 'no unexpected routines');
assertFails((input) => { input.unexpectedRoutines = [{ schema: 'campus_duo', name: 'one_function', classification: 'application' }]; }, 'no unexpected routines');
assertFails((input) => { input.unexpectedRoutines = [
  { schema: 'campus_duo', name: 'one_function', classification: 'application' },
  { schema: 'campus_duo', name: 'two_function', classification: 'application' }
]; }, 'no unexpected routines');
assert.equal(evaluatePerformanceCompatibility({ ...valid(), unexpectedRoutines: undefined }).candidate, false);
assert.equal(evaluatePerformanceCompatibility({ ...valid(), unexpectedRoutines: null }).candidate, false);
assert.equal(evaluatePerformanceCompatibility({ ...valid(), unexpectedRoutines: 'one_function' }).candidate, false);
assertFails((input) => { input.columns = input.columns.slice(1); }, 'history columns');
assertFails((input) => { input.primaryKey = ['version']; }, 'history primary key');
assertFails((input) => { input.indexes = ['unexpected_idx|success|nonunique']; }, 'history indexes');
assert.equal(hasInitializedResumeConfirmation(true, ['YES', 'YES', 'YES']), true);
assert.equal(hasInitializedResumeConfirmation(false, ['YES', 'YES', 'YES']), false);
assert.equal(hasInitializedResumeConfirmation(true, ['YES', 'NO', 'YES']), false);
assert.equal(hasInitializedResumeConfirmation(true, ['YES', 'YES']), false);

console.log('performance compatibility evaluator tests passed');
