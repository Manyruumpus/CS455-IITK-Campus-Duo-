import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableWrapper } from '@/components/ui/TableWrapper';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useMyBookings } from '@/queries';
import { Loader2, CalendarX, Plus } from 'lucide-react';
import { AppError } from '@/types';

export const BookingHistoryPage: React.FC = () => {
  const { data: bookings, isLoading, isError, error, refetch } = useMyBookings();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const visibleBookings = useMemo(
    () => (bookings ?? []).filter((booking) =>
      (statusFilter === 'ALL' || booking.status === statusFilter) &&
      (!dateFilter || booking.localDate === dateFilter)
    ),
    [bookings, dateFilter, statusFilter]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservation History"
        subtitle="Historical record of confirmed, completed, and cancelled study table bookings."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Table Booking', href: '/app/booking' },
          { label: 'History', isCurrent: true },
        ]}
        actions={
          <Link to="/app/booking/table-grid">
            <Button variant="ember" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              New Booking
            </Button>
          </Link>
        }
      />

      {isLoading && (
        <div className="p-16 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-ember-400" />
          <p className="text-sm text-craft-muted">Loading your booking history...</p>
        </div>
      )}

      {isError && (
        <div className="p-6 rounded-xl border border-red-900/50 bg-red-950/20 text-center space-y-3">
          <h3 className="text-sm font-semibold text-red-200">Unable to load booking history</h3>
          <p className="text-xs text-red-300">
            {error instanceof AppError ? error.message : 'A temporary error occurred.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {bookings && bookings.length === 0 && (
        <div className="p-12 text-center rounded-xl border border-craft-borderCraft bg-craft-card space-y-3">
          <CalendarX className="w-10 h-10 text-craft-muted mx-auto" />
          <h3 className="text-sm font-semibold text-craft-ink">No reservations found</h3>
          <p className="text-xs text-craft-muted">You have not created any table reservations yet.</p>
          <Link to="/app/booking/table-grid">
            <Button variant="ember" size="sm">
              Reserve a Table
            </Button>
          </Link>
        </div>
      )}

      {bookings && bookings.length > 0 && (
        <>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-xs text-craft-muted">
              Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="block mt-1 px-3 py-2 rounded-lg bg-craft-surface border border-craft-border text-craft-ink">
                <option value="ALL">All statuses</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </label>
            <label className="text-xs text-craft-muted">
              Campus date
              <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className="block mt-1 px-3 py-2 rounded-lg bg-craft-surface border border-craft-border text-craft-ink" />
            </label>
          </div>
          <TableWrapper caption="Study Table Reservation History">
          <thead>
            <tr className="border-b border-craft-border text-craft-muted font-medium">
              <th className="p-3">Reference</th>
              <th className="p-3">Location & Table</th>
              <th className="p-3">Date & Time</th>
              <th className="p-3">Companion</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-craft-border/60">
            {visibleBookings.map((row) => (
              <tr key={row.bookingId} className="hover:bg-craft-surface/50">
                <td className="p-3 font-mono text-ember-400 font-semibold">{row.bookingId}</td>
                <td className="p-3 text-craft-ink">
                  {row.locationName} <span className="font-mono text-craft-muted">({row.tableNumber})</span>
                </td>
                <td className="p-3 text-craft-muted">
                  {row.localDate} · {row.timeWindow}
                </td>
                <td className="p-3 text-craft-ink">{row.companionDisplayName ?? 'Solo Study'}</td>
                <td className="p-3">
                  <Badge
                    variant={
                      row.status === 'CONFIRMED'
                        ? 'success'
                        : row.status === 'COMPLETED'
                        ? 'default'
                        : 'danger'
                    }
                  >
                    {row.status}
                  </Badge>
                </td>
                <td className="p-3 text-right">
                  <Link to={`/app/booking/${row.bookingId}`}>
                    <Button variant="ghost" size="sm">
                      View Pass
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
          </TableWrapper>
          {visibleBookings.length === 0 && <p className="text-xs text-craft-muted">No reservations match the selected filters.</p>}
        </>
      )}
    </div>
  );
};
