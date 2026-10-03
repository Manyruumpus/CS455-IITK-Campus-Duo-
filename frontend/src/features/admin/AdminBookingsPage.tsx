import React, { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableWrapper } from '@/components/ui/TableWrapper';
import { FilterBar } from '@/components/ui/FilterBar';
import { Badge } from '@/components/ui/Badge';

export const AdminBookingsPage: React.FC = () => {
  const [search, setSearch] = useState('');

  const allBookings = [
    { id: 'bk-1001', student: 'Mohit Kumar', roll: '210642', table: 'T-10 (PK Kelkar)', slot: '16:00 - 18:00', status: 'CONFIRMED' },
    { id: 'bk-1002', student: 'Aarav Sharma', roll: '210884', table: 'T-11 (PK Kelkar)', slot: '16:00 - 18:00', status: 'CONFIRMED' },
    { id: 'bk-0994', student: 'Riya Sen', roll: '220191', table: 'T-14 (CC-101)', slot: '14:00 - 16:00', status: 'COMPLETED' },
  ];

  const filtered = allBookings.filter((b) => b.student.toLowerCase().includes(search.toLowerCase()) || b.table.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campus Study Table Reservations"
        subtitle="Master log of all reservations across PK Kelkar Library and Computer Centre."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Reservations', isCurrent: true },
        ]}
      />

      <FilterBar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by student name or table..."
        onClearFilters={() => setSearch('')}
      />

      <TableWrapper caption="All Campus Reservations">
        <thead>
          <tr className="border-b border-craft-border text-craft-muted font-medium">
            <th className="p-3">Reference</th>
            <th className="p-3">Student Name</th>
            <th className="p-3">Roll Number</th>
            <th className="p-3">Reserved Table</th>
            <th className="p-3">Time Window</th>
            <th className="p-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-craft-border/60">
          {filtered.map((b) => (
            <tr key={b.id} className="hover:bg-craft-surface/50">
              <td className="p-3 font-mono font-semibold text-amber-400">{b.id}</td>
              <td className="p-3 text-craft-ink">{b.student}</td>
              <td className="p-3 font-mono text-craft-muted">{b.roll}</td>
              <td className="p-3 text-craft-ink">{b.table}</td>
              <td className="p-3 text-craft-muted">{b.slot}</td>
              <td className="p-3">
                <Badge variant={b.status === 'CONFIRMED' ? 'success' : 'default'}>{b.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>
    </div>
  );
};
