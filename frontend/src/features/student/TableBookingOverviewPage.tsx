import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Zap, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useBookingLocations } from '@/queries';
import { Loader2, AlertCircle } from 'lucide-react';
import { AppError } from '@/types';

export const TableBookingOverviewPage: React.FC = () => {
  const { data: locations, isLoading, isError, error, refetch } = useBookingLocations();
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

      {isLoading && <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-ember-400" /></div>}
      {isError && (
        <div className="p-6 rounded-xl border border-red-900/50 bg-red-950/20 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-sm text-red-200">Unable to load booking locations</p>
          <p className="text-xs text-red-300">{error instanceof AppError ? error.message : 'A temporary service error occurred.'}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      )}
      {locations && <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {locations.map((loc) => (
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
      </div>}
    </div>
  );
};
