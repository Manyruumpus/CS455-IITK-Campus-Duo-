import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ShieldCheck, UserCheck, AlertTriangle, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { useToast } from '@/components/ui/Toast';
import { useConnectionSummaries, useCreateBooking, useReconcileBooking, useTableAvailability } from '@/queries';
import { appConfig } from '@/config/features';
import { AppError } from '@/types';

export const NewBookingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();

  const slotId = searchParams.get('slotId') || '';
  const tableId = searchParams.get('tableId') || '';
  const tableNumber = searchParams.get('tableNumber') || '';
  const locationId = searchParams.get('locationId') || '';
  const date = searchParams.get('date') || '';
  const startTime = searchParams.get('startTime') || '';
  const endTime = searchParams.get('endTime') || '';

  // Stable client operation ID generated once per logical booking attempt
  const [clientOperationId] = useState<string>(
    () => `op-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`
  );

  const [partnerUserId, setPartnerUserId] = useState<string>('');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [uncertainState, setUncertainState] = useState<boolean>(false);

  const createBookingMutation = useCreateBooking();
  const reconcileBookingMutation = useReconcileBooking();
  const mutualConnections = useConnectionSummaries('STUDY', 'MUTUAL');
  const availability = useTableAvailability(locationId, date);
  const eligibleConnections = (mutualConnections.data ?? []).filter(
    (connection) => connection.isStudyBookingEligible && !connection.isRestricted
  );

  const handleConfirmReservation = async () => {
    await availability.refetch();
    createBookingMutation.mutate(
      {
        tableId,
        locationId,
        localDate: date,
        slotId,
        companionStudentId: partnerUserId ? partnerUserId : undefined,
        clientOperationId,
      },
      {
        onSuccess: (data) => {
          setIsConfirmOpen(false);
          setUncertainState(false);
          addToast({
            type: 'success',
            title: 'Reservation Confirmed',
            description: `Table ${data.result.tableNumber} reserved successfully at PK Kelkar Library.`,
          });
          navigate(`/app/booking/${data.result.bookingId}`);
        },
        onError: (err) => {
          setIsConfirmOpen(false);
          if (err instanceof AppError && err.code === 'UNCERTAIN_MUTATION') {
            setUncertainState(true);
            addToast({
              type: 'info',
              title: 'Uncertain Transaction State',
              description: 'Reservation was transmitted but acknowledgement was uncertain. Use reconciliation to verify status.',
            });
            return;
          }

          addToast({
            type: 'error',
            title: 'Reservation Failed',
            description:
              err instanceof AppError
                ? `${err.code}: ${err.message}`
                : 'Unable to reserve table due to an unexpected error.',
          });
        },
      }
    );
  };

  const handleReconcile = () => {
    reconcileBookingMutation.mutate(
      { clientOperationId },
      {
        onSuccess: (reconciledBooking) => {
          if (reconciledBooking) {
            addToast({
              type: 'success',
              title: 'Reservation Reconciled',
              description: `Successfully resolved booking #${reconciledBooking.bookingId}.`,
            });
            navigate(`/app/booking/${reconciledBooking.bookingId}`);
          } else {
            addToast({
              type: 'error',
              title: 'Reconciliation Unresolved',
              description: 'No committed reservation found for this operation attempt. Status remains unresolved; operation token is preserved.',
            });
          }
        },
        onError: (err) => {
          addToast({
            type: 'error',
            title: 'Reconciliation Error',
            description: err instanceof AppError ? err.message : 'Failed to query reconciliation status.',
          });
        },
      }
    );
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
          <div className="flex items-center justify-between">
            <CardTitle>Session Details</CardTitle>
            <Badge variant="outline" className="text-[10px]">
              {appConfig.demoPartnerApprovalPolicy === 'AUTO_APPROVED_DEMO'
                ? 'Demo Policy: Auto-Approved (Provisional — Pending team/user approval)'
                : 'Requires Explicit Approval'}
            </Badge>
          </div>
          <CardDescription>Server-authoritative collision check will be executed upon submission.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded bg-craft-surface border border-craft-border">
              <span className="text-craft-muted">Location:</span>
              <p className="font-semibold text-craft-ink">{locationId || 'Missing location selection'}</p>
            </div>
            <div className="p-3 rounded bg-craft-surface border border-craft-border">
              <span className="text-craft-muted">Table & Slot:</span>
              <p className="font-semibold font-mono text-ember-400">
                {tableNumber} ({startTime} – {endTime})
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded bg-craft-surface border border-craft-border text-xs flex justify-between items-center">
            <span className="text-craft-muted">Operation ID (Proposed Frontend Contract):</span>
            <span className="font-mono text-craft-ink text-[11px]">{clientOperationId}</span>
          </div>

          <div className="space-y-2">
            <label htmlFor="partner-select" className="block text-xs font-medium text-craft-muted">
              Companion Study Partner (Pair Eligibility Required)
            </label>
            <select
              id="partner-select"
              value={partnerUserId}
              onChange={(e) => setPartnerUserId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg bg-craft-surface border border-craft-border text-craft-ink focus:outline-none focus:ring-1 focus:ring-ember-500"
            >
              <option value="">Solo Study (Single Seat)</option>
              {eligibleConnections.map((connection) => (
                <option key={connection.peerId} value={connection.peerId}>
                  {connection.peerDisplayName} (Eligible Mutual Study Partner)
                </option>
              ))}
            </select>
            <p className="text-[11px] text-craft-subtle">
              Selecting an ineligible contact demonstrates reciprocal study partner verification enforcement.
            </p>
          </div>

          {uncertainState && (
            <div className="p-4 rounded-lg bg-amber-950/40 border border-amber-500/50 space-y-3">
              <div className="flex items-start gap-2 text-amber-200">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-xs">Uncertain Submission State</p>
                  <p className="text-[11px] text-amber-300 leading-relaxed mt-0.5">
                    Your reservation request was transmitted, but confirmation acknowledgement was uncertain.
                    Do not submit a duplicate request. Reconcile this attempt with your stable client operation ID.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ember"
                  size="sm"
                  onClick={handleReconcile}
                  isLoading={reconcileBookingMutation.isPending}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Reconcile Reservation
                </Button>
              </div>
            </div>
          )}

          {createBookingMutation.isError && !uncertainState && (
            <div className="p-3 rounded bg-red-950/30 border border-red-500/40 text-xs text-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Booking Conflict or Permission Rejection</p>
                <p className="text-[11px] text-red-300">
                  {createBookingMutation.error instanceof AppError
                    ? createBookingMutation.error.message
                    : 'Reservation could not be completed.'}
                </p>
              </div>
            </div>
          )}

          {createBookingMutation.isError &&
            createBookingMutation.error instanceof AppError &&
            createBookingMutation.error.code === 'CONFLICT' &&
            availability.data && (
              <div className="p-3 rounded bg-amber-950/30 border border-amber-500/40 text-xs text-amber-200 space-y-2">
                <p className="font-semibold">Selected slot is no longer available</p>
                <p className="text-[11px] text-amber-300">
                  Choose an explicitly listed alternative. The table, date, slot, and companion will not be changed automatically.
                </p>
                <div className="flex flex-wrap gap-2">
                  {availability.data
                    .filter((slot) => slot.status === 'AVAILABLE' && slot.slotId !== slotId)
                    .map((slot) => (
                      <Link
                        key={slot.slotId}
                        to={`/app/booking/new?slotId=${slot.slotId}&tableId=${slot.tableId ?? slot.slotId}&tableNumber=${slot.tableNumber}&date=${slot.date}&startTime=${slot.startTime}&endTime=${slot.endTime}&locationId=${slot.locationId}`}
                      >
                        <Button variant="outline" size="sm">
                          {slot.tableNumber} · {slot.startTime}–{slot.endTime}
                        </Button>
                      </Link>
                    ))}
                </div>
              </div>
            )}

          <div className="p-3 rounded-lg bg-craft-surface border border-craft-border text-xs text-craft-muted space-y-1.5">
            <div className="flex items-center gap-1.5 text-craft-ink font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Demonstration Assumptions (Provisional — DEC-11)</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              • Two-hour session limits and advance booking windows are unapproved demonstration assumptions under DEC-11, not official campus policy.
              <br />
              • Table reservation transactions are simulated in this interface.
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
            isLoading={createBookingMutation.isPending}
            disabled={uncertainState || !slotId || !tableId || !locationId || !date || !partnerUserId}
            rightIcon={<UserCheck className="w-3.5 h-3.5" />}
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
        description={`Reserve Table ${tableNumber} at PK Kelkar Library for ${startTime} – ${endTime} on ${date}?`}
        confirmLabel="Confirm & Book"
        isLoading={createBookingMutation.isPending}
      />
    </div>
  );
};
