import React, { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableWrapper } from '@/components/ui/TableWrapper';
import { FilterBar } from '@/components/ui/FilterBar';
import { Badge } from '@/components/ui/Badge';

export const AdminUsersPage: React.FC = () => {
  const [search, setSearch] = useState('');

  const users = [
    { id: 'usr-210642', roll: '210642', name: 'Mohit Kumar', dept: 'CSE', status: 'ACTIVE', studyOptIn: true, socialOptIn: true },
    { id: 'usr-210884', roll: '210884', name: 'Aarav Sharma', dept: 'CSE', status: 'ACTIVE', studyOptIn: true, socialOptIn: false },
    { id: 'usr-220191', roll: '220191', name: 'Riya Sen', dept: 'EE', status: 'ACTIVE', studyOptIn: true, socialOptIn: true },
    { id: 'usr-992100', roll: '200912', name: 'Flagged User', dept: 'ME', status: 'FLAGGED', studyOptIn: false, socialOptIn: true },
  ];

  const filtered = users.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.roll.includes(search));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student User Directory"
        subtitle="Inspect registered student accounts, department affiliations, and consent states."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Users', isCurrent: true },
        ]}
      />

      <FilterBar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by student name or roll number..."
        onClearFilters={() => setSearch('')}
      />

      <TableWrapper caption="Student User Accounts">
        <thead>
          <tr className="border-b border-craft-border text-craft-muted font-medium">
            <th className="p-3">Roll Number</th>
            <th className="p-3">Name</th>
            <th className="p-3">Department</th>
            <th className="p-3">Study Mode</th>
            <th className="p-3">Social Mode</th>
            <th className="p-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-craft-border/60">
          {filtered.map((u) => (
            <tr key={u.id} className="hover:bg-craft-surface/50">
              <td className="p-3 font-mono font-semibold text-craft-ink">{u.roll}</td>
              <td className="p-3 text-craft-ink">{u.name}</td>
              <td className="p-3 text-craft-muted">{u.dept}</td>
              <td className="p-3">
                <Badge variant={u.studyOptIn ? 'success' : 'outline'}>{u.studyOptIn ? 'Active' : 'Off'}</Badge>
              </td>
              <td className="p-3">
                <Badge variant={u.socialOptIn ? 'success' : 'outline'}>{u.socialOptIn ? 'Active' : 'Off'}</Badge>
              </td>
              <td className="p-3">
                <Badge variant={u.status === 'ACTIVE' ? 'success' : 'danger'}>{u.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>
    </div>
  );
};
