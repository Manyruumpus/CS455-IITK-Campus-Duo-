import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend directory if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export interface EnvConfig {
  nodeEnv: string;
  port: number;
  host: string;
  allowTestHarnessAuth: boolean;
  db: {
    host: string;
    port: number;
    database: string;
    user: string;
    password?: string;
    connectionString?: string;
  };
}

export function getEnvConfig(): EnvConfig {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const port = parseInt(process.env.PORT || '4000', 10);
  const host = process.env.HOST || '127.0.0.1';
  const allowTestHarnessAuth = process.env.ALLOW_TEST_HARNESS_AUTH === 'true';

  const dbHost = process.env.PGHOST || process.env.DB_HOST || '127.0.0.1';
  const dbPort = parseInt(process.env.PGPORT || process.env.DB_PORT || '5432', 10);
  const database = process.env.PGDATABASE || process.env.DB_NAME || 'campus_duo_dev';
  const user = process.env.PGUSER || process.env.DB_USER || 'campus_duo_app';
  const password = process.env.PGPASSWORD || process.env.DB_PASSWORD;
  const connectionString = process.env.DATABASE_URL;

  return {
    nodeEnv,
    port,
    host,
    allowTestHarnessAuth,
    db: {
      host: dbHost,
      port: dbPort,
      database,
      user,
      password,
      connectionString
    }
  };
}

export function isTestAuthAllowed(): boolean {
  const config = getEnvConfig();
  return config.nodeEnv === 'development' && config.allowTestHarnessAuth;
}
