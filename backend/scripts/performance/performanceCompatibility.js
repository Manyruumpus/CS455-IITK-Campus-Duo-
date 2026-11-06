const expectedColumns = [
  ['installed_rank', 'integer', 'NO', ''],
  ['version', 'character varying', 'YES', ''],
  ['description', 'character varying', 'NO', ''],
  ['type', 'character varying', 'NO', ''],
  ['script', 'character varying', 'NO', ''],
  ['checksum', 'integer', 'YES', ''],
  ['installed_by', 'character varying', 'NO', ''],
  ['installed_on', 'timestamp without time zone', 'NO', 'now()'],
  ['execution_time', 'integer', 'NO', ''],
  ['success', 'boolean', 'NO', '']
];

const expectedIndexes = [
  ['flyway_schema_history_pk', 'installed_rank', 'unique'],
  ['flyway_schema_history_s_idx', 'success', 'nonunique']
];

function evaluatePerformanceCompatibility(input) {
  const unexpectedRoutines = input.unexpectedRoutines;
  const routinesAreAnArray = Array.isArray(unexpectedRoutines);
  const checks = [
    ['database owner', input.databaseOwner === 'campus_duo_migrator'],
    ['schema owner', input.schemaOwner === 'campus_duo_migrator'],
    ['btree_gist extension', input.extension === 'btree_gist|public|postgres'],
    ['history relation type', input.historyKind === 'r'],
    ['history owner', input.historyOwner === 'campus_duo_migrator'],
    ['history columns', JSON.stringify(input.columns) === JSON.stringify(expectedColumns)],
    ['history primary key', JSON.stringify(input.primaryKey) === JSON.stringify(['installed_rank'])],
    ['history not-null columns', JSON.stringify(input.notNullColumns) === JSON.stringify(
      expectedColumns.filter((column) => column[2] === 'NO').map((column) => column[0])
    )],
    ['history indexes', JSON.stringify(input.indexes) === JSON.stringify(expectedIndexes)],
    ['empty history', input.historyRows === 0],
    ['no unexpected relations', input.unexpectedRelations.length === 0],
    ['no unexpected routines', routinesAreAnArray && unexpectedRoutines.length === 0,
      routinesAreAnArray && unexpectedRoutines.length === 0 ? undefined : unexpectedRoutines]
  ];

  return {
    candidate: checks.every(([, passed]) => passed),
    checks: checks.map(([name, passed, details]) => ({
      name,
      status: passed ? 'PASS' : 'FAIL',
      ...(details === undefined ? {} : { details })
    }))
  };
}

function hasInitializedResumeConfirmation(optionEnabled, answers) {
  return optionEnabled === true &&
    Array.isArray(answers) &&
    answers.length === 3 &&
    answers.every((answer) => answer === 'YES');
}

if (process.argv[2] === '--stdin' || process.argv[2] === '--confirm') {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const parsed = JSON.parse(input);
      const result = process.argv[2] === '--confirm'
        ? hasInitializedResumeConfirmation(true, parsed)
        : evaluatePerformanceCompatibility(parsed);
      process.stdout.write(JSON.stringify(result));
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  });
}

module.exports = {
  evaluatePerformanceCompatibility,
  expectedColumns,
  expectedIndexes,
  hasInitializedResumeConfirmation
};
