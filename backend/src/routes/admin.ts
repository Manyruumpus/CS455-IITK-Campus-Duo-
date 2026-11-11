import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { getClient, query } from '../config/db';
import { AdminService } from '../services/adminService';
import { ApiResponse, AdminResourceSummary, AdminTableResource, CampusLocation, DomainError, StudyTableSlot } from '../types';

const router = Router();
const adminService = new AdminService();

// Apply strict authentication and ROLE_ADMIN authorization to all administrative endpoints
router.use(authMiddleware);
router.use(requireRole('ROLE_ADMIN'));

/**
 * GET /api/admin/summary
 * Returns administrative metrics and operational summary.
 * Strictly forbidden (HTTP 403) for students or unauthenticated users.
 */
router.get('/summary', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const [locationsRes, bookingsRes, usersRes, reportsRes, auditRes] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*)::text as count FROM campus_duo.study_location WHERE active = true'),
      query<{ count: string }>('SELECT COUNT(*)::text as count FROM campus_duo.booking'),
      query<{ count: string }>('SELECT COUNT(*)::text as count FROM campus_duo.user_account'),
      query<{ count: string }>(`SELECT COUNT(*)::text as count FROM campus_duo.moderation_report WHERE status = 'PENDING_REVIEW'`),
      query<{ count: string }>('SELECT COUNT(*)::text as count FROM campus_duo.audit_event'),
    ]);

    const response: ApiResponse<{
      systemStatus: string;
      activeLocationsCount: number;
      totalBookingsCount: number;
      totalUsersCount: number;
      pendingReportsCount: number;
      auditEventsCount: number;
      requester: {
        userId: string;
        role: string;
      };
    }> = {
      data: {
        systemStatus: 'OPERATIONAL',
        activeLocationsCount: parseInt(locationsRes.rows[0]?.count || '0', 10),
        totalBookingsCount: parseInt(bookingsRes.rows[0]?.count || '0', 10),
        totalUsersCount: parseInt(usersRes.rows[0]?.count || '0', 10),
        pendingReportsCount: parseInt(reportsRes.rows[0]?.count || '0', 10),
        auditEventsCount: parseInt(auditRes.rows[0]?.count || '0', 10),
        requester: {
          userId: req.actor!.userId,
          role: req.actor!.role,
        },
      },
      requestId: req.requestId || 'req-unknown',
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

router.get('/reports', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : null;
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 50));
    const result = await query(
      `SELECT r.report_id, r.reporter_user_id, r.reported_user_id,
              reported.display_name AS reported_user_name, r.category, r.description,
              r.status, r.reviewed_by, r.reviewed_at, r.review_reason,
              r.audit_event_id, r.created_at
         FROM campus_duo.moderation_report r
         JOIN campus_duo.user_account reported ON reported.user_id = r.reported_user_id
        WHERE ($1::text IS NULL OR r.status = $1)
        ORDER BY r.created_at DESC, r.report_id DESC
        LIMIT $2`,
      [status, limit]
    );
    const data = result.rows.map((row) => ({
      reportId: row.report_id,
      reporterUserId: row.reporter_user_id,
      reportedUserId: row.reported_user_id,
      reportedUserName: row.reported_user_name,
      category: row.category,
      description: row.description || '',
      timestamp: new Date(row.created_at).toISOString(),
      status: row.status,
      reviewedBy: row.reviewed_by || undefined,
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : undefined,
      reviewReason: row.review_reason || undefined,
      auditLogId: row.audit_event_id || undefined,
    }));
    res.status(200).json({ data, requestId: req.requestId || 'req-unknown' });
  } catch (err) {
    next(err);
  }
});

