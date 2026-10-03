import React from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableWrapper } from '@/components/ui/TableWrapper';
import { Badge } from '@/components/ui/Badge';

export const AdminAuditLogsPage: React.FC = () => {
  const auditLogs = [
    { id: 'log-01', admin: 'senate-admin@iitk.ac.in', action: 'STATUS_OVERRIDE', target: 'Table T-14', details: 'Marked under scheduled maintenance', time: 'Today, 10:15' },
    { id: 'log-02', admin: 'senate-admin@iitk.ac.in', action: 'REPORT_DISMISS', target: 'Report #rep-499', details: 'Dismissed insufficient evidence', time: 'Yesterday, 16:40' },
    { id: 'log-03', admin: 'system-daemon', action: 'SLOT_AUTO_RELEASE', target: 'Table T-12', details: 'Released unconfirmed reservation', time: 'Yesterday, 14:00' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administrative Audit Stream"
        subtitle="Immutable log of administrative operations, facility overrides, and security actions."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Audit Logs', isCurrent: true },
        ]}
      />

      <TableWrapper caption="Administrative Audit Logs">
        <thead>
          <tr className="border-b border-craft-border text-craft-muted font-medium">
            <th className="p-3">Log ID</th>
            <th className="p-3">Actor</th>
            <th className="p-3">Action Type</th>
            <th className="p-3">Target Entity</th>
            <th className="p-3">Details</th>
            <th className="p-3">Timestamp</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-craft-border/60">
          {auditLogs.map((log) => (
            <tr key={log.id} className="hover:bg-craft-surface/50">
              <td className="p-3 font-mono font-semibold text-craft-subtle">{log.id}</td>
              <td className="p-3 text-craft-ink">{log.admin}</td>
              <td className="p-3">
                <Badge variant="mono">{log.action}</Badge>
              </td>
              <td className="p-3 font-medium text-craft-ink">{log.target}</td>
              <td className="p-3 text-craft-muted">{log.details}</td>
              <td className="p-3 text-craft-muted">{log.time}</td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>
    </div>
  );
};
