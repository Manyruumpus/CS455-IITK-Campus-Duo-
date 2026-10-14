import { Router, Request, Response, NextFunction } from 'express';
import { BookingService } from '../services/bookingService';
import { testAuthMiddleware } from '../middleware/auth';
import { ApiResponse, BookingRecord, StudyTableSlot } from '../types';

const router = Router();
const bookingService = new BookingService();

/**
 * GET /api/booking/availability
 * DB-06 availability query contract.
 * Parameters: date (or startDate & endDate), locationId (optional), limit (optional, 1..100).
 */
router.get(
  '/availability',
  testAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dateParam = typeof req.query.date === 'string' ? req.query.date : undefined;
      const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : dateParam;
      const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : dateParam;
      const locationId = typeof req.query.locationId === 'string' ? req.query.locationId : null;
      const limitParam = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 100;

      const slots = await bookingService.getAvailability(
        startDate || '',
        endDate || '',
        locationId,
        isNaN(limitParam) ? 100 : limitParam
      );

      const response: ApiResponse<StudyTableSlot[]> = {
        data: slots,
        requestId: req.requestId || 'req-unknown'
      };

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/booking
 * Transactional booking creation with idempotency and resource conflict guards.
 */
router.post(
  '/',
  testAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.actor!;
      const requestId = req.requestId || 'req-unknown';

      const result = await bookingService.createBooking(actor, req.body, requestId);

      const response: ApiResponse<BookingRecord> = {
        data: result.record,
        operationId: req.body.clientOperationId,
        requestId
      };

      // If identical replay, return 200 or 201; standard creation returns 201 Created
      const statusCode = result.isReplay ? 200 : 201;
      res.status(statusCode).json(response);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