router.post('/reports/:reportId/review', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { action, reason, confirm } = req.body || {};
    if (confirm !== true || typeof reason !== 'string' || reason.trim().length < 1 || reason.trim().length > 500) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Confirmation and a reason of 1-500 characters are required.');
    }
    const statusByAction: Record<string, string> = {
      DISMISS: 'DISMISSED',
      WARN_USER: 'WARNED',
      SUSPEND_USER: 'SUSPENDED',
    };
    const nextStatus = statusByAction[action];
    if (!nextStatus) throw new DomainError('VALIDATION_ERROR', 400, 'Unsupported moderation action.');
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const report = await client.query<{ reported_user_id: string; status: string }>(
        `SELECT reported_user_id, status FROM campus_duo.moderation_report WHERE report_id = $1 FOR UPDATE`,
        [req.params.reportId]
      );
      if (report.rowCount === 0) throw new DomainError('NOT_FOUND', 404, 'Report not found.');
      if (report.rows[0].status !== 'PENDING_REVIEW') {
        throw new DomainError('CONFLICT', 409, 'Only pending reports may be reviewed.');
      }
      const audit = await client.query<{ audit_event_id: string }>(
        `INSERT INTO campus_duo.audit_event
          (actor_user_id, actor_role, action, target_type, target_id, outcome, safe_reason)
         VALUES ($1, 'ROLE_ADMIN', $2, 'MODERATION_REPORT', $3, 'SUCCESS', $4)
         RETURNING audit_event_id`,
        [req.actor!.userId, `REPORT_${nextStatus}`, req.params.reportId, reason.trim()]
      );
      if (nextStatus === 'SUSPENDED') {
        await client.query(
          `UPDATE campus_duo.user_account SET account_status = 'SUSPENDED' WHERE user_id = $1`,
          [report.rows[0].reported_user_id]
        );
      }
      const updated = await client.query(
        `UPDATE campus_duo.moderation_report
            SET status = $1, reviewed_by = $2, reviewed_at = now(),
                review_reason = $3, audit_event_id = $4, updated_at = now()
          WHERE report_id = $5
          RETURNING report_id, reporter_user_id, reported_user_id, category, description,
                    status, reviewed_by, reviewed_at, review_reason, audit_event_id, created_at`,
        [nextStatus, req.actor!.userId, reason.trim(), audit.rows[0].audit_event_id, req.params.reportId]
      );
      await client.query('COMMIT');
      const row = updated.rows[0];
      res.status(200).json({
        data: {
          reportId: row.report_id,
          reporterUserId: row.reporter_user_id,
          reportedUserId: row.reported_user_id,
          category: row.category,
          description: row.description || '',
          status: row.status,
          timestamp: new Date(row.created_at).toISOString(),
          reviewedBy: row.reviewed_by,
          reviewedAt: new Date(row.reviewed_at).toISOString(),
          reviewReason: row.review_reason,
          auditLogId: row.audit_event_id,
        },
        requestId: req.requestId || 'req-unknown',
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

router.get('/users', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const result = await query(
      `SELECT u.user_id, u.display_name, u.role, u.account_status,
              u.onboarding_status,
              COALESCE(bool_or(c.mode = 'STUDY' AND c.has_consent), false) AS study_consent,
              COALESCE(bool_or(c.mode = 'SOCIAL' AND c.has_consent), false) AS social_consent
         FROM campus_duo.user_account u
         LEFT JOIN campus_duo.consent_record c ON c.user_id = u.user_id
        WHERE ($1 = '' OR u.user_id::text = $1 OR u.display_name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%')
        GROUP BY u.user_id
        ORDER BY u.display_name, u.user_id
        LIMIT 100`,
      [search]
    );
    const data = result.rows.map((row) => ({
      userId: row.user_id,
      displayName: row.display_name,
      role: row.role,
      status: row.account_status === 'ACTIVE' && row.onboarding_status !== 'COMPLETED' ? 'ONBOARDED_INCOMPLETE' : row.account_status,
      studyConsent: Boolean(row.study_consent),
      socialConsent: Boolean(row.social_consent),
    }));
    res.status(200).json({ data, requestId: req.requestId || 'req-unknown' });
  } catch (err) {
    next(err);
  }
});

router.post('/users/:userId/status', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, reason, confirm } = req.body || {};
    if (confirm !== true || !['ACTIVE', 'SUSPENDED', 'DEACTIVATED'].includes(status) || typeof reason !== 'string' || reason.trim().length < 1 || reason.trim().length > 500) {
      throw new DomainError('VALIDATION_ERROR', 400, 'A supported status, confirmation, and reason of 1-500 characters are required.');
    }
    if (req.params.userId === req.actor!.userId) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Administrators cannot change their own account status.');
    }
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        `UPDATE campus_duo.user_account SET account_status = $1 WHERE user_id = $2 RETURNING user_id, account_status`,
        [status, req.params.userId]
      );
      if (updated.rowCount === 0) throw new DomainError('NOT_FOUND', 404, 'User not found.');
      await client.query(
        `INSERT INTO campus_duo.audit_event
          (actor_user_id, actor_role, action, target_type, target_id, outcome, safe_reason)
         VALUES ($1, 'ROLE_ADMIN', 'ACCOUNT_STATUS_CHANGED', 'USER', $2, 'SUCCESS', $3)`,
        [req.actor!.userId, req.params.userId, reason.trim()]
      );
      await client.query('COMMIT');
      res.status(200).json({ data: { userId: req.params.userId, status }, requestId: req.requestId || 'req-unknown' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    next(err);
  }
});

