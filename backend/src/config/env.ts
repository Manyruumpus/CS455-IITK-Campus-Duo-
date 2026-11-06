import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend directory if present
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Test mode must use explicit PG* variables and never inherit DATABASE_URL.
if (process.env.CAMPUS_DUO_TEST_MODE === 'true') {
  delete process.env.DATABASE_URL;
}

export interface SmtpConfig {
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

export type LlmProviderType = 'huggingface' | 'ollama' | 'none';

export interface LlmConfig {
  enabled: boolean;
  provider: LlmProviderType;
  token?: string;
  modelId: string;
  ollamaHost: string;
  timeoutMs: number;
  configurationIssue?: string;
}

export const DEFAULT_HF_MODEL_ID = 'Qwen/Qwen3-4B-Instruct-2507';
export const DEFAULT_OLLAMA_MODEL_ID = 'qwen2.5vl:3b';
export const DEFAULT_OLLAMA_HOST_URL = 'http://localhost:11434';
const DEFAULT_HF_TIMEOUT_MS = 20_000;
const MIN_HF_TIMEOUT_MS = 1_000;
const MAX_HF_TIMEOUT_MS = 30_000;

export function getLlmConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  const enabled = env.ENABLE_LLM_INFERENCE === 'true';
  const rawProvider = env.LLM_PROVIDER?.toLowerCase()?.trim();
  const provider: LlmProviderType = !enabled
    ? 'none'
    : rawProvider === 'ollama'
      ? 'ollama'
      : rawProvider === 'huggingface'
        ? 'huggingface'
        : 'huggingface';

  const token = env.HF_TOKEN?.trim() || undefined;
  const ollamaHost = env.OLLAMA_HOST?.trim() || DEFAULT_OLLAMA_HOST_URL;
  const configuredTimeout = env.HF_TIMEOUT_MS || env.OLLAMA_TIMEOUT_MS;
  const timeoutMs = configuredTimeout === undefined
    ? DEFAULT_HF_TIMEOUT_MS
    : Number(configuredTimeout);

  const modelId = provider === 'ollama'
    ? (env.OLLAMA_MODEL?.trim() || DEFAULT_OLLAMA_MODEL_ID)
    : (env.HF_MODEL_ID?.trim() || DEFAULT_HF_MODEL_ID);

  let configurationIssue: string | undefined;
  if (enabled) {
    if (provider === 'huggingface') {
      if (!token) {
        configurationIssue = 'Inference is enabled but HF_TOKEN is missing.';
      } else if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(modelId)) {
        configurationIssue = 'HF_MODEL_ID is invalid.';
      }
    } else if (provider === 'ollama') {
      if (!modelId.trim()) {
        configurationIssue = 'Ollama model ID is missing.';
      } else if (!/^https?:\/\//i.test(ollamaHost)) {
        configurationIssue = 'OLLAMA_HOST must be a valid HTTP or HTTPS URL.';
      }
    }

    if (
      configuredTimeout !== undefined &&
      (!Number.isInteger(timeoutMs) || timeoutMs < MIN_HF_TIMEOUT_MS || timeoutMs > MAX_HF_TIMEOUT_MS)
    ) {
      configurationIssue = 'HF_TIMEOUT_MS must be between 1000 and 30000.';
    }
  }

  return { enabled, provider, token, modelId, ollamaHost, timeoutMs, configurationIssue };
}

export interface EnvConfig {
  nodeEnv: string;
  port: number;
  allowTestHarnessAuth: boolean;
  emailTransport: 'smtp' | 'inmemory' | 'auto';
  emailDeliveryRequired: boolean;
  smtp: SmtpConfig;
  llm: LlmConfig;
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
    llm: getLlmConfig(),
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
