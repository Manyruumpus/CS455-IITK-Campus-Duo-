import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { QrCode, X } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { useToast } from '@/components/ui/Toast';

export const BookingDetailPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const handleCancel = () => {
    setIsCancelOpen(false);
    addToast({
      type: 'info',
      title: 'Booking Cancelled',
      description: 'The reservation has been cancelled and the slot released.',
    });
    navigate('/app/booking/history');
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <PageHeader
        title="Reservation Pass"
        subtitle={`Booking Reference: #${bookingId || 'bk-1001'}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Table Booking', href: '/app/booking' },
          { label: 'Pass', isCurrent: true },
        ]}
      />

      <Card variant="craft" className="shadow-craft-glow">
        <CardHeader className="text-center pb-2">
          <Badge variant="success" dot className="mx-auto mb-2">Confirmed Active</Badge>
          <CardTitle className="text-xl">P.K. Kelkar Library — Table T-10</CardTitle>
          <CardDescription>2nd Floor · Quiet Collaboration Zone · 2 Seats</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 text-center">
          {/* Simulated QR Check-in Code */}
          <div className="w-40 h-40 mx-auto rounded-xl bg-craft-surface border border-craft-borderMedium flex flex-col items-center justify-center p-4">
            <QrCode className="w-24 h-24 text-ember-400" />
            <span className="font-mono text-[10px] text-craft-muted mt-2">TOKEN: IITK-PK-8842</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-left">
            <div className="p-3 rounded bg-craft-surface border border-craft-border">
              <span className="text-craft-muted">Session Window:</span>
              <p className="font-semibold text-craft-ink">16:00 – 18:00 (Today)</p>
            </div>
            <div className="p-3 rounded bg-craft-surface border border-craft-border">
              <span className="text-craft-muted">Companion Partner:</span>
              <p className="font-semibold text-craft-ink">Aarav Sharma</p>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Link to="/app/booking/history">
            <Button variant="outline" size="sm">
              All Bookings
            </Button>
          </Link>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setIsCancelOpen(true)}
            leftIcon={<X className="w-3.5 h-3.5" />}
          >
            Cancel Reservation
          </Button>
        </CardFooter>
      </Card>

      <ConfirmationDialog
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Reservation?"
        description="Are you sure you want to cancel this booking? The table will immediately become available for other students."
        confirmLabel="Yes, Cancel Booking"
        isDestructive
      />
    </div>
  );
};
