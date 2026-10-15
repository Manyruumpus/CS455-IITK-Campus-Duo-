import React, { useState, useMemo } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableWrapper } from '@/components/ui/TableWrapper';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import {
  useAdminResources,
  useAdminTables,
  useAdminSlots,
  useDeactivateAdminLocation,
  useCreateAdminLocation,
  useUpdateAdminLocation,
  useCreateAdminTable,
  useUpdateAdminTable,
  useCreateAdminSlot,
  useUpdateAdminSlot,
  useSetAdminTableActive,
  useSetAdminSlotActive,
} from '@/queries/adminHooks';
import { TableZoneType, CampusLocation } from '@/types';

const fieldClass =
  'w-full mt-1.5 bg-craft-surface border border-craft-border text-craft-ink placeholder-craft-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ember-500 focus:border-ember-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const selectClass =
  'w-full mt-1.5 bg-craft-surface border border-craft-border text-craft-ink rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ember-500 focus:border-ember-500 transition-colors';

const labelClass = 'block text-xs font-semibold text-craft-muted uppercase tracking-wider mt-3';

export const AdminTablesPage: React.FC = () => {
  const { addToast } = useToast();
  const resources = useAdminResources();
  const tables = useAdminTables();
  const slots = useAdminSlots();

  const deactivate = useDeactivateAdminLocation();
  const createLocation = useCreateAdminLocation();
  const updateLocation = useUpdateAdminLocation();
  const createTable = useCreateAdminTable();
  const updateTable = useUpdateAdminTable();
  const createSlot = useCreateAdminSlot();
  const updateSlot = useUpdateAdminSlot();
  const setTableActive = useSetAdminTableActive();
  const setSlotActive = useSetAdminSlotActive();

  const [dialog, setDialog] = useState<'location' | 'table' | 'slot' | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [selectedDeactivateId, setSelectedDeactivateId] = useState<string | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // Form states
  const [locationForm, setLocationForm] = useState<{
    locationId: string;
    name: string;
    building: string;
    totalTables: string;
    openTime: string;
    closeTime: string;
    hasPowerOutlets: boolean;
    hasWifi6: boolean;
    noisePolicy: CampusLocation['noisePolicy'];
  }>({
    locationId: '',
    name: '',
    building: '',
    totalTables: '1',
    openTime: '08:00',
    closeTime: '22:00',
    hasPowerOutlets: true,
    hasWifi6: true,
    noisePolicy: 'WHISPER_COLLAB',
  });

  const [tableForm, setTableForm] = useState({
    tableId: '',
    locationId: '',
    tableNumber: '',
    hasPowerOutlets: true,
  });

  const [slotForm, setSlotForm] = useState<{
    slotId: string;
    locationId: string;
    tableId: string;
    tableNumber: string;
    zone: TableZoneType;
    startTime: string;
    endTime: string;
    date: string;
  }>({
    slotId: '',
    locationId: '',
    tableId: '',
    tableNumber: '',
    zone: 'COLLABORATIVE_STUDY',
    startTime: '10:00',
    endTime: '12:00',
    date: '',
  });

  const activeLocations = useMemo(() => {
    return (resources.data ?? []).filter((r) => r.active);
  }, [resources.data]);

  const activeTablesForSelectedSlotLocation = useMemo(() => {
    if (!slotForm.locationId) return [];
    return (tables.data ?? []).filter(
      (t) => t.locationId === slotForm.locationId && t.active
    );
  }, [tables.data, slotForm.locationId]);

  const todayStr = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);

  const closeDialog = () => {
    setDialog(null);
    setEditingLocationId(null);
    setEditingTableId(null);
    setEditingSlotId(null);
    setSelectedDeactivateId(null);
    setDeactivateReason('');
    setLocalError(null);
  };

  // Auto-calculate next table number when adding table to a location
  const computeNextTableNumber = (locId: string): string => {
    const locTables = (tables.data ?? []).filter((t) => t.locationId === locId);
    let maxNum = 0;
    for (const t of locTables) {
      const match = t.tableNumber.match(/\d+/);
      if (match) {
        const n = parseInt(match[0], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    return `T-${String(maxNum + 1).padStart(2, '0')}`;
  };

  const handleOpenAddTable = () => {
    const defaultLocId = activeLocations[0]?.locationId || '';
    const nextNum = defaultLocId ? computeNextTableNumber(defaultLocId) : 'T-01';
    setTableForm({
      tableId: '',
      locationId: defaultLocId,
      tableNumber: nextNum,
      hasPowerOutlets: true,
    });
    setEditingTableId(null);
    setLocalError(null);
    setDialog('table');
  };

  const handleOpenAddSlot = () => {
    const defaultLocId = activeLocations[0]?.locationId || '';
    const locTables = (tables.data ?? []).filter((t) => t.locationId === defaultLocId && t.active);
    const defaultTable = locTables[0];
    setSlotForm({
      slotId: '',
      locationId: defaultLocId,
      tableId: defaultTable?.tableId || '',
      tableNumber: defaultTable?.tableNumber || '',
      zone: 'COLLABORATIVE_STUDY',
      startTime: '10:00',
      endTime: '12:00',
      date: todayStr,
    });
    setEditingSlotId(null);
    setLocalError(null);
    setDialog('slot');
  };

  const handleOpenAddLocation = () => {
    setLocationForm({
      locationId: '',
      name: '',
      building: '',
      totalTables: '2',
      openTime: '08:00',
      closeTime: '22:00',
      hasPowerOutlets: true,
      hasWifi6: true,
      noisePolicy: 'WHISPER_COLLAB',
    });
    setEditingLocationId(null);
    setLocalError(null);
    setDialog('location');
  };

  // Submit Location
  const handleSaveLocation = () => {
    setLocalError(null);
    if (!locationForm.name.trim()) {
      setLocalError('Location name is required');
      return;
    }
    if (!locationForm.building.trim()) {
      setLocalError('Building is required');
      return;
    }
    if (locationForm.openTime >= locationForm.closeTime) {
      setLocalError('Opening time must be earlier than closing time');
      return;
    }

    if (editingLocationId) {
      updateLocation.mutate(
        {
          locationId: editingLocationId,
          request: {
            name: locationForm.name.trim(),
            building: locationForm.building.trim(),
            totalTables: parseInt(locationForm.totalTables, 10) || 0,
            openTime: locationForm.openTime,
            closeTime: locationForm.closeTime,
            hasPowerOutlets: locationForm.hasPowerOutlets,
            hasWifi6: locationForm.hasWifi6,
            noisePolicy: locationForm.noisePolicy,
          },
        },
        {
          onSuccess: () => {
            addToast({
              type: 'info',
              title: 'Location Updated',
              description: `Location "${locationForm.name}" updated successfully.`,
            });
            closeDialog();
          },
          onError: (err) => setLocalError(err.message),
        }
      );
    } else {
      createLocation.mutate(
        {
          locationId: locationForm.locationId.trim() || undefined as any,
          name: locationForm.name.trim(),
          building: locationForm.building.trim(),
          totalTables: parseInt(locationForm.totalTables, 10) || 1,
          openTime: locationForm.openTime,
          closeTime: locationForm.closeTime,
          hasPowerOutlets: locationForm.hasPowerOutlets,
          hasWifi6: locationForm.hasWifi6,
          noisePolicy: locationForm.noisePolicy,
        },
        {
          onSuccess: () => {
            addToast({
              type: 'info',
              title: 'Location Created',
              description: `Location "${locationForm.name}" created successfully.`,
            });
            closeDialog();
          },
          onError: (err) => setLocalError(err.message),
        }
      );
    }
  };

  // Submit Table
  const handleSaveTable = () => {
    setLocalError(null);
    if (!tableForm.locationId) {
      setLocalError('A valid registered location must be selected');
      return;
    }
    if (!tableForm.tableNumber.trim()) {
      setLocalError('Table number is required');
      return;
    }

    if (editingTableId) {
      updateTable.mutate(
        {
          tableId: editingTableId,
          request: {
            locationId: tableForm.locationId,
            tableNumber: tableForm.tableNumber.trim(),
            hasPowerOutlets: tableForm.hasPowerOutlets,
          },
        },
        {
          onSuccess: () => {
            addToast({
              type: 'info',
              title: 'Table Updated',
              description: `Table ${tableForm.tableNumber} updated successfully.`,
            });
            closeDialog();
          },
          onError: (err) => setLocalError(err.message),
        }
      );
    } else {
      createTable.mutate(
        {
          locationId: tableForm.locationId,
          tableNumber: tableForm.tableNumber.trim(),
          hasPowerOutlets: tableForm.hasPowerOutlets,
        },
        {
          onSuccess: () => {
            addToast({
              type: 'info',
              title: 'Table Added',
              description: `Table ${tableForm.tableNumber} added to inventory.`,
            });
            closeDialog();
          },
          onError: (err) => setLocalError(err.message),
        }
      );
    }
  };

  // Submit Slot
  const handleSaveSlot = () => {
    setLocalError(null);
    if (!slotForm.locationId) {
      setLocalError('A location must be selected');
      return;
    }
    if (!slotForm.tableId) {
      setLocalError('A table must be selected');
      return;
    }
    if (!slotForm.date) {
      setLocalError('A valid date is required');
      return;
    }
    if (slotForm.startTime >= slotForm.endTime) {
      setLocalError('Slot start time must be before end time');
      return;
    }

    const loc = activeLocations.find((l) => l.locationId === slotForm.locationId);
    if (loc && loc.openTime && loc.closeTime) {
      const locOpen = loc.openTime.slice(0, 5);
      const locClose = loc.closeTime.slice(0, 5);
      if (slotForm.startTime < locOpen || slotForm.endTime > locClose) {
        setLocalError(
          `Slot hours (${slotForm.startTime}–${slotForm.endTime}) must be within location operating hours (${locOpen}–${locClose})`
        );
        return;
      }
    }

    if (editingSlotId) {
      updateSlot.mutate(
        {
          slotId: editingSlotId,
          request: {
            zone: slotForm.zone,
            date: slotForm.date,
            startTime: slotForm.startTime,
            endTime: slotForm.endTime,
          },
        },
        {
          onSuccess: () => {
            addToast({
              type: 'info',
              title: 'Slot Updated',
              description: `Study slot updated successfully.`,
            });
            closeDialog();
          },
          onError: (err) => setLocalError(err.message),
        }
      );
    } else {
      createSlot.mutate(
        {
          locationId: slotForm.locationId,
          tableId: slotForm.tableId,
          tableNumber: slotForm.tableNumber,
          date: slotForm.date,
          startTime: slotForm.startTime,
          endTime: slotForm.endTime,
          zone: slotForm.zone,
        },
        {
          onSuccess: () => {
            addToast({
              type: 'info',
              title: 'Slot Created',
              description: `Fixed study slot created for ${slotForm.date} (${slotForm.startTime}–${slotForm.endTime}).`,
            });
            closeDialog();
          },
          onError: (err) => setLocalError(err.message),
        }
      );
    }
  };

  const mutationError =
    createLocation.error ??
    updateLocation.error ??
    createTable.error ??
    updateTable.error ??
    createSlot.error ??
    updateSlot.error ??
    deactivate.error;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Study Resource Inventory"
        subtitle="Authoritative PostgreSQL management for campus locations, study tables, and fixed availability slots."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Resources', isCurrent: true },
        ]}
      />

      {(localError || mutationError) && (
        <div
          role="alert"
          className="p-3 rounded-lg border border-red-900/50 bg-red-950/30 text-xs text-red-200"
        >
          {localError || mutationError?.message}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        <Button size="sm" onClick={handleOpenAddLocation}>
          Add location
        </Button>
        <Button size="sm" onClick={handleOpenAddTable}>
          Add table
        </Button>
        <Button size="sm" onClick={handleOpenAddSlot}>
          Add fixed slot
        </Button>
      </div>

      {/* Locations Table */}
      <TableWrapper caption="Service-backed locations and tables">
        <thead>
          <tr>
            <th className="p-3 text-left">Location</th>
            <th className="p-3 text-left">Building</th>
            <th className="p-3 text-left">Hours</th>
            <th className="p-3 text-left">Tables</th>
            <th className="p-3 text-left">Future bookings</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {resources.data?.map((resource) => (
            <tr key={resource.locationId} className="border-t border-craft-border/60">
              <td className="p-3 font-medium text-craft-ink">{resource.locationName}</td>
              <td className="p-3 text-craft-muted">{resource.building}</td>
              <td className="p-3 text-craft-muted text-xs">
                {resource.openTime ? `${resource.openTime.slice(0, 5)}–${resource.closeTime?.slice(0, 5)}` : '08:00–22:00'}
              </td>
              <td className="p-3">{resource.tableCount} × capacity 2</td>
              <td className="p-3">{resource.futureConfirmedBookings}</td>
              <td className="p-3">
                <Badge variant={resource.active ? 'success' : 'danger'}>
                  {resource.active ? 'ACTIVE' : 'INACTIVE'}
                </Badge>
              </td>
              <td className="p-3 flex gap-2">
                {resource.active ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setLocationForm({
                          locationId: resource.locationId,
                          name: resource.locationName,
                          building: resource.building,
                          totalTables: String(resource.tableCount),
                          openTime: resource.openTime?.slice(0, 5) || '08:00',
                          closeTime: resource.closeTime?.slice(0, 5) || '22:00',
                          hasPowerOutlets: resource.hasPowerOutlets ?? true,
                          hasWifi6: resource.hasWifi6 ?? true,
                          noisePolicy: resource.noisePolicy || 'WHISPER_COLLAB',
                        });
                        setEditingLocationId(resource.locationId);
                        setLocalError(null);
                        setDialog('location');
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setSelectedDeactivateId(resource.locationId);
                        setDeactivateReason('');
                      }}
                    >
                      Deactivate
                    </Button>
                  </>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>

      {/* Tables Inventory */}
      <TableWrapper caption="Two-person table inventory">
        <thead>
          <tr>
            <th className="p-3 text-left">ID</th>
            <th className="p-3 text-left">Location</th>
            <th className="p-3 text-left">Table Number</th>
            <th className="p-3 text-left">Capacity</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tables.data?.map((item) => (
            <tr key={item.tableId} className="border-t border-craft-border/60">
              <td className="p-3 font-mono text-xs text-craft-muted">{item.tableId}</td>
              <td className="p-3 text-craft-ink">{item.locationName || item.locationId}</td>
              <td className="p-3 font-semibold text-craft-ink">{item.tableNumber}</td>
              <td className="p-3">{item.capacity}</td>
              <td className="p-3">
                <Badge variant={item.active ? 'success' : 'danger'}>
                  {item.active ? 'ACTIVE' : 'INACTIVE'}
                </Badge>
              </td>
              <td className="p-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTableForm({
                      tableId: item.tableId,
                      locationId: item.locationId,
                      tableNumber: item.tableNumber,
                      hasPowerOutlets: item.hasPowerOutlets,
                    });
                    setEditingTableId(item.tableId);
                    setLocalError(null);
                    setDialog('table');
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setTableActive.mutate({
                      tableId: item.tableId,
                      active: !item.active,
                      reason: 'Inventory state change',
                      confirm: true,
                    })
                  }
                >
                  {item.active ? 'Deactivate' : 'Activate'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>

      {/* Fixed Slots Inventory */}
      <TableWrapper caption="Fixed-slot inventory">
        <thead>
          <tr>
            <th className="p-3 text-left">ID</th>
            <th className="p-3 text-left">Location / Table</th>
            <th className="p-3 text-left">Date</th>
            <th className="p-3 text-left">Time Window</th>
            <th className="p-3 text-left">Zone</th>
            <th className="p-3 text-left">Status</th>
            <th className="p-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {slots.data?.map((item) => (
            <tr key={item.slotId} className="border-t border-craft-border/60">
              <td className="p-3 font-mono text-xs text-craft-muted">{item.slotId}</td>
              <td className="p-3 text-craft-ink">
                {item.locationName || item.locationId} — Table {item.tableNumber}
              </td>
              <td className="p-3">{item.date}</td>
              <td className="p-3 font-medium">
                {item.startTime}–{item.endTime}
              </td>
              <td className="p-3 text-xs text-craft-muted">{item.zone}</td>
              <td className="p-3">
                <Badge variant={item.status === 'AVAILABLE' ? 'success' : 'danger'}>
                  {item.status}
                </Badge>
              </td>
              <td className="p-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSlotForm({
                      slotId: item.slotId,
                      locationId: item.locationId,
                      tableId: item.tableId ?? '',
                      tableNumber: item.tableNumber,
                      zone: item.zone,
                      startTime: item.startTime,
                      endTime: item.endTime,
                      date: item.date,
                    });
                    setEditingSlotId(item.slotId);
                    setLocalError(null);
                    setDialog('slot');
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSlotActive.mutate({
                      slotId: item.slotId,
                      active: item.status === 'LOCKED_MAINTENANCE',
                      reason: 'Inventory state change',
                      confirm: true,
                    })
                  }
                >
                  {item.status === 'LOCKED_MAINTENANCE' ? 'Activate' : 'Deactivate'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>

      {/* Deactivate Location Dialog */}
      <Dialog
        isOpen={!!selectedDeactivateId}
        onClose={closeDialog}
        title="Deactivate location"
        description="Future confirmed bookings block deactivation. Bookings are never silently cancelled."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={deactivate.isPending}
              disabled={!deactivateReason.trim()}
              onClick={() => {
                if (selectedDeactivateId) {
                  deactivate.mutate(
                    { locationId: selectedDeactivateId, reason: deactivateReason, confirm: true },
                    {
                      onSuccess: () => {
                        addToast({
                          type: 'info',
                          title: 'Location Deactivated',
                          description: 'Location and its resources have been deactivated.',
                        });
                        closeDialog();
                      },
                      onError: (err) => setLocalError(err.message),
                    }
                  );
                }
              }}
            >
              Confirm
            </Button>
          </>
        }
      >
        <label htmlFor="deactivate-reason" className={labelClass}>
          Required reason
        </label>
        <textarea
          id="deactivate-reason"
          value={deactivateReason}
          onChange={(e) => setDeactivateReason(e.target.value)}
          maxLength={500}
          rows={3}
          className={fieldClass}
          placeholder="State the reason for deactivating this study location..."
        />
      </Dialog>

      {/* Location Modal Dialog */}
      <Dialog
        isOpen={dialog === 'location'}
        onClose={closeDialog}
        title={editingLocationId ? 'Edit location' : 'Add location'}
        description="Identifiers cannot be changed after booking references exist. Adjusting table count reconciles real table inventory."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              size="sm"
              isLoading={createLocation.isPending || updateLocation.isPending}
              onClick={handleSaveLocation}
            >
              Save location
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {editingLocationId && (
            <div>
              <label htmlFor="location-id" className={labelClass}>
                Location ID (Read-only)
              </label>
              <input
                id="location-id"
                disabled
                value={locationForm.locationId}
                className={fieldClass}
              />
            </div>
          )}

          <div>
            <label htmlFor="location-name" className={labelClass}>
              Location Name <span className="text-red-400">*</span>
            </label>
            <input
              id="location-name"
              value={locationForm.name}
              onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
              className={fieldClass}
              placeholder="e.g. P.K. Kelkar Library — 2nd Floor"
            />
          </div>

          <div>
            <label htmlFor="location-building" className={labelClass}>
              Building <span className="text-red-400">*</span>
            </label>
            <input
              id="location-building"
              value={locationForm.building}
              onChange={(e) => setLocationForm({ ...locationForm, building: e.target.value })}
              className={fieldClass}
              placeholder="e.g. PK Kelkar Library"
            />
          </div>

          <div>
            <label htmlFor="location-tables" className={labelClass}>
              Total Two-Person Tables
            </label>
            <input
              id="location-tables"
              type="number"
              min="0"
              max="100"
              value={locationForm.totalTables}
              onChange={(e) => setLocationForm({ ...locationForm, totalTables: e.target.value })}
              className={fieldClass}
            />
            <p className="text-[11px] text-craft-muted mt-1">
              Adjusting this value creates or safely deactivates unbooked tables in PostgreSQL. Booked tables are never silently deleted.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="location-open-time" className={labelClass}>
                Open Time
              </label>
              <input
                id="location-open-time"
                type="time"
                value={locationForm.openTime}
                onChange={(e) => setLocationForm({ ...locationForm, openTime: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="location-close-time" className={labelClass}>
                Close Time
              </label>
              <input
                id="location-close-time"
                type="time"
                value={locationForm.closeTime}
                onChange={(e) => setLocationForm({ ...locationForm, closeTime: e.target.value })}
                className={fieldClass}
              />
            </div>
          </div>
        </div>
      </Dialog>

      {/* Table Modal Dialog */}
      <Dialog
        isOpen={dialog === 'table'}
        onClose={closeDialog}
        title={editingTableId ? 'Edit two-person table' : 'Add two-person table'}
        description="Select a registered location. Table numbers follow canonical conventions and identifiers are generated automatically."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              size="sm"
              isLoading={createTable.isPending || updateTable.isPending}
              onClick={handleSaveTable}
            >
              Save table
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {editingTableId && (
            <div>
              <label htmlFor="table-id" className={labelClass}>
                Table ID (Read-only)
              </label>
              <input id="table-id" disabled value={tableForm.tableId} className={fieldClass} />
            </div>
          )}

          <div>
            <label htmlFor="table-location-select" className={labelClass}>
              Registered Location <span className="text-red-400">*</span>
            </label>
            <select
              id="table-location-select"
              value={tableForm.locationId}
              onChange={(e) => {
                const newLocId = e.target.value;
                const nextNum = computeNextTableNumber(newLocId);
                setTableForm({
                  ...tableForm,
                  locationId: newLocId,
                  tableNumber: !editingTableId ? nextNum : tableForm.tableNumber,
                });
              }}
              className={selectClass}
            >
              <option value="" disabled>
                Select campus location...
              </option>
              {activeLocations.map((loc) => (
                <option key={loc.locationId} value={loc.locationId}>
                  {loc.locationName} ({loc.building})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="table-number" className={labelClass}>
              Table Number <span className="text-red-400">*</span>
            </label>
            <input
              id="table-number"
              value={tableForm.tableNumber}
              onChange={(e) => setTableForm({ ...tableForm, tableNumber: e.target.value })}
              className={fieldClass}
              placeholder="e.g. T-01 or DB05-A"
            />
            <p className="text-[11px] text-craft-muted mt-1">
              Table numbers are unique per location. Capacity is strictly 2 seats per canonical pair model.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="table-power-outlets"
              checked={tableForm.hasPowerOutlets}
              onChange={(e) =>
                setTableForm({ ...tableForm, hasPowerOutlets: e.target.checked })
              }
              className="rounded border-craft-border text-ember-500 focus:ring-ember-500"
            />
            <label htmlFor="table-power-outlets" className="text-xs text-craft-ink">
              Table includes dedicated power outlets
            </label>
          </div>
        </div>
      </Dialog>

      {/* Fixed Slot Modal Dialog */}
      <Dialog
        isOpen={dialog === 'slot'}
        onClose={closeDialog}
        title={editingSlotId ? 'Edit fixed slot' : 'Add fixed study slot'}
        description="Select location and table. Overlapping slots for the same table and date are rejected; booked slots cannot change meaning."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              size="sm"
              isLoading={createSlot.isPending || updateSlot.isPending}
              onClick={handleSaveSlot}
            >
              Save slot
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {editingSlotId && (
            <div>
              <label htmlFor="slot-id" className={labelClass}>
                Slot ID (Read-only)
              </label>
              <input id="slot-id" disabled value={slotForm.slotId} className={fieldClass} />
            </div>
          )}

          <div>
            <label htmlFor="slot-location-select" className={labelClass}>
              Location <span className="text-red-400">*</span>
            </label>
            <select
              id="slot-location-select"
              disabled={Boolean(editingSlotId)}
              value={slotForm.locationId}
              onChange={(e) => {
                const newLocId = e.target.value;
                const locTables = (tables.data ?? []).filter(
                  (t) => t.locationId === newLocId && t.active
                );
                const firstTable = locTables[0];
                setSlotForm({
                  ...slotForm,
                  locationId: newLocId,
                  tableId: firstTable?.tableId || '',
                  tableNumber: firstTable?.tableNumber || '',
                });
              }}
              className={`${selectClass} ${editingSlotId ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <option value="" disabled>
                Select location...
              </option>
              {activeLocations.map((loc) => (
                <option key={loc.locationId} value={loc.locationId}>
                  {loc.locationName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="slot-table-select" className={labelClass}>
              Table <span className="text-red-400">*</span>
            </label>
            <select
              id="slot-table-select"
              disabled={Boolean(editingSlotId)}
              value={slotForm.tableId}
              onChange={(e) => {
                const selectedTbl = activeTablesForSelectedSlotLocation.find(
                  (t) => t.tableId === e.target.value
                );
                setSlotForm({
                  ...slotForm,
                  tableId: e.target.value,
                  tableNumber: selectedTbl?.tableNumber || '',
                });
              }}
              className={`${selectClass} ${editingSlotId ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <option value="" disabled>
                {activeTablesForSelectedSlotLocation.length === 0
                  ? 'No active tables for this location'
                  : 'Select table...'}
              </option>
              {activeTablesForSelectedSlotLocation.map((t) => (
                <option key={t.tableId} value={t.tableId}>
                  Table {t.tableNumber} (Capacity: 2)
                </option>
              ))}
            </select>
          </div>

          {(() => {
            const loc = activeLocations.find((l) => l.locationId === slotForm.locationId);
            if (loc?.openTime && loc?.closeTime) {
              return (
                <p className="text-xs text-slate-400">
                  Location operating hours: <span className="text-indigo-300 font-medium">{loc.openTime.slice(0, 5)} – {loc.closeTime.slice(0, 5)}</span>
                </p>
              );
            }
            return null;
          })()}

          <div>
            <label htmlFor="slot-date-picker" className={labelClass}>
              Calendar Date <span className="text-red-400">*</span>
            </label>
            <input
              id="slot-date-picker"
              type="date"
              min={todayStr}
              value={slotForm.date}
              onChange={(e) => setSlotForm({ ...slotForm, date: e.target.value })}
              className={fieldClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="slot-start-time" className={labelClass}>
                Start Time <span className="text-red-400">*</span>
              </label>
              <input
                id="slot-start-time"
                type="time"
                value={slotForm.startTime}
                onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="slot-end-time" className={labelClass}>
                End Time <span className="text-red-400">*</span>
              </label>
              <input
                id="slot-end-time"
                type="time"
                value={slotForm.endTime}
                onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })}
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="slot-zone-select" className={labelClass}>
              Study Zone
            </label>
            <select
              id="slot-zone-select"
              value={slotForm.zone}
              onChange={(e) =>
                setSlotForm({ ...slotForm, zone: e.target.value as TableZoneType })
              }
              className={selectClass}
            >
              <option value="COLLABORATIVE_STUDY">COLLABORATIVE_STUDY (Conversational)</option>
              <option value="SILENT_READING">SILENT_READING (Absolute silence)</option>
              <option value="DISCUSSION_POD">DISCUSSION_POD (Group review)</option>
              <option value="LAB_TERMINAL">LAB_TERMINAL (High computing)</option>
            </select>
          </div>
        </div>
      </Dialog>
    </div>
  );
};
