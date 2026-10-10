import React, { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableWrapper } from '@/components/ui/TableWrapper';
import { FilterBar } from '@/components/ui/FilterBar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useAdminBookings, useAdminCancelBooking } from '@/queries/adminHooks';

export const AdminBookingsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const query = useAdminBookings({ search, status: 'ALL' });
  const cancel = useAdminCancelBooking();
  return <div className="space-y-6">
    <PageHeader title="Campus Study Table Reservations" subtitle="Admin oversight reuses canonical booking records and demo cancellation permissions." breadcrumbs={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Reservations', isCurrent: true }]} />
    <FilterBar searchQuery={search} onSearchChange={setSearch} searchPlaceholder="Search booking, student, or table..." onClearFilters={() => setSearch('')} />
    {query.isError && <p role="alert" className="text-sm text-red-300">{query.error.message}</p>}
    <TableWrapper caption="Service-backed booking oversight">
      <thead><tr><th className="p-3">Reference</th><th className="p-3">Participants</th><th className="p-3">Location/table</th><th className="p-3">Date/time</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead>
      <tbody>{query.data?.map((booking) => <tr key={booking.bookingId} className="border-t border-craft-border/60">
        <td className="p-3 font-mono text-amber-400">{booking.bookingId}</td><td className="p-3 text-xs">{booking.participants.map((p) => p.displayName).join(' + ')}</td><td className="p-3">{booking.locationName} / {booking.tableNumber}</td><td className="p-3 text-craft-muted">{booking.localDate} · {booking.timeWindow}</td><td className="p-3"><Badge variant={booking.status === 'CONFIRMED' ? 'success' : 'outline'}>{booking.status}</Badge></td>
        <td className="p-3">{booking.status === 'CONFIRMED' ? <Button variant="danger" size="sm" onClick={() => setSelected(booking.bookingId)}>Cancel</Button> : '—'}</td>
      </tr>)}</tbody>
    </TableWrapper>
    <Dialog isOpen={!!selected} onClose={() => setSelected(null)} title="Cancel booking" description="Both participants receive the existing deduplicated booking notification. The reason is recorded in the redacted mock audit." footer={<><Button variant="outline" size="sm" onClick={() => setSelected(null)}>Cancel</Button><Button variant="danger" size="sm" isLoading={cancel.isPending} disabled={!reason.trim() || cancel.isPending} onClick={() => { if (!selected || !reason.trim()) return; cancel.mutate({ bookingId: selected, reason, confirm: true }, { onSuccess: () => { setSelected(null); setReason(''); } }); }}>Confirm cancellation</Button></>}>
      <label htmlFor="booking-cancel-reason" className="text-xs">Required reason</label><textarea id="booking-cancel-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} className="w-full mt-2 bg-craft-base border border-craft-border rounded px-2 py-1 text-xs" />{cancel.isError && <p role="alert" className="text-xs text-red-300 mt-2">{cancel.error.message}</p>}
    </Dialog>
  </div>;
};
