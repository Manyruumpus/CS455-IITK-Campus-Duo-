import React, { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableWrapper } from '@/components/ui/TableWrapper';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import {
  useAdminResources, useAdminTables, useAdminSlots, useDeactivateAdminLocation,
  useCreateAdminLocation, useUpdateAdminLocation, useCreateAdminTable, useUpdateAdminTable, useCreateAdminSlot, useUpdateAdminSlot,
  useSetAdminTableActive, useSetAdminSlotActive,
} from '@/queries/adminHooks';
import { TableZoneType } from '@/types';

const fieldClass = 'w-full mt-1 bg-craft-base border border-craft-border rounded px-2 py-1 text-xs';

export const AdminTablesPage: React.FC = () => {
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
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [location, setLocation] = useState({ locationId: '', name: '', building: '', totalTables: '1', openTime: '08:00', closeTime: '22:00' });
  const [table, setTable] = useState({ tableId: '', locationId: '', tableNumber: '', hasPowerOutlets: 'true' });
  const [slot, setSlot] = useState<{ slotId: string; locationId: string; tableId: string; tableNumber: string; zone: TableZoneType; startTime: string; endTime: string; date: string }>({ slotId: '', locationId: '', tableId: '', tableNumber: '', zone: 'SILENT_READING', startTime: '10:00', endTime: '12:00', date: '' });
  const close = () => { setDialog(null); setReason(''); setEditingLocationId(null); setEditingTableId(null); setEditingSlotId(null); };
  const error = createLocation.error ?? updateLocation.error ?? createTable.error ?? updateTable.error ?? createSlot.error;

  return <div className="space-y-6">
    <PageHeader title="Study Resource Inventory" subtitle="Manage locations, two-person tables and fixed slots without changing booked resource meaning." breadcrumbs={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Resources', isCurrent: true }]} />
    {error && <p role="alert" className="text-sm text-red-300">{error.message}</p>}
    <div className="flex gap-2 flex-wrap">
      <Button size="sm" onClick={() => setDialog('location')}>Add location</Button>
      <Button size="sm" onClick={() => setDialog('table')}>Add table</Button>
      <Button size="sm" onClick={() => setDialog('slot')}>Add fixed slot</Button>
    </div>
    <TableWrapper caption="Service-backed locations and tables">
      <thead><tr><th className="p-3">Location</th><th className="p-3">Building</th><th className="p-3">Tables</th><th className="p-3">Future bookings</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead>
      <tbody>{resources.data?.map((resource) => <tr key={resource.locationId} className="border-t border-craft-border/60">
        <td className="p-3">{resource.locationName}</td><td className="p-3 text-craft-muted">{resource.building}</td><td className="p-3">{resource.tableCount} × capacity 2</td><td className="p-3">{resource.futureConfirmedBookings}</td>
        <td className="p-3"><Badge variant={resource.active ? 'success' : 'danger'}>{resource.active ? 'ACTIVE' : 'INACTIVE'}</Badge></td>
        <td className="p-3 flex gap-2">{resource.active ? <><Button variant="outline" size="sm" onClick={() => { setLocation({ ...location, locationId: resource.locationId, name: resource.locationName, building: resource.building }); setEditingLocationId(resource.locationId); setDialog('location'); }}>Edit</Button><Button variant="danger" size="sm" onClick={() => setSelected(resource.locationId)}>Deactivate</Button></> : '—'}</td>
      </tr>)}</tbody>
    </TableWrapper>
    <TableWrapper caption="Two-person table inventory">
      <thead><tr><th className="p-3">ID</th><th className="p-3">Location</th><th className="p-3">Number</th><th className="p-3">Capacity</th><th className="p-3">Status</th></tr></thead>
      <tbody>{tables.data?.map((item) => <tr key={item.tableId} className="border-t border-craft-border/60"><td className="p-3">{item.tableId}</td><td className="p-3">{item.locationId}</td><td className="p-3">{item.tableNumber}</td><td className="p-3">{item.capacity}</td><td className="p-3">{item.active ? 'ACTIVE' : 'INACTIVE'} <Button variant="outline" size="sm" onClick={() => { setTable({ tableId: item.tableId, locationId: item.locationId, tableNumber: item.tableNumber, hasPowerOutlets: String(item.hasPowerOutlets) }); setEditingTableId(item.tableId); setDialog('table'); }}>Edit</Button> <Button variant="outline" size="sm" onClick={() => setTableActive.mutate({ tableId: item.tableId, active: !item.active, reason: 'Inventory state change', confirm: true })}>{item.active ? 'Deactivate' : 'Activate'}</Button></td></tr>)}</tbody>
    </TableWrapper>
    <TableWrapper caption="Fixed-slot inventory">
      <thead><tr><th className="p-3">ID</th><th className="p-3">Table</th><th className="p-3">Date</th><th className="p-3">Time</th><th className="p-3">Status</th></tr></thead>
      <tbody>{slots.data?.map((item) => <tr key={item.slotId} className="border-t border-craft-border/60"><td className="p-3">{item.slotId}</td><td className="p-3">{item.tableId ?? item.tableNumber}</td><td className="p-3">{item.date}</td><td className="p-3">{item.startTime}–{item.endTime}</td><td className="p-3">{item.status} <Button variant="outline" size="sm" onClick={() => { setSlot({ slotId: item.slotId, locationId: item.locationId, tableId: item.tableId ?? '', tableNumber: item.tableNumber, zone: item.zone, startTime: item.startTime, endTime: item.endTime, date: item.date }); setEditingSlotId(item.slotId); setDialog('slot'); }}>Edit</Button> <Button variant="outline" size="sm" onClick={() => setSlotActive.mutate({ slotId: item.slotId, active: item.status === 'LOCKED_MAINTENANCE', reason: 'Inventory state change', confirm: true })}>{item.status === 'LOCKED_MAINTENANCE' ? 'Activate' : 'Deactivate'}</Button></td></tr>)}</tbody>
    </TableWrapper>
    <Dialog isOpen={!!selected} onClose={() => setSelected(null)} title="Deactivate location" description="Future confirmed bookings block deactivation. Bookings are never silently cancelled." footer={<><Button variant="outline" size="sm" onClick={() => setSelected(null)}>Cancel</Button><Button variant="danger" size="sm" isLoading={deactivate.isPending} disabled={!reason.trim()} onClick={() => selected && deactivate.mutate({ locationId: selected, reason, confirm: true }, { onSuccess: () => { setSelected(null); setReason(''); } })}>Confirm</Button></>}>
      <label htmlFor="deactivate-reason">Required reason</label><textarea id="deactivate-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} className={fieldClass} />
    </Dialog>
    <Dialog isOpen={dialog === 'location'} onClose={close} title={editingLocationId ? 'Edit location' : 'Add location'} description="Identifiers cannot be changed after booking references exist." footer={<><Button variant="outline" size="sm" onClick={close}>Cancel</Button><Button size="sm" isLoading={createLocation.isPending || updateLocation.isPending} onClick={() => editingLocationId ? updateLocation.mutate({ locationId: editingLocationId, request: { name: location.name, building: location.building, totalTables: Number(location.totalTables), openTime: location.openTime, closeTime: location.closeTime } }, { onSuccess: close }) : createLocation.mutate({ locationId: location.locationId, name: location.name, building: location.building, totalTables: Number(location.totalTables), openTime: location.openTime, closeTime: location.closeTime, hasPowerOutlets: true, hasWifi6: true, noisePolicy: 'WHISPER_COLLAB' }, { onSuccess: close })}>Save location</Button></>}>
      {(['locationId', 'name', 'building', 'totalTables', 'openTime', 'closeTime'] as const).map((key) => <label key={key} className="block mt-2">{key}<input className={fieldClass} value={location[key]} onChange={(event) => setLocation({ ...location, [key]: event.target.value })} /></label>)}
    </Dialog>
    <Dialog isOpen={dialog === 'table'} onClose={close} title={editingTableId ? 'Edit two-person table' : 'Add two-person table'} description="Capacity is fixed at 2." footer={<><Button variant="outline" size="sm" onClick={close}>Cancel</Button><Button size="sm" isLoading={createTable.isPending || updateTable.isPending} onClick={() => editingTableId ? updateTable.mutate({ tableId: editingTableId, request: { locationId: table.locationId, tableNumber: table.tableNumber, hasPowerOutlets: table.hasPowerOutlets === 'true' } }, { onSuccess: close }) : createTable.mutate({ ...table, hasPowerOutlets: table.hasPowerOutlets === 'true' }, { onSuccess: close })}>Save table</Button></>}>
      {(['tableId', 'locationId', 'tableNumber'] as const).map((key) => <label key={key} className="block mt-2">{key}<input className={fieldClass} value={table[key]} onChange={(event) => setTable({ ...table, [key]: event.target.value })} /></label>)}
    </Dialog>
    <Dialog isOpen={dialog === 'slot'} onClose={close} title={editingSlotId ? 'Edit fixed slot' : 'Add fixed slot'} description="Overlapping slots for the same table and date are rejected; booked slot meaning cannot change." footer={<><Button variant="outline" size="sm" onClick={close}>Cancel</Button><Button size="sm" isLoading={createSlot.isPending || updateSlot.isPending} onClick={() => editingSlotId ? updateSlot.mutate({ slotId: editingSlotId, request: { locationId: slot.locationId, tableId: slot.tableId, tableNumber: slot.tableNumber, zone: slot.zone, startTime: slot.startTime, endTime: slot.endTime, date: slot.date } }, { onSuccess: close }) : createSlot.mutate(slot, { onSuccess: close })}>Save slot</Button></>}>
      {(['slotId', 'locationId', 'tableId', 'tableNumber', 'date', 'startTime', 'endTime'] as const).map((key) => <label key={key} className="block mt-2">{key}<input className={fieldClass} value={slot[key]} onChange={(event) => setSlot({ ...slot, [key]: event.target.value })} /></label>)}
    </Dialog>
  </div>;
};
