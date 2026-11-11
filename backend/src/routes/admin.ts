import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { query } from '../config/db';
import { AdminService } from '../services/adminService';
import { ApiResponse, AdminResourceSummary, AdminTableResource, CampusLocation, StudyTableSlot } from '../types';

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
    const [locationsRes, bookingsRes, usersRes] = await Promise.all([
      query<{ count: string }>('SELECT COUNT(*)::text as count FROM campus_duo.study_location WHERE active = true'),
      query<{ count: string }>('SELECT COUNT(*)::text as count FROM campus_duo.booking'),
      query<{ count: string }>('SELECT COUNT(*)::text as count FROM campus_duo.user_account'),
    ]);

    const response: ApiResponse<{
      systemStatus: string;
      activeLocationsCount: number;
      totalBookingsCount: number;
      totalUsersCount: number;
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
