import React, { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableWrapper } from '@/components/ui/TableWrapper';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { useToast } from '@/components/ui/Toast';

export const AdminReportsPage: React.FC = () => {
  const { addToast } = useToast();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  const reports = [
    {
      id: 'rep-501',
      reportedUser: 'Student #200912',
      reporter: 'Student #210884',
      category: 'Unauthorized Promotion',
      description: 'Repeatedly sending commercial coaching links in study partnership requests.',
      timestamp: 'Today, 11:30',
      status: 'PENDING_REVIEW',
    },
    {
      id: 'rep-502',
      reportedUser: 'Student #230114',
      reporter: 'Student #220191',
      category: 'Inappropriate Content',
      description: 'Using offensive language in social bio tag description.',
      timestamp: 'Yesterday',
      status: 'PENDING_REVIEW',
    },
  ];

  const handleResolve = () => {
    addToast({
      type: 'success',
      title: 'Report Resolved',
      description: `Report #${selectedReportId} marked as dismissed/warned. Action logged.`,
    });
    setSelectedReportId(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Moderation Queue"
        subtitle="Review reported interactions and policy violations submitted by students."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Moderation Reports', isCurrent: true },
        ]}
      />

      <TableWrapper caption="Moderation Reports Queue">
        <thead>
          <tr className="border-b border-craft-border text-craft-muted font-medium">
            <th className="p-3">Report ID</th>
            <th className="p-3">Reported User</th>
            <th className="p-3">Category</th>
            <th className="p-3">Description</th>
            <th className="p-3">Timestamp</th>
            <th className="p-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-craft-border/60">
          {reports.map((r) => (
            <tr key={r.id} className="hover:bg-craft-surface/50">
              <td className="p-3 font-mono font-semibold text-amber-400">{r.id}</td>
              <td className="p-3 text-craft-ink">{r.reportedUser}</td>
              <td className="p-3">
                <Badge variant="warning">{r.category}</Badge>
              </td>
              <td className="p-3 text-craft-muted max-w-xs">{r.description}</td>
              <td className="p-3 text-craft-muted">{r.timestamp}</td>
              <td className="p-3 text-right">
                <Button variant="outline" size="sm" onClick={() => setSelectedReportId(r.id)}>
                  Review
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>

      <ConfirmationDialog
        isOpen={!!selectedReportId}
        onClose={() => setSelectedReportId(null)}
        onConfirm={handleResolve}
        title="Resolve Moderation Report"
        description="Select resolution for this flagged incident. The user will be notified of administrative actions."
        confirmLabel="Resolve & Close"
      />
    </div>
  );
};
