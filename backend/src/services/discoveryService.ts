import { query } from '../config/db';
import {
  ActorContext,
  DiscoveryMode,
  DiscoveryActionType,
  DiscoveryActionResult,
  ConnectionSummary,
  DomainError,
  RelationshipStatus
} from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class DiscoveryService {
  /**
   * Persists a directional discovery action (LIKE, PASS, HIDE) in PostgreSQL.
   * If reciprocal LIKE exists in STUDY mode, atomically creates or activates
   * exactly one MUTUAL_CONNECTED connection via campus_duo.record_discovery_action.
   */
  public async recordAction(
    actor: ActorContext,
    targetUserId: string,
    mode: DiscoveryMode,
    actionType: DiscoveryActionType
  ): Promise<DiscoveryActionResult> {
    if (!targetUserId || !UUID_REGEX.test(targetUserId)) {
      throw new DomainError('VALIDATION_ERROR', 400, 'targetUserId must be a valid UUID');
    }

    if (actor.userId.toLowerCase() === targetUserId.toLowerCase()) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Cannot perform discovery action on yourself');
    }

    if (!mode || (mode !== 'STUDY' && mode !== 'SOCIAL')) {
      throw new DomainError('VALIDATION_ERROR', 400, 'mode must be either STUDY or SOCIAL');
    }

    if (!actionType || (actionType !== 'LIKE' && actionType !== 'PASS' && actionType !== 'HIDE')) {
      throw new DomainError('VALIDATION_ERROR', 400, 'actionType must be LIKE, PASS, or HIDE');
    }

    try {
      const res = await query<{
        out_action_id: string;
        out_actor_id: string;
        out_target_id: string;
        out_mode: string;
        out_action_type: string;
        out_relationship_status: string;
        out_connection_id: string | null;
      }>(
        `SELECT * FROM campus_duo.record_discovery_action($1, $2, $3, $4)`,
        [actor.userId, targetUserId, mode, actionType]
      );

      const row = res.rows[0];
      if (!row) {
        throw new DomainError('INTERNAL_ERROR', 500, 'Failed to record discovery action');
      }

      return {
        actionId: row.out_action_id,
        actorUserId: row.out_actor_id,
        targetUserId: row.out_target_id,
        mode: row.out_mode as DiscoveryMode,
        actionType: row.out_action_type as DiscoveryActionType,
        relationshipStatus: row.out_relationship_status as RelationshipStatus,
        connectionId: row.out_connection_id || null
      };
    } catch (err: any) {
      if (err instanceof DomainError) throw err;
      if (err.message?.includes('block exists')) {
        throw new DomainError('FORBIDDEN', 403, 'An active block exists between participants');
      }
      throw err;
    }
  }

  /**
   * Retrieves active connections for the authenticated actor.
   * Based on DB-05 queries/05_connections.sql contract.
   */
  public async getMyConnections(
    actor: ActorContext,
    mode?: DiscoveryMode
  ): Promise<ConnectionSummary[]> {
    const sql = `
      SELECT
          c.connection_id,
          c.mode,
          c.status,
          c.created_at,
          c.updated_at,
          peer.user_id AS peer_id,
          peer.display_name AS peer_display_name,
          peer.department AS peer_department
      FROM campus_duo.connection c
      JOIN campus_duo.user_account peer
        ON peer.user_id = CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END
      WHERE (c.user_a_id = $1 OR c.user_b_id = $1)
        AND ($2::text IS NULL OR c.mode = $2)
      ORDER BY c.updated_at DESC, c.connection_id DESC;
    `;

    const res = await query<{
      connection_id: string;
      mode: string;
      status: string;
      created_at: string;
      updated_at: string;
      peer_id: string;
      peer_display_name: string;
      peer_department: string | null;
    }>(sql, [actor.userId, mode || null]);

    return res.rows.map((r): ConnectionSummary => ({
      connectionId: r.connection_id,
      peerId: r.peer_id,
      peerDisplayName: r.peer_display_name || 'Study Partner',
      peerDepartment: r.peer_department || undefined,
      mode: r.mode as DiscoveryMode,
      status: r.status as RelationshipStatus,
      createdAt: typeof r.created_at === 'string' ? r.created_at : new Date(r.created_at).toISOString(),
      updatedAt: typeof r.updated_at === 'string' ? r.updated_at : new Date(r.updated_at).toISOString()
    }));
  }
}
