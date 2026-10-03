import React, { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { TableWrapper } from '@/components/ui/TableWrapper';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

export const AdminTablesPage: React.FC = () => {
  const { addToast } = useToast();
  const [tables, setTables] = useState([
    { id: 'T-10', loc: 'PK Kelkar 2F', capacity: 2, power: true, status: 'OPERATIONAL' },
    { id: 'T-11', loc: 'PK Kelkar 2F', capacity: 2, power: true, status: 'OPERATIONAL' },
    { id: 'T-12', loc: 'PK Kelkar 2F', capacity: 2, power: true, status: 'OPERATIONAL' },
    { id: 'T-13', loc: 'PK Kelkar 2F', capacity: 2, power: false, status: 'OPERATIONAL' },
    { id: 'T-14', loc: 'PK Kelkar 2F', capacity: 2, power: true, status: 'MAINTENANCE' },
    { id: 'T-15', loc: 'PK Kelkar 2F', capacity: 2, power: false, status: 'DISABLED' },
  ]);

  const toggleStatus = (id: string) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const next = t.status === 'OPERATIONAL' ? 'MAINTENANCE' : 'OPERATIONAL';
          return { ...t, status: next };
        }
        return t;
      })
    );
    addToast({
      type: 'info',
      title: 'Table Status Updated',
      description: `Table ${id} status modified.`,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Study Table Facility Inventory"
        subtitle="Manage canonical 2-person study table inventory, maintenance outages, and power socket status."
        breadcrumbs={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Table Inventory', isCurrent: true },
        ]}
      />

      <TableWrapper caption="Study Table Facility Inventory">
        <thead>
          <tr className="border-b border-craft-border text-craft-muted font-medium">
            <th className="p-3">Table Code</th>
            <th className="p-3">Facility Location</th>
            <th className="p-3">Capacity Model</th>
            <th className="p-3">Power Socket</th>
            <th className="p-3">Current Status</th>
            <th className="p-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-craft-border/60">
          {tables.map((t) => (
            <tr key={t.id} className="hover:bg-craft-surface/50">
              <td className="p-3 font-mono font-bold text-amber-400">{t.id}</td>
              <td className="p-3 text-craft-ink">{t.loc}</td>
              <td className="p-3 text-craft-muted">{t.capacity} Seats (Canonical Pair)</td>
              <td className="p-3 text-craft-muted">{t.power ? 'AC Plug Available' : 'No Plug'}</td>
              <td className="p-3">
                <Badge variant={t.status === 'OPERATIONAL' ? 'success' : t.status === 'MAINTENANCE' ? 'warning' : 'danger'}>
                  {t.status}
                </Badge>
              </td>
              <td className="p-3 text-right">
                <Button variant="outline" size="sm" onClick={() => toggleStatus(t.id)}>
                  Toggle Status
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>
    </div>
  );
};
