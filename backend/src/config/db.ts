import { Pool, PoolClient, QueryResult, QueryResultRow, types } from 'pg';
import { getEnvConfig } from './env';

// Return PostgreSQL DATE columns (OID 1082) as ISO calendar date strings (YYYY-MM-DD)
types.setTypeParser(1082, (val: string) => val);

let poolInstance: Pool | null = null;

export function getDbPool(): Pool {
  if (!poolInstance) {
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
  }
}