router.get('/audit-logs', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const result = await query(
      `SELECT audit_event_id, actor_user_id, actor_role, action, target_type,
              outcome, correlation_id, safe_reason, details, occurred_at
         FROM campus_duo.audit_event
        ORDER BY occurred_at DESC, audit_event_id DESC
        LIMIT $1`,
      [limit]
    );
    const data = result.rows.map((row) => ({
      logId: row.audit_event_id,
      adminId: row.actor_user_id,
      actorRole: row.actor_role,
      action: row.action,
      targetEntity: row.target_type,
      targetType: row.target_type,
      outcome: row.outcome,
      correlationId: row.correlation_id || undefined,
      safeReason: row.safe_reason || undefined,
      details: row.details ? JSON.stringify(row.details) : '',
      timestamp: new Date(row.occurred_at).toISOString(),
    }));
    res.status(200).json({ data, requestId: req.requestId || 'req-unknown' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/resources
 * Returns location summaries with tableCount and future confirmed bookings count.
 */
router.get('/resources', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const resources = await adminService.listResources();
    const response: ApiResponse<AdminResourceSummary[]> = {
      data: resources,
      requestId: req.requestId || 'req-unknown',
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/locations/:locationId
 */
router.get('/locations/:locationId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const location = await adminService.getLocation(req.params.locationId);
    const response: ApiResponse<CampusLocation> = {
      data: location,
      requestId: req.requestId || 'req-unknown',
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/locations
 * Creates a new campus study location.
 */
router.post('/locations', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const location = await adminService.createLocation(req.body);
    const response: ApiResponse<CampusLocation> = {
      data: location,
      requestId: req.requestId || 'req-unknown',
    };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/locations/:locationId
 * Updates location details and safely reconciles table inventory when totalTables is modified.
 */
router.put('/locations/:locationId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const location = await adminService.updateLocation(req.params.locationId, req.body);
    const response: ApiResponse<CampusLocation> = {
      data: location,
      requestId: req.requestId || 'req-unknown',
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/locations/:locationId/deactivate
 */
router.post('/locations/:locationId/deactivate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await adminService.deactivateLocation(req.params.locationId, req.body?.reason);
    const response: ApiResponse<{ success: boolean; message: string }> = {
      data: { success: true, message: `Location ${req.params.locationId} deactivated` },
      requestId: req.requestId || 'req-unknown',
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/tables
 * Lists two-person study tables.
 */
router.get('/tables', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const locationId = typeof req.query.locationId === 'string' ? req.query.locationId : undefined;
    const tables = await adminService.listTables(locationId);
    const response: ApiResponse<AdminTableResource[]> = {
      data: tables,
      requestId: req.requestId || 'req-unknown',
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/tables
 * Adds a new table to a location.
 */
router.post('/tables', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const table = await adminService.createTable(req.body);
    const response: ApiResponse<AdminTableResource> = {
      data: table,
      requestId: req.requestId || 'req-unknown',
    };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/tables/:tableId
 */
router.put('/tables/:tableId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const table = await adminService.updateTable(req.params.tableId, req.body);
    const response: ApiResponse<AdminTableResource> = {
      data: table,
      requestId: req.requestId || 'req-unknown',
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/tables/:tableId/status
 */
router.post('/tables/:tableId/status', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { active, reason } = req.body;
    await adminService.setTableActive(req.params.tableId, Boolean(active), reason);
    const response: ApiResponse<{ success: boolean }> = {
      data: { success: true },
      requestId: req.requestId || 'req-unknown',
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/slots
 * Lists fixed study slots.
 */
router.get('/slots', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const locationId = typeof req.query.locationId === 'string' ? req.query.locationId : undefined;
    const tableId = typeof req.query.tableId === 'string' ? req.query.tableId : undefined;
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;

    const slots = await adminService.listSlots(locationId, tableId, date);
    const response: ApiResponse<StudyTableSlot[]> = {
      data: slots,
      requestId: req.requestId || 'req-unknown',
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/slots
 * Creates a fixed slot with overlap & opening hour guards.
 */
router.post('/slots', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const slot = await adminService.createSlot(req.body);
    const response: ApiResponse<StudyTableSlot> = {
      data: slot,
      requestId: req.requestId || 'req-unknown',
    };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/admin/slots/:slotId
 */
router.put('/slots/:slotId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const slot = await adminService.updateSlot(req.params.slotId, req.body);
    const response: ApiResponse<StudyTableSlot> = {
      data: slot,
      requestId: req.requestId || 'req-unknown',
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/slots/:slotId/status
 */
router.post('/slots/:slotId/status', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { active, reason } = req.body;
    await adminService.setSlotActive(req.params.slotId, Boolean(active), reason);
    const response: ApiResponse<{ success: boolean }> = {
      data: { success: true },
      requestId: req.requestId || 'req-unknown',
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/bookings
 * Retrieves all bookings across the campus with full participant, location, and slot metadata.
 * Filterable by status and search text. Strictly restricted to ROLE_ADMIN.
 */
router.get('/bookings', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const limitParam = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 100;

    const bookings = await adminService.listAllBookings(status, search, isNaN(limitParam) ? 100 : limitParam);
    const response: ApiResponse<any[]> = {
      data: bookings,
      requestId: req.requestId || 'req-unknown',
    };
    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
