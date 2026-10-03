import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ShieldAlert, FileText, Activity } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export const AdminDashboardPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Campus Administration Console"
        subtitle="Manage study table facility capacity, student directory moderation, and campus audit streams."
        badge={<Badge variant="warning">Student Senate / Facilities</Badge>}
      />

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card variant="default" className="p-4 border-amber-900/30">
          <div className="flex items-center justify-between">
            <span className="text-xs text-craft-muted">Active Tables</span>
            <CalendarDays className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-craft-ink mt-2">64</p>
          <p className="text-[11px] text-emerald-400 mt-1">24 Library · 40 CC</p>
        </Card>

        <Card variant="default" className="p-4 border-amber-900/30">
          <div className="flex items-center justify-between">
            <span className="text-xs text-craft-muted">Slot Occupancy</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-craft-ink mt-2">72%</p>
          <p className="text-[11px] text-craft-muted mt-1">Peak afternoon window</p>
        </Card>

        <Card variant="default" className="p-4 border-amber-900/30">
          <div className="flex items-center justify-between">
            <span className="text-xs text-craft-muted">Pending Reports</span>
            <ShieldAlert className="w-4 h-4 text-red-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-craft-ink mt-2">3</p>
          <p className="text-[11px] text-amber-400 mt-1">Requires review</p>
        </Card>

        <Card variant="default" className="p-4 border-amber-900/30">
          <div className="flex items-center justify-between">
            <span className="text-xs text-craft-muted">Audit Events (24h)</span>
            <FileText className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-craft-ink mt-2">128</p>
          <p className="text-[11px] text-craft-muted mt-1">All logged</p>
        </Card>
      </div>

      {/* Quick Action Navigation Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="default">
          <CardHeader>
            <CardTitle>Moderation Queue</CardTitle>
            <CardDescription>Review reported student interactions and conduct flags.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded bg-craft-surface border border-craft-border text-xs flex items-center justify-between">
              <div>
                <span className="font-semibold text-craft-ink">Flagged Profile #iitk-ug-9921</span>
                <p className="text-[11px] text-craft-muted">Category: Unauthorized Promotion</p>
              </div>
              <Link to="/admin/reports">
                <Button variant="outline" size="sm">Inspect</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card variant="default">
          <CardHeader>
            <CardTitle>Facility Controls</CardTitle>
            <CardDescription>Toggle maintenance status or modify slot limits.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded bg-craft-surface border border-craft-border text-xs flex items-center justify-between">
              <div>
                <span className="font-semibold text-craft-ink">PK Kelkar Library 2nd Floor</span>
                <p className="text-[11px] text-craft-muted">Status: 24 Tables Active</p>
              </div>
              <Link to="/admin/tables">
                <Button variant="outline" size="sm">Manage</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
