import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { useToast } from '@/components/ui/Toast';

export const NewBookingPage: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [companionName, setCompanionName] = useState('Aarav Sharma');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmReservation = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsConfirmOpen(false);
      addToast({
        type: 'success',
        title: 'Reservation Confirmed',
        description: 'Table T-10 reserved at PK Kelkar Library 2nd Floor.',
      });
      navigate('/app/booking/bk-1001');
    }, 800);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <PageHeader
        title="Reserve Study Table"
        subtitle="Confirm reservation details for the canonical 2-person study table."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Table Booking', href: '/app/booking' },
          { label: 'New Reservation', isCurrent: true },
        ]}
      />

      <Card variant="craft">
        <CardHeader>
          <CardTitle>Session Details</CardTitle>
          <CardDescription>Server-authoritative collision check will be executed upon submission.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded bg-craft-surface border border-craft-border">
              <span className="text-craft-muted">Location:</span>
              <p className="font-semibold text-craft-ink">PK Kelkar Library 2F</p>
            </div>
            <div className="p-3 rounded bg-craft-surface border border-craft-border">
              <span className="text-craft-muted">Table Number:</span>
              <p className="font-semibold font-mono text-ember-400">T-10 (2-Person)</p>
            </div>
          </div>

          <Input
            label="Companion Study Partner"
            value={companionName}
            onChange={(e) => setCompanionName(e.target.value)}
            helperText="Enter your study partner's name or leave empty for solo study."
          />

          <div className="p-3 rounded-lg bg-craft-surface border border-craft-border text-xs text-craft-muted space-y-1.5">
            <div className="flex items-center gap-1.5 text-craft-ink font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Demo Policy Assumptions (Provisional — DEC-11)</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              • Maximum session duration: 2 hours per day (configurable proposal; not confirmed campus rule).
              <br />
              • Cancellations: 30-minute lead time is a provisional default under review.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Link to="/app/booking/table-grid">
            <Button variant="outline" size="sm">
              Cancel
            </Button>
          </Link>
          <Button
            variant="ember"
            size="sm"
            onClick={() => setIsConfirmOpen(true)}
          >
            Confirm Reservation
          </Button>
        </CardFooter>
      </Card>

      <ConfirmationDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirmReservation}
        title="Confirm Table Reservation"
        description="Are you sure you want to reserve Table T-10 at PK Kelkar Library for 16:00 – 18:00 today?"
        confirmLabel="Confirm & Book"
        isLoading={isSubmitting}
      />
    </div>
  );
};
