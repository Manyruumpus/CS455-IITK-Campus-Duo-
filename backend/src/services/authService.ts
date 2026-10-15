import crypto from 'node:crypto';
import { query } from '../config/db';
import { hashPassword, verifyPassword } from './passwordService';
import { DomainError, AuthSessionResponse, UserSummary, RegisterRequest, LoginRequest } from '../types';

const IITK_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@iitk\.ac\.in$/;

export class AuthService {
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
   * Registers a new student account with @iitk.ac.in email.
   * Strictly enforces ROLE_STUDENT and delegates atomic account creation
   * to the database security definer procedure register_student.
   */
  public async registerStudent(request: RegisterRequest): Promise<AuthSessionResponse> {
    const email = this.validateIitkEmail(request.email);

    if (typeof request.displayName !== 'string' || request.displayName.trim().length < 2) {
      throw new DomainError(
        'VALIDATION_ERROR',
        400,
        'Display name must be at least 2 characters long.'
      );
    }
    const displayName = request.displayName.trim();

    if (typeof request.password !== 'string' || request.password.length < 8) {
      throw new DomainError(
        'VALIDATION_ERROR',
        400,
        'Password must be at least 8 characters long.'
      );
    }

    const passwordHash = hashPassword(request.password);

    try {
      const regResult = await query<{
        out_user_id: string;
        out_email: string;
        out_display_name: string;
        out_role: string;
        out_verification_status: string;
        out_account_status: string;
      }>(
        `SELECT * FROM campus_duo.register_student($1, $2, $3)`,
        [email, displayName, passwordHash]
      );

      const userRow = regResult.rows[0];
      if (!userRow) {
        throw new DomainError('INTERNAL_ERROR', 500, 'Failed to complete registration record insertion.');
      }

      // Establish session
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

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
   * Authenticates an existing user account by @iitk.ac.in email and password.
   * Returns a fresh session token upon successful credential verification.
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

    if (userResult.rows.length === 0) {
      throw new DomainError('UNAUTHENTICATED', 401, 'Invalid email or password.');
    }

    const user = userResult.rows[0];

    if (user.account_status !== 'ACTIVE' || user.verification_status !== 'VERIFIED') {
      throw new DomainError('UNAUTHENTICATED', 401, 'Account is inactive or pending institutional verification.');
    }

    const isMatch = verifyPassword(request.password, user.password_hash);
    if (!isMatch) {
      throw new DomainError('UNAUTHENTICATED', 401, 'Invalid email or password.');
    }

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

  /**
   * Retrieves current authenticated user record by user UUID.
   */
  public async getMe(userId: string): Promise<UserSummary> {
    const result = await query<{
      user_id: string;
      email: string;
      display_name: string;
      role: string;
      account_status: string;
      verification_status: string;
    }>(
      `SELECT user_id, email, display_name, role, account_status, verification_status
       FROM campus_duo.user_account
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new DomainError('NOT_FOUND', 404, 'User account not found.');
    }

    const row = result.rows[0];
    return {
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      accountStatus: row.account_status,
      verificationStatus: row.verification_status,
    };
  }

  /**
   * Invalidates an active session token.
   */
  public async logout(sessionToken: string): Promise<void> {
    await query(
      `DELETE FROM campus_duo.auth_session WHERE session_token = $1`,
      [sessionToken]
    );
  }
}
