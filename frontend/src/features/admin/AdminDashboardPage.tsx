import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, CalendarDays, FileText, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAdminDashboard } from '@/queries/adminHooks';

export const AdminDashboardPage: React.FC = () => {
  const query = useAdminDashboard();
  const summary = query.data;
  const metrics = [
    ['Active Locations', summary?.activeLocations ?? '—', CalendarDays],
    ['Active Tables', summary?.activeTables ?? '—', Activity],
    ['Confirmed Bookings', summary?.confirmedBookings ?? '—', CalendarDays],
    ['Pending Reports', summary?.pendingReports ?? '—', ShieldAlert],
    ['Audit Events', summary?.auditEvents ?? '—', FileText],
  ] as const;
  return (
    <div className="space-y-6">
      <PageHeader title="Campus Administration Console" subtitle="Service-backed operational counts and governance controls." badge={<Badge variant="warning">Mock admin policy</Badge>} />
      {query.isError && <p role="alert" className="text-sm text-red-300">{query.error.message}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {metrics.map(([label, value, Icon]) => (
          <Card key={label} variant="default" className="p-4">
            <div className="flex items-center justify-between"><span className="text-xs text-craft-muted">{label}</span><Icon className="w-4 h-4 text-amber-400" /></div>
            <p className="text-2xl font-bold font-mono text-craft-ink mt-2">{value}</p>
            <p className="text-[11px] text-craft-muted mt-1">Derived from current mock store</p>
          </Card>
        ))}
      </div>
      <Card variant="default">
        <CardHeader><CardTitle>Administrative surfaces</CardTitle><CardDescription>All operations remain in-memory demonstration workflows; no durable governance claims.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link to="/admin/users"><Button variant="outline" size="sm">Users</Button></Link>
          <Link to="/admin/reports"><Button variant="outline" size="sm">Reports</Button></Link>
          <Link to="/admin/tables"><Button variant="outline" size="sm">Resources</Button></Link>
          <Link to="/admin/bookings"><Button variant="outline" size="sm">Bookings</Button></Link>
          <Link to="/admin/audit-logs"><Button variant="outline" size="sm">Audit logs</Button></Link>
        </CardContent>
      </Card>
    </div>
  );
};
