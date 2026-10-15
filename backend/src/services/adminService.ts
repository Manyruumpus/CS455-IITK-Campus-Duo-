import { PoolClient } from 'pg';
import { getDbPool } from '../config/db';
import { AdminRepository } from '../repository/adminRepo';
import {
  AdminResourceSummary,
  AdminTableResource,
  CampusLocation,
  StudyTableSlot,
  AdminLocationCreateRequest,
  AdminLocationUpdateRequest,
  AdminTableCreateRequest,
  AdminTableUpdateRequest,
  AdminSlotCreateRequest,
  AdminSlotUpdateRequest,
  DomainError,
} from '../types';

function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return -1;
  return parts[0] * 60 + parts[1];
}

export class AdminService {
  private readonly repo: AdminRepository;

  constructor(repo?: AdminRepository) {
    this.repo = repo || new AdminRepository();
  }

  async listResources(): Promise<AdminResourceSummary[]> {
    return this.repo.listResources();
  }

  async getLocation(locationId: string): Promise<CampusLocation> {
    const location = await this.repo.getLocationById(locationId);
    if (!location) {
      throw new DomainError('NOT_FOUND', 404, `Location ${locationId} not found`);
    }
    return location;
  }

  async createLocation(data: AdminLocationCreateRequest): Promise<CampusLocation> {
    if (!data.name || !data.name.trim()) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Location name is required');
    }
    if (!data.building || !data.building.trim()) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Building is required');
    }
    if (!data.openTime || !data.closeTime) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Operating hours (openTime and closeTime) are required');
    }

    const openMin = timeToMinutes(data.openTime);
    const closeMin = timeToMinutes(data.closeTime);
    if (openMin < 0 || closeMin < 0 || openMin >= closeMin) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Operating hours invalid: openTime must be before closeTime');
    }

    const pool = getDbPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const location = await this.repo.createLocation(data, client);

      const tableCount = data.totalTables !== undefined ? Math.max(0, data.totalTables) : 1;
      for (let i = 1; i <= tableCount; i++) {
        const tableNumber = `T-${String(i).padStart(2, '0')}`;
        await this.repo.createTable({ locationId: location.id, tableNumber }, client);
      }

      await client.query('COMMIT');
      return { ...location, totalTables: tableCount };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updateLocation(locationId: string, data: AdminLocationUpdateRequest): Promise<CampusLocation> {
    const existing = await this.repo.getLocationById(locationId);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 404, `Location ${locationId} not found`);
    }

    if (data.name !== undefined && !data.name.trim()) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Location name cannot be blank');
    }
    if (data.building !== undefined && !data.building.trim()) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Building cannot be blank');
    }

    const openTime = data.openTime ?? existing.openTime;
    const closeTime = data.closeTime ?? existing.closeTime;
    const openMin = timeToMinutes(openTime);
    const closeMin = timeToMinutes(closeTime);
    if (openMin < 0 || closeMin < 0 || openMin >= closeMin) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Operating hours invalid: openTime must be before closeTime');
    }

    const pool = getDbPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Reconcile totalTables if specified
      if (data.totalTables !== undefined && Number.isInteger(data.totalTables) && data.totalTables >= 0) {
        const targetCount = data.totalTables;
        const currentTables = await this.repo.getTablesForLocation(locationId, client);
        const activeTables = currentTables.filter((t) => t.active);
        const currentActiveCount = activeTables.length;

        if (targetCount > currentActiveCount) {
          // Increase table count
          let needed = targetCount - currentActiveCount;
          // Reactivate inactive tables first
          const inactiveTables = currentTables.filter((t) => !t.active);
          for (const inactive of inactiveTables) {
            if (needed <= 0) break;
            await this.repo.updateTable(inactive.tableId, { active: true }, client);
            needed--;
          }

          // If still needed, create new tables
          if (needed > 0) {
            // Find highest existing numeric suffix or start from count + 1
            let nextNum = currentTables.length + 1;
            for (let i = 0; i < needed; i++) {
              let candidateNum = `T-${String(nextNum).padStart(2, '0')}`;
              while (currentTables.some((t) => t.tableNumber === candidateNum)) {
                nextNum++;
                candidateNum = `T-${String(nextNum).padStart(2, '0')}`;
              }
              await this.repo.createTable({ locationId, tableNumber: candidateNum }, client);
              nextNum++;
            }
          }
        } else if (targetCount < currentActiveCount) {
          // Decrease table count: Must not delete tables or invalidate existing bookings!
          const toDeactivateCount = currentActiveCount - targetCount;

          // Find tables that have NO bookings in campus_duo.booking
          const unbookedSql = `
            SELECT t.table_id
            FROM campus_duo.study_table t
            WHERE t.location_id = $1
              AND t.active = true
              AND t.table_id NOT IN (
                SELECT DISTINCT table_id FROM campus_duo.booking
              )
              AND t.table_id NOT IN (
                SELECT DISTINCT s.table_id
                FROM campus_duo.study_slot s
                JOIN campus_duo.booking b ON s.slot_id = b.slot_id
                WHERE b.status = 'CONFIRMED'
              )
            ORDER BY t.table_number DESC;
          `;
          const unbookedRes = await client.query<{ table_id: string }>(unbookedSql, [locationId]);
          const eligibleTables = unbookedRes.rows;

          if (eligibleTables.length < toDeactivateCount) {
            throw new DomainError(
              'CONFLICT',
              409,
              `Cannot reduce table count to ${targetCount}: only ${currentActiveCount - eligibleTables.length} tables have active or past bookings. Deactivating booked tables is prohibited.`
            );
          }

          // Deactivate eligible tables
          for (let i = 0; i < toDeactivateCount; i++) {
            const tableId = eligibleTables[i].table_id;
            await this.repo.updateTable(tableId, { active: false }, client);
            // Also deactivate any future unbooked slots for this table
            await client.query(
              `UPDATE campus_duo.study_slot
               SET active = false, status = 'LOCKED_MAINTENANCE'
               WHERE table_id = $1 AND local_date >= CURRENT_DATE`,
              [tableId]
            );
          }
        }
      }

      const updated = await this.repo.updateLocation(locationId, data, client);
      await client.query('COMMIT');
      return updated;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async deactivateLocation(locationId: string, reason?: string): Promise<void> {
    const existing = await this.repo.getLocationById(locationId);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 404, `Location ${locationId} not found`);
    }

    const futureBookings = await this.repo.countFutureBookingsForLocation(locationId);
    if (futureBookings > 0) {
      throw new DomainError(
        'CONFLICT',
        409,
        `Cannot deactivate location "${existing.name}": ${futureBookings} future confirmed bookings exist. Bookings are never silently cancelled.`
      );
    }

    const pool = getDbPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await this.repo.updateLocation(locationId, { active: false }, client);
      // Deactivate tables
      await client.query(
        `UPDATE campus_duo.study_table SET active = false WHERE location_id = $1`,
        [locationId]
      );
      // Deactivate future slots
      await client.query(
        `UPDATE campus_duo.study_slot SET active = false, status = 'LOCKED_MAINTENANCE' WHERE location_id = $1 AND local_date >= CURRENT_DATE`,
        [locationId]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listTables(locationId?: string): Promise<AdminTableResource[]> {
    return this.repo.listTables(locationId);
  }

  async createTable(data: AdminTableCreateRequest): Promise<AdminTableResource> {
    if (!data.locationId) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Location ID is required to add a table');
    }

    const location = await this.repo.getLocationById(data.locationId);
    if (!location) {
      throw new DomainError('NOT_FOUND', 404, `Parent location ${data.locationId} not found`);
    }
    if (!location.active) {
      throw new DomainError('CONFLICT', 409, `Cannot add a table to inactive location "${location.name}"`);
    }

    const currentTables = await this.repo.getTablesForLocation(data.locationId);

    let tableNumber = data.tableNumber?.trim();
    if (!tableNumber) {
      // Auto-generate next available table number
      // Inspect existing pattern
      let maxNum = 0;
      for (const t of currentTables) {
        const match = t.tableNumber.match(/\d+/);
        if (match) {
          const n = parseInt(match[0], 10);
          if (n > maxNum) maxNum = n;
        }
      }
      let candidate = `T-${String(maxNum + 1).padStart(2, '0')}`;
      while (currentTables.some((t) => t.tableNumber === candidate)) {
        maxNum++;
        candidate = `T-${String(maxNum + 1).padStart(2, '0')}`;
      }
      tableNumber = candidate;
    } else {
      const duplicate = currentTables.find(
        (t) => t.tableNumber.toLowerCase() === tableNumber!.toLowerCase() && t.active
      );
      if (duplicate) {
        throw new DomainError(
          'CONFLICT',
          409,
          `Table number "${tableNumber}" already exists in location "${location.name}"`
        );
      }
    }

    return this.repo.createTable({
      locationId: data.locationId,
      tableNumber,
      hasPowerOutlets: data.hasPowerOutlets ?? location.hasPowerOutlets,
    });
  }

  async updateTable(tableId: string, data: AdminTableUpdateRequest): Promise<AdminTableResource> {
    const existing = await this.repo.getTableById(tableId);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 404, `Table ${tableId} not found`);
    }

    if (data.active === false && existing.active) {
      const futureBookings = await this.repo.countFutureBookingsForTable(tableId);
      if (futureBookings > 0) {
        throw new DomainError(
          'CONFLICT',
          409,
          `Cannot deactivate table "${existing.tableNumber}": ${futureBookings} future confirmed bookings exist.`
        );
      }
    }

    return this.repo.updateTable(tableId, data);
  }

  async setTableActive(tableId: string, active: boolean, reason?: string): Promise<void> {
    await this.updateTable(tableId, { active });
  }

  async listSlots(locationId?: string, tableId?: string, date?: string): Promise<StudyTableSlot[]> {
    return this.repo.listSlots(locationId, tableId, date);
  }

  async createSlot(data: AdminSlotCreateRequest): Promise<StudyTableSlot> {
    if (!data.locationId) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Location ID is required');
    }
    if (!data.tableId) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Table ID is required');
    }
    if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
      throw new DomainError('VALIDATION_ERROR', 400, 'A valid date (YYYY-MM-DD) is required');
    }
    if (!data.startTime || !data.endTime) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Start time and end time are required');
    }

    const startMin = timeToMinutes(data.startTime);
    const endMin = timeToMinutes(data.endTime);
    if (startMin < 0 || endMin < 0 || startMin >= endMin) {
      throw new DomainError('VALIDATION_ERROR', 400, 'Start time must be before end time');
    }

    const location = await this.repo.getLocationById(data.locationId);
    if (!location) {
      throw new DomainError('NOT_FOUND', 404, `Location ${data.locationId} not found`);
    }
    if (!location.active) {
      throw new DomainError('CONFLICT', 409, `Cannot create slots in inactive location "${location.name}"`);
    }

    // Validate slot falls within operating hours
    const locOpenMin = timeToMinutes(location.openTime);
    const locCloseMin = timeToMinutes(location.closeTime);
    if (startMin < locOpenMin || endMin > locCloseMin) {
      throw new DomainError(
        'VALIDATION_ERROR',
        400,
        `Slot time window ${data.startTime}–${data.endTime} must fall within location operating hours (${location.openTime.slice(0, 5)}–${location.closeTime.slice(0, 5)})`
      );
    }

    const table = await this.repo.getTableById(data.tableId);
    if (!table) {
      throw new DomainError('NOT_FOUND', 404, `Table ${data.tableId} not found`);
    }
    if (!table.active) {
      throw new DomainError('CONFLICT', 409, `Cannot create slots on inactive table "${table.tableNumber}"`);
    }
    if (table.locationId.toLowerCase() !== data.locationId.toLowerCase()) {
      throw new DomainError('VALIDATION_ERROR', 400, `Table ${table.tableNumber} does not belong to location ${location.name}`);
    }

    // Check overlap
    const hasOverlap = await this.repo.checkSlotOverlap(data.tableId, data.date, data.startTime, data.endTime);
    if (hasOverlap) {
      throw new DomainError(
        'CONFLICT',
        409,
        `Fixed-slot definition overlaps an existing slot on table ${table.tableNumber} on ${data.date}`
      );
    }

    const created = await this.repo.createSlot({
      ...data,
      tableNumber: table.tableNumber,
      zone: data.zone ?? 'COLLABORATIVE_STUDY',
      status: data.status ?? 'AVAILABLE',
    });

    return {
      ...created,
      locationName: location.name,
      building: location.building,
      tableNumber: table.tableNumber,
    };
  }

  async updateSlot(slotId: string, data: AdminSlotUpdateRequest): Promise<StudyTableSlot> {
    const existing = await this.repo.getSlotById(slotId);
    if (!existing) {
      throw new DomainError('NOT_FOUND', 404, `Slot ${slotId} not found`);
    }

    if (data.status === 'LOCKED_MAINTENANCE' || data.active === false) {
      const futureBookings = await this.repo.countFutureBookingsForSlot(slotId);
      if (futureBookings > 0) {
        throw new DomainError(
          'CONFLICT',
          409,
          `Cannot lock or deactivate slot: a confirmed booking already exists on this slot.`
        );
      }
    }

    const hasTimeChange =
      (data.startTime !== undefined && data.startTime !== existing.startTime) ||
      (data.endTime !== undefined && data.endTime !== existing.endTime) ||
      (data.date !== undefined && data.date !== existing.date);

    if (hasTimeChange) {
      const futureBookings = await this.repo.countFutureBookingsForSlot(slotId);
      if (futureBookings > 0) {
        throw new DomainError(
          'CONFLICT',
          409,
          `Cannot alter date or time for slot ${slotId}: a confirmed booking already exists on this slot.`
        );
      }

      const targetDate = data.date ?? existing.date;
      const targetStartTime = data.startTime ?? existing.startTime;
      const targetEndTime = data.endTime ?? existing.endTime;

      const startMin = timeToMinutes(targetStartTime);
      const endMin = timeToMinutes(targetEndTime);
      if (startMin < 0 || endMin < 0 || startMin >= endMin) {
        throw new DomainError('VALIDATION_ERROR', 400, 'Start time must be before end time');
      }

      const location = await this.repo.getLocationById(existing.locationId);
      if (location) {
        const locOpenMin = timeToMinutes(location.openTime);
        const locCloseMin = timeToMinutes(location.closeTime);
        if (startMin < locOpenMin || endMin > locCloseMin) {
          throw new DomainError(
            'VALIDATION_ERROR',
            400,
            `Slot time window ${targetStartTime}–${targetEndTime} must fall within location operating hours (${location.openTime.slice(0, 5)}–${location.closeTime.slice(0, 5)})`
          );
        }
      }

      const hasOverlap = await this.repo.checkSlotOverlap(
        existing.tableId,
        targetDate,
        targetStartTime,
        targetEndTime,
        slotId
      );
      if (hasOverlap) {
        throw new DomainError(
          'CONFLICT',
          409,
          `Fixed-slot definition overlaps an existing slot on table on ${targetDate}`
        );
      }
    }

    return this.repo.updateSlot(slotId, data);
  }

  async setSlotActive(slotId: string, active: boolean, reason?: string): Promise<void> {
    const status = active ? 'AVAILABLE' : 'LOCKED_MAINTENANCE';
    await this.updateSlot(slotId, { active, status });
  }

  async listAllBookings(status?: string, search?: string, limit?: number): Promise<any[]> {
    return this.repo.listAllBookings(status, search, limit);
  }
}
