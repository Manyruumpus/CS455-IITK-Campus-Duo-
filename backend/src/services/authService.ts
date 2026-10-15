import crypto from 'node:crypto';
import { query, getClient } from '../config/db';
import { hashPassword, verifyPassword } from './passwordService';
import { defaultEmailService, EmailService } from './emailService';
import {
  DomainError,
  AuthSessionResponse,
  OtpSessionResponse,
  UserSummary,
  RegisterRequest,
  LoginRequest,
  OtpRequestInput,
  OtpVerifyRegistrationInput,
  OtpVerifyLoginInput,
  OtpChallengeResponse
} from '../types';

const IITK_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@iitk\.ac\.in$/;
const OTP_REGEX = /^\d{6}$/;

export function hashOtp(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export class AuthService {
  constructor(private readonly emailService: EmailService = defaultEmailService) {}

  /**
   * Validates that an email address belongs strictly to the @iitk.ac.in domain.
   * Rejects lookalikes, subdomains, empty local-parts, and non-IITK domains.
   */
  public validateIitkEmail(email: unknown): string {
    if (typeof email !== 'string') {
      throw new DomainError(
        'VALIDATION_ERROR',
        400,
        'Email address is required and must be a string.'
      );
    }

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !IITK_EMAIL_REGEX.test(trimmed)) {
      throw new DomainError(
        'VALIDATION_ERROR',
        400,
        'Invalid email address. Registration and authentication are restricted strictly to @iitk.ac.in email addresses.'
      );
    }

    return trimmed;
  }

  /**
   * Step 1 (Registration): Request 6-digit OTP challenge for @iitk.ac.in student registration.
   */
  public async requestRegistrationOtp(input: OtpRequestInput): Promise<OtpChallengeResponse> {
    const email = this.validateIitkEmail(input.email);

    if (!input.displayName || typeof input.displayName !== 'string' || input.displayName.trim().length < 2) {
      throw new DomainError(
        'VALIDATION_ERROR',
        400,
        'Display name must be at least 2 characters long.'
      );
    }
    const displayName = input.displayName.trim();

    const client = await getClient();
    let challengeId: string;
    let otp: string;

    try {
      await client.query('BEGIN');
      // Serialize cooldown check and challenge insertion per email using transaction-scoped advisory lock (F-02)
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('otp_req:' || $1))`, [email]);

      // Check if account already exists
      const existing = await client.query(
        `SELECT user_id FROM campus_duo.user_account WHERE lower(email) = $1`,
        [email]
      );
      if (existing.rows.length > 0) {
        throw new DomainError('CONFLICT', 409, 'An account with this email address already exists.');
      }

      // Rate-limiting / resend cooldown: reject if challenge requested within last 30 seconds
      const recent = await client.query<{ created_at: string }>(
        `SELECT created_at FROM campus_duo.otp_challenge
         WHERE lower(email) = $1 AND purpose = 'REGISTRATION' AND verified_at IS NULL
           AND created_at > (clock_timestamp() - INTERVAL '30 seconds')
         ORDER BY created_at DESC LIMIT 1`,
        [email]
      );
      if (recent.rows.length > 0) {
        throw new DomainError('CONFLICT', 429, 'Please wait 30 seconds before requesting another verification code.');
      }

      // Generate cryptographically secure 6-digit OTP
      otp = crypto.randomInt(100000, 1000000).toString();
      const otpHash = hashOtp(otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const insertResult = await client.query<{ challenge_id: string }>(
        `INSERT INTO campus_duo.otp_challenge (email, otp_hash, purpose, display_name, expires_at)
         VALUES ($1, $2, 'REGISTRATION', $3, $4)
         RETURNING challenge_id`,
        [email, otpHash, displayName, expiresAt.toISOString()]
      );
      challengeId = insertResult.rows[0].challenge_id;

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    try {
      await this.emailService.sendOtpChallenge(email, otp, 'REGISTRATION');
    } catch (err) {
      // Rollback database challenge so user is not locked out by 30-second cooldown
      await query(`DELETE FROM campus_duo.otp_challenge WHERE challenge_id = $1`, [challengeId]);
      throw err;
    }

    return {
      challengeId,
      message: 'Verification code sent to your IITK email address.',
      email,
    };
  }

  /**
   * Step 2 (Registration): Verify OTP challenge, create authentic verified student account,
   * and establish initial authenticated session.
   */
  public async verifyRegistrationOtp(input: OtpVerifyRegistrationInput): Promise<OtpSessionResponse> {
    if (!input.otp || typeof input.otp !== 'string' || !OTP_REGEX.test(input.otp.trim())) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Verification code must be exactly 6 digits.');
    }
    const cleanOtp = input.otp.trim();

    let email: string | undefined;
    if (input.email) {
      email = this.validateIitkEmail(input.email);
    }

    let challengeRes;
    if (input.challengeId) {
      if (email) {
        challengeRes = await query<{
          challenge_id: string;
          email: string;
          otp_hash: string;
          display_name: string;
          attempts: number;
          max_attempts: number;
          expires_at: string;
        }>(
          `SELECT challenge_id, email, otp_hash, display_name, attempts, max_attempts, expires_at
           FROM campus_duo.otp_challenge
           WHERE challenge_id = $1 AND lower(email) = $2 AND purpose = 'REGISTRATION' AND verified_at IS NULL
             AND expires_at > clock_timestamp()`,
          [input.challengeId, email]
        );
      } else {
        challengeRes = await query<{
          challenge_id: string;
          email: string;
          otp_hash: string;
          display_name: string;
          attempts: number;
          max_attempts: number;
          expires_at: string;
        }>(
          `SELECT challenge_id, email, otp_hash, display_name, attempts, max_attempts, expires_at
           FROM campus_duo.otp_challenge
           WHERE challenge_id = $1 AND purpose = 'REGISTRATION' AND verified_at IS NULL
             AND expires_at > clock_timestamp()`,
          [input.challengeId]
        );
      }
    } else if (email) {
      challengeRes = await query<{
        challenge_id: string;
        email: string;
        otp_hash: string;
        display_name: string;
        attempts: number;
        max_attempts: number;
        expires_at: string;
      }>(
        `SELECT challenge_id, email, otp_hash, display_name, attempts, max_attempts, expires_at
         FROM campus_duo.otp_challenge
         WHERE lower(email) = $1 AND purpose = 'REGISTRATION' AND verified_at IS NULL
           AND expires_at > clock_timestamp()
         ORDER BY created_at DESC LIMIT 1`,
        [email]
      );
    } else {
      throw new DomainError('VALIDATION_ERROR', 400, 'Email or challenge ID is required to verify OTP.');
    }

    const challenge = challengeRes.rows[0];
    if (!challenge) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Invalid or expired verification code. Please request a new code.');
    }

    if (challenge.attempts >= challenge.max_attempts) {
      throw new DomainError('FORBIDDEN', 403, 'Maximum verification attempts exceeded. Please request a new code.');
    }

    const expectedHash = challenge.otp_hash;
    const providedHash = hashOtp(cleanOtp);

    let isMatch = crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'),
      Buffer.from(providedHash, 'hex')
    );

    let activeChallenge = challenge;
    // If challengeId was provided but the user entered an OTP from another recent valid challenge for this email,
    // gracefully check other active challenges for this email so slight email receipt delays do not lock the user out
    if (!isMatch && email) {
      const altRes = await query<{
        challenge_id: string;
        email: string;
        otp_hash: string;
        attempts: number;
        max_attempts: number;
        expires_at: string;
        display_name?: string;
      }>(
        `SELECT challenge_id, email, otp_hash, attempts, max_attempts, expires_at, display_name
         FROM campus_duo.otp_challenge
         WHERE challenge_id <> $1 AND lower(email) = $2 AND purpose = 'REGISTRATION' AND verified_at IS NULL
           AND expires_at > clock_timestamp() AND attempts < max_attempts
         ORDER BY created_at DESC`,
        [challenge.challenge_id, email]
      );
      for (const alt of altRes.rows) {
        if (crypto.timingSafeEqual(Buffer.from(alt.otp_hash, 'hex'), Buffer.from(providedHash, 'hex'))) {
          activeChallenge = alt as any;
          isMatch = true;
          break;
        }
      }
    }

    if (!isMatch) {
      const updRes = await query<{ attempts: number; max_attempts: number }>(
        `UPDATE campus_duo.otp_challenge
         SET attempts = attempts + 1
         WHERE challenge_id = $1 AND attempts < max_attempts
         RETURNING attempts, max_attempts`,
        [activeChallenge.challenge_id]
      );
      if (updRes.rowCount === 0) {
        const checkRes = await query<{ attempts: number; max_attempts: number; verified_at: string | null }>(
          `SELECT attempts, max_attempts, verified_at FROM campus_duo.otp_challenge WHERE challenge_id = $1`,
          [activeChallenge.challenge_id]
        );
        const chk = checkRes.rows[0];
        if (chk && chk.attempts >= chk.max_attempts) {
          throw new DomainError('FORBIDDEN', 403, 'Maximum verification attempts exceeded. Please request a new code.');
        }
        if (chk && chk.verified_at) {
          throw new DomainError('VALIDATION_ERROR', 400, 'Verification code has already been used. Please request a new code.');
        }
        throw new DomainError('VALIDATION_ERROR', 400, 'Invalid or expired verification code. Please request a new code.');
      }

      const currentAttempts = updRes.rows[0].attempts;
      const maxAttempts = updRes.rows[0].max_attempts;
      if (currentAttempts >= maxAttempts) {
        throw new DomainError(
          'FORBIDDEN',
          403,
          'Maximum verification attempts exceeded. Please request a new code.'
        );
      }
      const remaining = maxAttempts - currentAttempts;
      throw new DomainError(
        'VALIDATION_ERROR',
        400,
        `Incorrect verification code. ${remaining} attempts remaining.`
      );
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Atomically mark this challenge as verified with replay protection
      const verifyRes = await client.query<{ challenge_id: string }>(
        `UPDATE campus_duo.otp_challenge
         SET verified_at = clock_timestamp()
         WHERE challenge_id = $1 AND verified_at IS NULL AND attempts < max_attempts AND expires_at > clock_timestamp()
         RETURNING challenge_id`,
        [activeChallenge.challenge_id]
      );

      if (verifyRes.rowCount === 0) {
        await client.query('ROLLBACK');
        const checkRes = await query<{ attempts: number; max_attempts: number; verified_at: string | null; expires_at: string }>(
          `SELECT attempts, max_attempts, verified_at, expires_at FROM campus_duo.otp_challenge WHERE challenge_id = $1`,
          [activeChallenge.challenge_id]
        );
        const chk = checkRes.rows[0];
        if (chk && chk.attempts >= chk.max_attempts) {
          throw new DomainError('FORBIDDEN', 403, 'Maximum verification attempts exceeded. Please request a new code.');
        }
        if (chk && chk.verified_at) {
          throw new DomainError('VALIDATION_ERROR', 400, 'Verification code has already been used. Please request a new code.');
        }
        throw new DomainError('VALIDATION_ERROR', 400, 'Invalid or expired verification code. Please request a new code.');
      }

      // Mark other pending registration challenges for this email as verified (single-use replay protection)
      await client.query(
        `UPDATE campus_duo.otp_challenge
         SET verified_at = clock_timestamp()
         WHERE lower(email) = $1 AND purpose = 'REGISTRATION' AND verified_at IS NULL AND challenge_id <> $2`,
        [activeChallenge.email.toLowerCase(), activeChallenge.challenge_id]
      );

      // Call stored procedure register_verified_student
      const regResult = await client.query<{
        out_user_id: string;
        out_email: string;
        out_display_name: string;
        out_role: string;
        out_verification_status: string;
        out_account_status: string;
        out_is_first_login: boolean;
      }>(
        `SELECT * FROM campus_duo.register_verified_student($1, $2)`,
        [activeChallenge.email, activeChallenge.display_name]
      );

      const userRow = regResult.rows[0];
      if (!userRow) {
        throw new DomainError('INTERNAL_ERROR', 500, 'Failed to complete verified student registration.');
      }

      // Issue session token
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await client.query(
        `INSERT INTO campus_duo.auth_session (session_token, user_id, role, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [sessionToken, userRow.out_user_id, userRow.out_role, expiresAt.toISOString()]
      );

      await client.query('COMMIT');

      return {
        user: {
          userId: userRow.out_user_id,
          email: userRow.out_email,
          displayName: userRow.out_display_name,
          role: userRow.out_role,
          accountStatus: userRow.out_account_status,
          verificationStatus: userRow.out_verification_status,
        },
        token: sessionToken,
        expiresAt: expiresAt.toISOString(),
        isFirstLogin: true,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Step 1 (Login): Request 6-digit OTP challenge for existing @iitk.ac.in account.
   */
  public async requestLoginOtp(input: OtpRequestInput): Promise<OtpChallengeResponse> {
    const email = this.validateIitkEmail(input.email);

    const client = await getClient();
    let challengeId: string;
    let otp: string;

    try {
      await client.query('BEGIN');
      // Serialize cooldown check and challenge insertion per email using transaction-scoped advisory lock (F-02)
      await client.query(`SELECT pg_advisory_xact_lock(hashtext('otp_req:' || $1))`, [email]);

      const userRes = await client.query<{
        user_id: string;
        role: string;
        account_status: string;
        verification_status: string;
      }>(
        `SELECT user_id, role, account_status, verification_status
         FROM campus_duo.user_account
         WHERE lower(email) = $1`,
        [email]
      );

      const user = userRes.rows[0];
      if (!user) {
        throw new DomainError('NOT_FOUND', 404, 'No account found with this email address. Please register first.');
      }

      if (user.account_status !== 'ACTIVE') {
        throw new DomainError('FORBIDDEN', 403, 'This account is suspended or inactive. Please contact administration.');
      }

      // Rate-limiting / resend cooldown: reject if challenge requested within last 30 seconds
      const recent = await client.query<{ created_at: string }>(
        `SELECT created_at FROM campus_duo.otp_challenge
         WHERE lower(email) = $1 AND purpose = 'LOGIN' AND verified_at IS NULL
           AND created_at > (clock_timestamp() - INTERVAL '30 seconds')
         ORDER BY created_at DESC LIMIT 1`,
        [email]
      );
      if (recent.rows.length > 0) {
        throw new DomainError('CONFLICT', 429, 'Please wait 30 seconds before requesting another verification code.');
      }

      // Generate 6-digit OTP
      otp = crypto.randomInt(100000, 1000000).toString();
      const otpHash = hashOtp(otp);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      const insertRes = await client.query<{ challenge_id: string }>(
        `INSERT INTO campus_duo.otp_challenge (email, otp_hash, purpose, expires_at)
         VALUES ($1, $2, 'LOGIN', $3)
         RETURNING challenge_id`,
        [email, otpHash, expiresAt.toISOString()]
      );
      challengeId = insertRes.rows[0].challenge_id;

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    try {
      await this.emailService.sendOtpChallenge(email, otp, 'LOGIN');
    } catch (err) {
      // Rollback database challenge so user is not locked out by 30-second cooldown
      await query(`DELETE FROM campus_duo.otp_challenge WHERE challenge_id = $1`, [challengeId]);
      throw err;
    }

    return {
      challengeId,
      message: 'Login verification code sent to your IITK email address.',
      email,
    };
  }

  /**
   * Step 2 (Login): Verify OTP challenge, verify user identity, and issue fresh session token.
   */
  public async verifyLoginOtp(input: OtpVerifyLoginInput): Promise<OtpSessionResponse> {
    if (!input.otp || typeof input.otp !== 'string' || !OTP_REGEX.test(input.otp.trim())) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Verification code must be exactly 6 digits.');
    }
    const cleanOtp = input.otp.trim();

    let email: string | undefined;
    if (input.email) {
      email = this.validateIitkEmail(input.email);
    }

    let challengeRes;
    if (input.challengeId) {
      if (email) {
        challengeRes = await query<{
          challenge_id: string;
          email: string;
          otp_hash: string;
          attempts: number;
          max_attempts: number;
          expires_at: string;
        }>(
          `SELECT challenge_id, email, otp_hash, attempts, max_attempts, expires_at
           FROM campus_duo.otp_challenge
           WHERE challenge_id = $1 AND lower(email) = $2 AND purpose = 'LOGIN' AND verified_at IS NULL
             AND expires_at > clock_timestamp()`,
          [input.challengeId, email]
        );
      } else {
        challengeRes = await query<{
          challenge_id: string;
          email: string;
          otp_hash: string;
          attempts: number;
          max_attempts: number;
          expires_at: string;
        }>(
          `SELECT challenge_id, email, otp_hash, attempts, max_attempts, expires_at
           FROM campus_duo.otp_challenge
           WHERE challenge_id = $1 AND purpose = 'LOGIN' AND verified_at IS NULL
             AND expires_at > clock_timestamp()`,
          [input.challengeId]
        );
      }
    } else if (email) {
      challengeRes = await query<{
        challenge_id: string;
        email: string;
        otp_hash: string;
        attempts: number;
        max_attempts: number;
        expires_at: string;
      }>(
        `SELECT challenge_id, email, otp_hash, attempts, max_attempts, expires_at
         FROM campus_duo.otp_challenge
         WHERE lower(email) = $1 AND purpose = 'LOGIN' AND verified_at IS NULL
           AND expires_at > clock_timestamp()
         ORDER BY created_at DESC LIMIT 1`,
        [email]
      );
    } else {
      throw new DomainError('VALIDATION_ERROR', 400, 'Email or challenge ID is required to verify OTP.');
    }

    const challenge = challengeRes.rows[0];
    if (!challenge) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Invalid or expired verification code. Please request a new code.');
    }

    if (challenge.attempts >= challenge.max_attempts) {
      throw new DomainError('FORBIDDEN', 403, 'Maximum verification attempts exceeded. Please request a new code.');
    }

    const expectedHash = challenge.otp_hash;
    const providedHash = hashOtp(cleanOtp);

    let isMatch = crypto.timingSafeEqual(
      Buffer.from(expectedHash, 'hex'),
      Buffer.from(providedHash, 'hex')
    );

    let activeChallenge = challenge;
    // If challengeId was provided but the user entered an OTP from another recent valid challenge for this email,
    // gracefully check other active challenges for this email so slight email receipt delays do not lock the user out
    if (!isMatch && email) {
      const altRes = await query<{
        challenge_id: string;
        email: string;
        otp_hash: string;
        attempts: number;
        max_attempts: number;
        expires_at: string;
      }>(
        `SELECT challenge_id, email, otp_hash, attempts, max_attempts, expires_at
         FROM campus_duo.otp_challenge
         WHERE challenge_id <> $1 AND lower(email) = $2 AND purpose = 'LOGIN' AND verified_at IS NULL
           AND expires_at > clock_timestamp() AND attempts < max_attempts
         ORDER BY created_at DESC`,
        [challenge.challenge_id, email]
      );
      for (const alt of altRes.rows) {
        if (crypto.timingSafeEqual(Buffer.from(alt.otp_hash, 'hex'), Buffer.from(providedHash, 'hex'))) {
          activeChallenge = alt;
          isMatch = true;
          break;
        }
      }
    }

    if (!isMatch) {
      const updRes = await query<{ attempts: number; max_attempts: number }>(
        `UPDATE campus_duo.otp_challenge
         SET attempts = attempts + 1
         WHERE challenge_id = $1 AND attempts < max_attempts
         RETURNING attempts, max_attempts`,
        [activeChallenge.challenge_id]
      );
      if (updRes.rowCount === 0) {
        const checkRes = await query<{ attempts: number; max_attempts: number; verified_at: string | null }>(
          `SELECT attempts, max_attempts, verified_at FROM campus_duo.otp_challenge WHERE challenge_id = $1`,
          [activeChallenge.challenge_id]
        );
        const chk = checkRes.rows[0];
        if (chk && chk.attempts >= chk.max_attempts) {
          throw new DomainError('FORBIDDEN', 403, 'Maximum verification attempts exceeded. Please request a new code.');
        }
        if (chk && chk.verified_at) {
          throw new DomainError('VALIDATION_ERROR', 400, 'Verification code has already been used. Please request a new code.');
        }
        throw new DomainError('VALIDATION_ERROR', 400, 'Invalid or expired verification code. Please request a new code.');
      }

      const currentAttempts = updRes.rows[0].attempts;
      const maxAttempts = updRes.rows[0].max_attempts;
      if (currentAttempts >= maxAttempts) {
        throw new DomainError(
          'FORBIDDEN',
          403,
          'Maximum verification attempts exceeded. Please request a new code.'
        );
      }
      const remaining = maxAttempts - currentAttempts;
      throw new DomainError(
        'VALIDATION_ERROR',
        400,
        `Incorrect verification code. ${remaining} attempts remaining.`
      );
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');

      // Atomically mark this challenge as verified with replay protection
      const verifyRes = await client.query<{ challenge_id: string }>(
        `UPDATE campus_duo.otp_challenge
         SET verified_at = clock_timestamp()
         WHERE challenge_id = $1 AND verified_at IS NULL AND attempts < max_attempts AND expires_at > clock_timestamp()
         RETURNING challenge_id`,
        [activeChallenge.challenge_id]
      );

      if (verifyRes.rowCount === 0) {
        await client.query('ROLLBACK');
        const checkRes = await query<{ attempts: number; max_attempts: number; verified_at: string | null; expires_at: string }>(
          `SELECT attempts, max_attempts, verified_at, expires_at FROM campus_duo.otp_challenge WHERE challenge_id = $1`,
          [activeChallenge.challenge_id]
        );
        const chk = checkRes.rows[0];
        if (chk && chk.attempts >= chk.max_attempts) {
          throw new DomainError('FORBIDDEN', 403, 'Maximum verification attempts exceeded. Please request a new code.');
        }
        if (chk && chk.verified_at) {
          throw new DomainError('VALIDATION_ERROR', 400, 'Verification code has already been used. Please request a new code.');
        }
        throw new DomainError('VALIDATION_ERROR', 400, 'Invalid or expired verification code. Please request a new code.');
      }

      // Mark other pending login challenges for this email as verified (single-use replay protection)
      await client.query(
        `UPDATE campus_duo.otp_challenge
         SET verified_at = clock_timestamp()
         WHERE lower(email) = $1 AND purpose = 'LOGIN' AND verified_at IS NULL AND challenge_id <> $2`,
        [activeChallenge.email.toLowerCase(), activeChallenge.challenge_id]
      );

      // Retrieve user and update login count
      const userRes = await client.query<{
        user_id: string;
        email: string;
        display_name: string;
        role: string;
        account_status: string;
        verification_status: string;
        login_count: number;
      }>(
        `SELECT user_id, email, display_name, role, account_status, verification_status,
                coalesce(login_count, 0) AS login_count
         FROM campus_duo.user_account
         WHERE lower(email) = $1`,
        [challenge.email]
      );

      const user = userRes.rows[0];
      if (!user) {
        throw new DomainError('NOT_FOUND', 404, 'User account not found.');
      }

      const isFirstLogin = user.login_count === 0;

      await client.query(
        `UPDATE campus_duo.user_account
         SET login_count = coalesce(login_count, 0) + 1,
             last_login_at = clock_timestamp(),
             updated_at = clock_timestamp()
         WHERE user_id = $1`,
        [user.user_id]
      );

      // Issue session token
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await client.query(
        `INSERT INTO campus_duo.auth_session (session_token, user_id, role, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [sessionToken, user.user_id, user.role, expiresAt.toISOString()]
      );

      await client.query('COMMIT');

      return {
        user: {
          userId: user.user_id,
          email: user.email,
          displayName: user.display_name,
          role: user.role,
          accountStatus: user.account_status,
          verificationStatus: user.verification_status,
        },
        token: sessionToken,
        expiresAt: expiresAt.toISOString(),
        isFirstLogin,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Backward-compatible registration handler (accepts password, uses register_verified_student).
   */
  public async registerStudent(request: RegisterRequest): Promise<AuthSessionResponse> {
    const email = this.validateIitkEmail(request.email);

    if (typeof request.displayName !== 'string' || request.displayName.trim().length < 2) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Display name must be at least 2 characters long.');
    }
    const displayName = request.displayName.trim();

    if (request.password !== undefined) {
      if (typeof request.password !== 'string' || request.password.length < 8) {
        throw new DomainError('VALIDATION_ERROR', 400, 'Password must be at least 8 characters long.');
      }
    }

    try {
      const regResult = await query<{
        out_user_id: string;
        out_email: string;
        out_display_name: string;
        out_role: string;
        out_verification_status: string;
        out_account_status: string;
      }>(
        `SELECT * FROM campus_duo.register_verified_student($1, $2)`,
        [email, displayName]
      );

      const userRow = regResult.rows[0];
      if (!userRow) {
        throw new DomainError('INTERNAL_ERROR', 500, 'Failed to complete registration record insertion.');
      }

      if (request.password) {
        const passwordHash = hashPassword(request.password);
        await query(
          `INSERT INTO campus_duo.auth_credential (user_id, password_hash, algorithm)
           VALUES ($1, $2, 'scrypt')
           ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
          [userRow.out_user_id, passwordHash]
        );
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await query(
        `INSERT INTO campus_duo.auth_session (session_token, user_id, role, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [sessionToken, userRow.out_user_id, userRow.out_role, expiresAt.toISOString()]
      );

      return {
        user: {
          userId: userRow.out_user_id,
          email: userRow.out_email,
          displayName: userRow.out_display_name,
          role: userRow.out_role,
          accountStatus: userRow.out_account_status,
          verificationStatus: userRow.out_verification_status,
        },
        token: sessionToken,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (err: any) {
      if (
        err.code === '23505' ||
        err.message?.includes('already registered') ||
        err.message?.includes('user_account_email_uq') ||
        err.message?.includes('duplicate key')
      ) {
        throw new DomainError('CONFLICT', 409, 'An account with this email address already exists.');
      }
      throw err;
    }
  }

  /**
   * Backward-compatible login handler for seeded accounts and legacy tests.
   */
  public async login(request: LoginRequest): Promise<AuthSessionResponse> {
    const email = this.validateIitkEmail(request.email);

    if (typeof request.password !== 'string' || !request.password) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Password is required.');
    }

    const userResult = await query<{
      user_id: string;
      email: string;
      display_name: string;
      role: string;
      account_status: string;
      verification_status: string;
      password_hash: string;
    }>(
      `SELECT u.user_id, u.email, u.display_name, u.role, u.account_status, u.verification_status,
              c.password_hash
       FROM campus_duo.user_account u
       JOIN campus_duo.auth_credential c ON u.user_id = c.user_id
       WHERE LOWER(u.email) = $1`,
      [email]
    );

    const user = userResult.rows[0];
    if (!user) {
      throw new DomainError('UNAUTHENTICATED', 401, 'Invalid email or password credentials.');
    }

    const isValid = verifyPassword(request.password, user.password_hash);
    if (!isValid) {
      throw new DomainError('UNAUTHENTICATED', 401, 'Invalid email or password credentials.');
    }

    await query(
      `UPDATE campus_duo.user_account
       SET login_count = coalesce(login_count, 0) + 1,
           last_login_at = clock_timestamp(),
           updated_at = clock_timestamp()
       WHERE user_id = $1`,
      [user.user_id]
    );

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO campus_duo.auth_session (session_token, user_id, role, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [sessionToken, user.user_id, user.role, expiresAt.toISOString()]
    );

    return {
      user: {
        userId: user.user_id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        accountStatus: user.account_status,
        verificationStatus: user.verification_status,
      },
      token: sessionToken,
      expiresAt: expiresAt.toISOString(),
    };
  }

  public async getMe(userId: string): Promise<UserSummary> {
    const res = await query<UserSummary>(
      `SELECT user_id AS "userId", email, display_name AS "displayName",
              role, account_status AS "accountStatus", verification_status AS "verificationStatus"
       FROM campus_duo.user_account
       WHERE user_id = $1`,
      [userId]
    );

    const user = res.rows[0];
    if (!user) {
      throw new DomainError('NOT_FOUND', 404, 'User identity record not found.');
    }

    return user;
  }

  public async logout(sessionToken: string): Promise<void> {
    await query(
      `DELETE FROM campus_duo.auth_session WHERE session_token = $1`,
      [sessionToken]
    );
  }
}
