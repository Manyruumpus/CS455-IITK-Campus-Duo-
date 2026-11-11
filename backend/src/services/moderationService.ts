import { getClient, query } from '../config/db';
import { ActorContext, DomainError } from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES = new Set([
  'HARASSMENT',
  'UNAUTHORIZED_PROMOTION',
  'ACADEMIC_DISHONESTY',
  'IMPERSONATION',
  'OTHER',
]);

export class ModerationService {
  async setBlock(actor: ActorContext, targetUserId: string, active: boolean): Promise<{ blocked: boolean }> {
    if (!UUID_REGEX.test(targetUserId) || actor.userId.toLowerCase() === targetUserId.toLowerCase()) {
      throw new DomainError('VALIDATION_ERROR', 400, 'A valid non-self target is required.');
    }
    const target = await query<{ user_id: string }>(
      `SELECT user_id FROM campus_duo.user_account
        WHERE user_id = $1 AND account_status = 'ACTIVE' AND verification_status = 'VERIFIED'`,
      [targetUserId]
    );
    if (target.rowCount === 0) throw new DomainError('NOT_FOUND', 404, 'Target account not found.');

    const client = await getClient();
    try {
      await client.query('BEGIN');
      if (active) {
        await client.query(
          `INSERT INTO campus_duo.block (actor_user_id, target_user_id, active, policy_version)
           VALUES ($1, $2, true, 'MVP-1')
           ON CONFLICT (actor_user_id, target_user_id) WHERE active
           DO UPDATE SET active = true, revoked_at = NULL`,
          [actor.userId, targetUserId]
        );
      } else {
        await client.query(
          `UPDATE campus_duo.block
              SET active = false, revoked_at = now()
            WHERE actor_user_id = $1 AND target_user_id = $2 AND active = true`,
          [actor.userId, targetUserId]
        );
      }
      await client.query(
        `INSERT INTO campus_duo.audit_event
          (actor_user_id, actor_role, action, target_type, target_id, outcome, safe_reason)
         VALUES ($1, $2, $3, 'USER', $4, 'SUCCESS', $5)`,
        [actor.userId, actor.role, active ? 'BLOCK_USER' : 'UNBLOCK_USER', targetUserId, `User ${active ? 'blocked' : 'unblocked'} another account`]
      );
      await client.query('COMMIT');
      return { blocked: active };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listBlocked(actor: ActorContext): Promise<string[]> {
    const result = await query<{ target_user_id: string }>(
      `SELECT target_user_id
         FROM campus_duo.block
        WHERE actor_user_id = $1 AND active = true
        ORDER BY created_at DESC, target_user_id`,
      [actor.userId]
    );
    return result.rows.map((row) => row.target_user_id);
  }

  async submitReport(
    actor: ActorContext,
    reportedUserId: string,
    category: string,
    description?: string
  ) {
    if (!UUID_REGEX.test(reportedUserId) || actor.userId.toLowerCase() === reportedUserId.toLowerCase()) {
      throw new DomainError('VALIDATION_ERROR', 400, 'A valid non-self target is required.');
    }
    if (!CATEGORIES.has(category) || !description || description.trim().length < 1 || description.trim().length > 500) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Report category and a description of 1-500 characters are required.');
    }
    const target = await query<{ user_id: string }>(
      `SELECT user_id FROM campus_duo.user_account WHERE user_id = $1`,
      [reportedUserId]
    );
    if (target.rowCount === 0) throw new DomainError('NOT_FOUND', 404, 'Reported account not found.');

    const result = await query<{
      report_id: string;
      reporter_user_id: string;
      reported_user_id: string;
      status: string;
      created_at: string;
    }>(
      `WITH inserted AS (
         INSERT INTO campus_duo.moderation_report
           (reporter_user_id, reported_user_id, category, description)
         VALUES ($1, $2, $3, $4)
         RETURNING report_id, reporter_user_id, reported_user_id, status, created_at
       )
       SELECT * FROM inserted`,
      [actor.userId, reportedUserId, category, description.trim()]
    );
    const row = result.rows[0];
    return {
      reportId: row.report_id,
      reporterUserId: row.reporter_user_id,
      reportedUserId: row.reported_user_id,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  async listMyReports(actor: ActorContext) {
    const result = await query<{
      report_id: string;
      reporter_user_id: string;
      reported_user_id: string;
      status: string;
      created_at: string;
    }>(
      `SELECT report_id, reporter_user_id, reported_user_id, status, created_at
         FROM campus_duo.moderation_report
        WHERE reporter_user_id = $1
        ORDER BY created_at DESC, report_id DESC
        LIMIT 50`,
      [actor.userId]
    );
    return result.rows.map((row) => ({
      reportId: row.report_id,
      reporterUserId: row.reporter_user_id,
      reportedUserId: row.reported_user_id,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }
}
