import React from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableWrapper } from '@/components/ui/TableWrapper';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export const BookingHistoryPage: React.FC = () => {
  const history = [
    {
      id: 'bk-1001',
      location: 'PK Kelkar Library 2F',
      table: 'T-10',
      date: '2026-10-02',
      time: '16:00 - 18:00',
      companion: 'Aarav Sharma',
      status: 'CONFIRMED',
    },
    {
      id: 'bk-0982',
      location: 'Computer Centre CC-101',
      table: 'T-14',
      date: '2026-09-28',
      time: '14:00 - 16:00',
      companion: 'Solo Study',
      status: 'COMPLETED',
    },
    {
      id: 'bk-0941',
      location: 'PK Kelkar Library 2F',
      table: 'T-12',
      date: '2026-09-21',
      time: '18:00 - 20:00',
      companion: 'Riya Sen',
      status: 'CANCELLED',
    },
  ];

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
            <Button variant="ember" size="sm">
              New Booking
            </Button>
          </Link>
        }
      />

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
          {history.map((row) => (
            <tr key={row.id} className="hover:bg-craft-surface/50">
              <td className="p-3 font-mono text-ember-400 font-semibold">{row.id}</td>
              <td className="p-3 text-craft-ink">
                {row.location} <span className="font-mono text-craft-muted">({row.table})</span>
              </td>
              <td className="p-3 text-craft-muted">{row.date} · {row.time}</td>
              <td className="p-3 text-craft-ink">{row.companion}</td>
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
                <Link to={`/app/booking/${row.id}`}>
                  <Button variant="ghost" size="sm">View Pass</Button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>
    </div>
  );
};
