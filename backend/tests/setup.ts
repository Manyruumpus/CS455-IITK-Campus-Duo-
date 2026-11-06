import { inject } from 'vitest';

// Augment Vitest ProvidedContext with required isolation parameters
declare module 'vitest' {
  export interface ProvidedContext {
    CAMPUS_DUO_TEST_MODE: string;
    PGDATABASE: string;
    PGUSER: string;
    PGPASSWORD: string;
  }
}

// Retrieve mandatory test isolation parameters provided by globalSetup
const testMode = inject('CAMPUS_DUO_TEST_MODE');
if (testMode !== 'true') {
  throw new Error(
    `Worker test isolation failure: CAMPUS_DUO_TEST_MODE must be "true", got "${testMode || ''}".`
  );
}

const database = inject('PGDATABASE');
if (database !== 'campus_duo_test') {
  throw new Error(
    `Worker test isolation failure: PGDATABASE must be "campus_duo_test", got "${database || ''}".`
  );
}

const user = inject('PGUSER');
if (user !== 'campus_duo_test_app') {
  throw new Error(
    `Worker test isolation failure: PGUSER must be "campus_duo_test_app", got "${user || ''}".`
  );
}

const password = inject('PGPASSWORD');
if (!password) {
  throw new Error(
    'Worker test isolation failure: PGPASSWORD must be non-empty.'
  );
}

// Set validated isolation configuration in worker process.env
process.env.CAMPUS_DUO_TEST_MODE = testMode;
process.env.PGDATABASE = database;
process.env.PGUSER = user;
process.env.PGPASSWORD = password;
