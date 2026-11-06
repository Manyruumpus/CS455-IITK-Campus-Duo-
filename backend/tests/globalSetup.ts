import type { GlobalSetupContext } from 'vitest/node';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Augment Vitest ProvidedContext with required isolation parameters
declare module 'vitest' {
  export interface ProvidedContext {
    CAMPUS_DUO_TEST_MODE: string;
    PGDATABASE: string;
    PGUSER: string;
    PGPASSWORD: string;
  }
}

// Capture whether DATABASE_URL was explicitly supplied by the parent process before dotenv loading
const isDatabaseUrlSuppliedByParent =
  Object.prototype.hasOwnProperty.call(process.env, 'DATABASE_URL') &&
  process.env.DATABASE_URL !== undefined;

// Load local environment files if present without overriding existing process.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// In test mode, purge DATABASE_URL loaded from development .env (aligns with src/config/env.ts)
if (process.env.CAMPUS_DUO_TEST_MODE === 'true') {
  delete process.env.DATABASE_URL;
}

/**
 * Vitest 2.1 globalSetup function.
 * Executes once in the main runner process before test workers or files are dispatched.
 */
export async function setup({ provide }: GlobalSetupContext): Promise<void> {
  // 1. Mandatory test environment configuration assertions
  if (process.env.CAMPUS_DUO_TEST_MODE !== 'true') {
    throw new Error(
      'Database isolation preflight failed: CAMPUS_DUO_TEST_MODE must be set to "true".'
    );
  }

  if (isDatabaseUrlSuppliedByParent || Object.prototype.hasOwnProperty.call(process.env, 'DATABASE_URL')) {
    throw new Error(
      'Database isolation preflight failed: DATABASE_URL is not permitted in test mode.'
    );
  }

  if (process.env.PGDATABASE !== 'campus_duo_test') {
    throw new Error(
      `Database isolation preflight failed: PGDATABASE must be "campus_duo_test", got "${process.env.PGDATABASE || ''}".`
    );
  }

  const appPassword = process.env.CAMPUS_DUO_TEST_APP_PASSWORD;
  if (!appPassword) {
    throw new Error(
      'Database isolation preflight failed: CAMPUS_DUO_TEST_APP_PASSWORD is required.'
    );
  }

  const migratorPassword = process.env.CAMPUS_DUO_TEST_MIGRATOR_PASSWORD;
  if (!migratorPassword) {
    throw new Error(
      'Database isolation preflight failed: CAMPUS_DUO_TEST_MIGRATOR_PASSWORD is required.'
    );
  }

  const host = process.env.PGHOST || '127.0.0.1';
  const port = parseInt(process.env.PGPORT || '5432', 10);

  // 2. Validate application role connection (campus_duo_test_app)
  const appClient = new Client({
    host,
    port,
    database: 'campus_duo_test',
    user: 'campus_duo_test_app',
    password: appPassword
  });

  try {
    await appClient.connect();
    const res = await appClient.query<{ database_name: string; database_user: string }>(
      'SELECT current_database() AS database_name, current_user AS database_user'
    );
    const row = res.rows[0];
    if (!row || row.database_name !== 'campus_duo_test') {
      throw new Error(
        `Database isolation preflight failed for app role: expected database "campus_duo_test", got "${row?.database_name}".`
      );
    }
    if (row.database_user !== 'campus_duo_test_app') {
      throw new Error(
        `Database isolation preflight failed for app role: expected user "campus_duo_test_app", got "${row?.database_user}".`
      );
    }
  } finally {
    await appClient.end().catch(() => {});
  }

  // 3. Validate migrator role connection (campus_duo_test_migrator)
  const migratorClient = new Client({
    host,
    port,
    database: 'campus_duo_test',
    user: 'campus_duo_test_migrator',
    password: migratorPassword
  });

  try {
    await migratorClient.connect();
    const res = await migratorClient.query<{ database_name: string; database_user: string }>(
      'SELECT current_database() AS database_name, current_user AS database_user'
    );
    const row = res.rows[0];
    if (!row || row.database_name !== 'campus_duo_test') {
      throw new Error(
        `Database isolation preflight failed for migrator role: expected database "campus_duo_test", got "${row?.database_name}".`
      );
    }
    if (row.database_user !== 'campus_duo_test_migrator') {
      throw new Error(
        `Database isolation preflight failed for migrator role: expected user "campus_duo_test_migrator", got "${row?.database_user}".`
      );
    }
  } finally {
    await migratorClient.end().catch(() => {});
  }

  // 4. Validate and align application pool credentials in global process
  if (process.env.PGUSER && process.env.PGUSER !== 'campus_duo_test_app') {
    throw new Error(
      `Database isolation preflight failed: PGUSER is set to "${process.env.PGUSER}", but must be "campus_duo_test_app".`
    );
  }

  if (process.env.PGPASSWORD && process.env.PGPASSWORD !== appPassword) {
    throw new Error(
      'Database isolation preflight failed: PGPASSWORD does not match CAMPUS_DUO_TEST_APP_PASSWORD.'
    );
  }

  process.env.CAMPUS_DUO_TEST_MODE = 'true';
  process.env.PGDATABASE = 'campus_duo_test';
  process.env.PGUSER = 'campus_duo_test_app';
  process.env.PGPASSWORD = appPassword;

  // Mandatory propagation to test workers via Vitest provide API
  provide('CAMPUS_DUO_TEST_MODE', 'true');
  provide('PGDATABASE', 'campus_duo_test');
  provide('PGUSER', 'campus_duo_test_app');
  provide('PGPASSWORD', appPassword);
}
