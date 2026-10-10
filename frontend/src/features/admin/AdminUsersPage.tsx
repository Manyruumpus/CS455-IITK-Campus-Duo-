import React, { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableWrapper } from '@/components/ui/TableWrapper';
import { FilterBar } from '@/components/ui/FilterBar';
import { Badge } from '@/components/ui/Badge';
import { useAdminUsers } from '@/queries/adminHooks';

export const AdminUsersPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const query = useAdminUsers(search);
  return <div className="space-y-6">
    <PageHeader title="Student User Directory" subtitle="Minimal admin projections only; contact fields, private schedules, and messages are excluded." breadcrumbs={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Users', isCurrent: true }]} />
    <FilterBar searchQuery={search} onSearchChange={setSearch} searchPlaceholder="Search name, roll number, or ID..." onClearFilters={() => setSearch('')} />
    {query.isError && <p role="alert" className="text-sm text-red-300">{query.error.message}</p>}
    <TableWrapper caption="Authorized user summaries">
      <thead><tr><th className="p-3">User</th><th className="p-3">Roll</th><th className="p-3">Department</th><th className="p-3">Role</th><th className="p-3">Consent</th><th className="p-3">Status</th></tr></thead>
      <tbody className="divide-y divide-craft-border/60">{query.data?.map((user) => <tr key={user.userId}>
        <td className="p-3 text-craft-ink">{user.displayName}<div className="text-[11px] text-craft-muted">{user.userId}</div></td>
        <td className="p-3 font-mono text-craft-muted">{user.rollNumber ?? '—'}</td><td className="p-3 text-craft-muted">{user.department ?? '—'}</td><td className="p-3 text-craft-muted">{user.role}</td>
        <td className="p-3 text-xs">Study {user.studyConsent ? 'on' : 'off'} · Social {user.socialConsent ? 'on' : 'off'}</td>
        <td className="p-3"><Badge variant={user.status === 'ACTIVE' ? 'success' : 'warning'}>{user.status}</Badge></td>
      </tr>)}</tbody>
    </TableWrapper>
  </div>;
};
