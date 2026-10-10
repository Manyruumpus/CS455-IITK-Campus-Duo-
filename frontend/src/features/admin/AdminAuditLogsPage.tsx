import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableWrapper } from '@/components/ui/TableWrapper';
import { Badge } from '@/components/ui/Badge';
import { useAdminAudits } from '@/queries/adminHooks';

export const AdminAuditLogsPage: React.FC = () => {
  const query = useAdminAudits();
  return <div className="space-y-6">
    <PageHeader title="Administrative Audit Stream" subtitle="Redacted append-only mock records; no durability or tamper-resistance claim." breadcrumbs={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Audit Logs', isCurrent: true }]} />
    {query.isError && <p role="alert" className="text-sm text-red-300">{query.error.message}</p>}
    <TableWrapper caption="Redacted administrative audit records">
      <thead><tr><th className="p-3">Event</th><th className="p-3">Actor</th><th className="p-3">Action</th><th className="p-3">Target</th><th className="p-3">Outcome</th><th className="p-3">Reason</th><th className="p-3">Timestamp</th></tr></thead>
      <tbody>{query.data?.map((entry) => <tr key={entry.logId} className="border-t border-craft-border/60"><td className="p-3 font-mono text-craft-subtle">{entry.logId}</td><td className="p-3 text-xs">{entry.adminId} ({entry.actorRole ?? 'ADMIN'})</td><td className="p-3"><Badge variant="mono">{entry.action}</Badge></td><td className="p-3">{entry.targetType ?? 'ENTITY'} / {entry.targetEntity}</td><td className="p-3">{entry.outcome ?? 'SUCCESS'}</td><td className="p-3 text-craft-muted">{entry.safeReason ?? '—'}</td><td className="p-3 text-craft-muted">{new Date(entry.timestamp).toLocaleString()}</td></tr>)}</tbody>
    </TableWrapper>
  </div>;
};
