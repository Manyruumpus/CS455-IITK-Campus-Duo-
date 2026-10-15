import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend directory if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface SmtpConfig {
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

export interface EnvConfig {
  nodeEnv: string;
  port: number;
  allowTestHarnessAuth: boolean;
  emailTransport: 'smtp' | 'inmemory' | 'auto';
  emailDeliveryRequired: boolean;
  smtp: SmtpConfig;
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
  const allowTestHarnessAuth = process.env.ALLOW_TEST_HARNESS_AUTH === 'true';
  const emailTransport = (process.env.EMAIL_TRANSPORT as 'smtp' | 'inmemory' | 'auto') || 'auto';
  const emailDeliveryRequired = process.env.EMAIL_DELIVERY_REQUIRED === 'true';

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpSecure = process.env.SMTP_SECURE === 'true' || smtpPort === 465;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const emailFrom = process.env.EMAIL_FROM || 'Campus Duo IITK <noreply@campusduo.iitk.ac.in>';

  const host = process.env.PGHOST || process.env.DB_HOST || '127.0.0.1';
  const dbPort = parseInt(process.env.PGPORT || process.env.DB_PORT || '5432', 10);
  const database = process.env.PGDATABASE || process.env.DB_NAME || 'campus_duo_dev';
  const user = process.env.PGUSER || process.env.DB_USER || 'campus_duo_app';
  const password = process.env.PGPASSWORD || process.env.DB_PASSWORD;
  const connectionString = process.env.DATABASE_URL;

  return {
    nodeEnv,
    port,
    allowTestHarnessAuth,
    emailTransport,
    emailDeliveryRequired,
    smtp: {
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      user: smtpUser,
      pass: smtpPass,
      from: emailFrom,
    },
    db: {
      host,
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
