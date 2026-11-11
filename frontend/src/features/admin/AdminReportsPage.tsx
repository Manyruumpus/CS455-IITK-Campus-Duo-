import React, { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableWrapper } from '@/components/ui/TableWrapper';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useAdminReports, useResolveAdminReport } from '@/queries/adminHooks';

export const AdminReportsPage: React.FC = () => {
  const query = useAdminReports();
  const resolve = useResolveAdminReport();
  const [selected, setSelected] = useState<string | null>(null);
  const [action, setAction] = useState<'DISMISS' | 'WARN_USER' | 'SUSPEND_USER'>('DISMISS');
  const [reason, setReason] = useState('');
  const report = query.data?.find((item) => item.reportId === selected);
  return <div className="space-y-6">
    <PageHeader title="Moderation Queue" subtitle="Admin-only report review. Resolving a report does not automatically penalize its target." breadcrumbs={[{ label: 'Admin', href: '/admin/dashboard' }, { label: 'Reports', isCurrent: true }]} />
    {query.isError && <p role="alert" className="text-sm text-red-300">{query.error.message}</p>}
    <TableWrapper caption="Pending and resolved moderation reports">
      <thead><tr><th className="p-3">Report</th><th className="p-3">Reported user</th><th className="p-3">Category</th><th className="p-3">Description</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead>
      <tbody className="divide-y divide-craft-border/60">{query.data?.map((item) => <tr key={item.reportId}>
        <td className="p-3 font-mono text-amber-400">{item.reportId}</td><td className="p-3">{item.reportedUserName}</td><td className="p-3"><Badge variant="warning">{item.category}</Badge></td>
        <td className="p-3 text-craft-muted max-w-xs">{item.description || 'No description supplied'}</td><td className="p-3"><Badge variant={item.status === 'PENDING_REVIEW' ? 'warning' : 'outline'}>{item.status}</Badge></td>
        <td className="p-3">{item.status === 'PENDING_REVIEW' ? <Button variant="outline" size="sm" onClick={() => setSelected(item.reportId)}>Review</Button> : '—'}</td>
      </tr>)}</tbody>
    </TableWrapper>
    <Dialog isOpen={!!selected} onClose={() => setSelected(null)} title="Resolve moderation report" description={report ? `Review ${report.reportId}. Reporter identity and confidential notes remain restricted to this admin view.` : ''} footer={<>
      <Button variant="outline" size="sm" onClick={() => setSelected(null)} disabled={resolve.isPending}>Cancel</Button>
      <Button variant="danger" size="sm" isLoading={resolve.isPending} disabled={!reason.trim() || resolve.isPending} onClick={() => {
        if (!selected || !reason.trim()) return;
        resolve.mutate({ reportId: selected, action, reason, confirm: true }, { onSuccess: () => { setSelected(null); setReason(''); } });
      }}>Confirm resolution</Button>
    </>}>
      <div className="space-y-2">
        <label className="text-xs" htmlFor="admin-report-action">Outcome</label>
        <select id="admin-report-action" value={action} onChange={(event) => setAction(event.target.value as typeof action)} className="w-full bg-craft-base border border-craft-border rounded px-2 py-1 text-xs">
          <option value="DISMISS">Dismiss report</option><option value="WARN_USER">Record warning (demo report outcome only)</option><option value="SUSPEND_USER">Record suspension recommendation (pending policy; does not suspend account)</option>
        </select>
        <label className="text-xs" htmlFor="admin-report-reason">Required reason</label>
        <textarea id="admin-report-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} className="w-full bg-craft-base border border-craft-border rounded px-2 py-1 text-xs" />
        {resolve.isError && <p role="alert" className="text-xs text-red-300">{resolve.error.message}</p>}
      </div>
    </Dialog>
  </div>;
};
