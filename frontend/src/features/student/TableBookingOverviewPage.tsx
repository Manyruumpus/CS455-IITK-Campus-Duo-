import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Zap, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MOCK_LOCATIONS } from '@/mocks';

export const TableBookingOverviewPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Study Table Booking Zones"
        subtitle="Reserve physical canonical two-person study tables at PK Kelkar Library and Computer Centre."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Table Booking', isCurrent: true },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/app/booking/history">
              <Button variant="outline" size="sm">
                Booking History
              </Button>
            </Link>
            <Link to="/app/booking/table-grid">
              <Button variant="ember" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                View Live Grid
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MOCK_LOCATIONS.map((loc) => (
          <Card key={loc.id} variant="default" className="flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{loc.name}</CardTitle>
                <Badge variant="success" dot>Operational</Badge>
              </div>
              <CardDescription className="flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5 text-craft-muted" />
                <span>{loc.building}</span>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded bg-craft-surface border border-craft-border">
                  <span className="text-craft-muted">Capacity:</span>
                  <p className="font-semibold text-craft-ink">{loc.totalTables} Tables (2-Person)</p>
                </div>
                <div className="p-2.5 rounded bg-craft-surface border border-craft-border">
                  <span className="text-craft-muted">Operating Hours:</span>
                  <p className="font-semibold text-craft-ink">{loc.openTime} – {loc.closeTime}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-craft-muted">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>{loc.hasPowerOutlets ? 'Individual Power Sockets' : 'Shared Power'}</span>
                <span>·</span>
                <span>Noise: {loc.noisePolicy.replace('_', ' ')}</span>
              </div>
            </CardContent>

            <CardFooter className="pt-2">
              <span className="text-[11px] text-craft-muted">Canonical 2-person table pair</span>
              <Link to="/app/booking/table-grid">
                <Button variant="ember" size="sm">
                  View Slots
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};
