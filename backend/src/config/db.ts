import { Pool, PoolClient, QueryResult, QueryResultRow, types } from 'pg';
import { getEnvConfig } from './env';

// Return PostgreSQL DATE columns (OID 1082) as ISO calendar date strings (YYYY-MM-DD)
types.setTypeParser(1082, (val: string) => val);

let poolInstance: Pool | null = null;
let verificationPromise: Promise<void> | null = null;

async function verifyAppConnection(rawConnect: () => Promise<PoolClient>): Promise<void> {
  const client = await rawConnect();
  try {
    const res = await client.query<{ database_name: string; database_user: string }>(
      'SELECT current_database() AS database_name, current_user AS database_user'
    );
    const row = res.rows[0];
    if (!row || row.database_name !== 'campus_duo_test') {
      throw new Error(
        `Database isolation check failed: expected database "campus_duo_test", got "${row?.database_name}"`
      );
    }
    if (row.database_user !== 'campus_duo_test_app') {
      throw new Error(
        `Database isolation check failed: expected user "campus_duo_test_app", got "${row?.database_user}"`
      );
    }
  } finally {
    client.release();
  }
}

export function getDbPool(): Pool {
  if (!poolInstance) {
    const isTestMode = process.env.CAMPUS_DUO_TEST_MODE === 'true';

    if (isTestMode) {
      if (process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not permitted in test mode (CAMPUS_DUO_TEST_MODE=true).');
      }
      if (process.env.PGDATABASE !== 'campus_duo_test') {
        throw new Error(
          `PGDATABASE must be "campus_duo_test" in test mode (CAMPUS_DUO_TEST_MODE=true), got "${process.env.PGDATABASE || ''}".`
        );
      }
      if (process.env.PGUSER !== 'campus_duo_test_app') {
        throw new Error(
          `PGUSER must be "campus_duo_test_app" in test mode (CAMPUS_DUO_TEST_MODE=true), got "${process.env.PGUSER || ''}".`
        );
      }
      if (!process.env.PGPASSWORD) {
        throw new Error('PGPASSWORD is required in test mode (CAMPUS_DUO_TEST_MODE=true).');
      }

      const host = process.env.PGHOST || '127.0.0.1';
      const port = parseInt(process.env.PGPORT || '5432', 10);
      const database = 'campus_duo_test';
      const user = 'campus_duo_test_app';
      const password = process.env.PGPASSWORD;

      poolInstance = new Pool({
        host,
        port,
        database,
        user,
        password,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000
      });

      const originalConnect = poolInstance.connect.bind(poolInstance);

      poolInstance.connect = ((cb?: any): any => {
        if (!verificationPromise) {
          verificationPromise = verifyAppConnection(originalConnect).catch((err) => {
            verificationPromise = null;
            throw err;
          });
        }

        if (typeof cb === 'function') {
          verificationPromise
            .then(() => originalConnect(cb))
            .catch((err) => cb(err, undefined as any, () => {}));
          return;
        }

        return verificationPromise.then(() => originalConnect());
      }) as any;
    } else {
      const config = getEnvConfig();
      const poolConfig = config.db.connectionString
        ? { connectionString: config.db.connectionString }
        : {
            host: config.db.host,
            port: config.db.port,
            database: config.db.database,
            user: config.db.user,
            password: config.db.password,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000
          };

      poolInstance = new Pool(poolConfig);
    }

    poolInstance.on('error', (err) => {
      // Do not log credentials or sensitive data
      console.error('Unexpected error on idle database client', err.message);
    });
  }

  return poolInstance;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const pool = getDbPool();
  return pool.query<T>(text, params);
}

export async function getClient(): Promise<PoolClient> {
  const pool = getDbPool();
  return pool.connect();
}

export async function closeDbPool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
    verificationPromise = null;
  }
}
