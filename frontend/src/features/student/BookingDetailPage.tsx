import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { QrCode, X, AlertTriangle, Loader2, ArrowLeft, Users, ShieldAlert, CalendarClock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { Dialog } from '@/components/ui/Dialog';
import { useToast } from '@/components/ui/Toast';
import { useBookingDetail, useCancelBooking, useRescheduleBooking, useTableAvailability, useBookingLocations } from '@/queries';
import { AppError } from '@/types';

export const BookingDetailPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newSlotId, setNewSlotId] = useState('');

  const effectiveBookingId = bookingId || 'bk-1001';
  const { data: booking, isLoading, isError, error } = useBookingDetail(effectiveBookingId);
  const locationsQuery = useBookingLocations();
  const cancelBookingMutation = useCancelBooking();
  const rescheduleBookingMutation = useRescheduleBooking();
  const activeLocationId = selectedLocationId || (booking?.locationId ?? '');
  const proposedAvailability = useTableAvailability(activeLocationId, newDate);

  const handleCancel = () => {
    cancelBookingMutation.mutate(
      {
        bookingId: effectiveBookingId,
        reason: 'User requested cancellation from reservation pass',
      },
      {
        onSuccess: () => {
          setIsCancelOpen(false);
          addToast({
            type: 'info',
            title: 'Reservation Cancelled',
            description: `Booking #${effectiveBookingId} has been successfully cancelled.`,
          });
          navigate('/app/booking/history');
        },
        onError: (err) => {
          setIsCancelOpen(false);
          addToast({
            type: 'error',
            title: 'Cancellation Failed',
            description:
              err instanceof AppError
                ? err.message
                : 'Unable to cancel reservation at this time.',
          });
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="p-16 text-center flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-ember-400" />
        <p className="text-sm text-craft-muted">Loading reservation details...</p>
      </div>
    );
  }

  if (isError || !booking) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 rounded-xl border border-red-900/40 bg-red-950/20">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
        <h2 className="text-lg font-bold text-red-200">Reservation Not Found or Access Denied</h2>
        <p className="text-xs text-red-300">
          {error instanceof AppError ? error.message : 'Could not retrieve booking details.'}
        </p>
        <Link to="/app/booking/history">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Booking History
          </Button>
        </Link>
      </div>
    );
  }

  const isCancelled = booking.status === 'CANCELLED';
  const canCancel = booking.allowedActions.includes('CANCEL');
  const canReschedule = booking.allowedActions.includes('RESCHEDULE');
  const availableAlternatives = (proposedAvailability.data ?? []).filter(
    (slot) => slot.status === 'AVAILABLE' && !(slot.slotId === booking.slotId && slot.date === booking.localDate)
  );

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      <PageHeader
        title="Reservation Details"
        subtitle={`Booking Reference: #${booking.bookingId}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Table Booking', href: '/app/booking' },
          { label: 'Pass', isCurrent: true },
        ]}
      />

      <Card variant="craft" className="shadow-craft-glow">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center gap-2 mb-2">
            <Badge variant={isCancelled ? 'danger' : 'success'} dot>
              {booking.status}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Approval: {booking.partnerApprovalStatus}
            </Badge>
          </div>
          <CardTitle className="text-xl flex flex-col items-center gap-1.5">
            <span>{booking.locationName} — Table {booking.tableNumber}</span>
          </CardTitle>
          <CardDescription>
            Date: {booking.localDate} · 2 Seats (Canonical Pair)
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 text-center">
          <div className="w-56 mx-auto rounded-xl bg-craft-surface border border-craft-borderMedium flex flex-col items-center justify-center p-4 space-y-2">
            <QrCode className="w-24 h-24 text-ember-400" />
            <span className="font-mono text-[10px] text-craft-muted">
              Booking reference: {booking.bookingId.toUpperCase()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-left">
            <div className="p-3 rounded bg-craft-surface border border-craft-border">
              <span className="text-craft-muted">Session Window:</span>
              <p className="font-semibold text-craft-ink">
                {booking.timeWindow}
              </p>
              <span className="text-[10px] text-craft-subtle">Reserved for your selected study session</span>
            </div>
            <div className="p-3 rounded bg-craft-surface border border-craft-border">
              <span className="text-craft-muted">Booking reference:</span>
              <p className="font-semibold font-mono text-craft-ink truncate">
                {booking.clientOperationId ?? booking.bookingId}
              </p>
              <span className="text-[10px] text-craft-subtle">Stable attempt token</span>
            </div>
          </div>

          {/* Explicit Multi-Participant Roster */}
          <div className="p-3 rounded bg-craft-surface border border-craft-border text-xs text-left space-y-2">
            <div className="flex items-center gap-1.5 font-medium text-craft-ink">
              <Users className="w-4 h-4 text-ember-400" />
              <span>Booking Participants</span>
            </div>
            <div className="space-y-1.5">
              {booking.participants.map((p) => (
                <div
                  key={p.userId}
                  className="flex items-center justify-between p-2 rounded bg-craft-base border border-craft-border"
                >
                  <div>
                    <span className="font-semibold text-craft-ink">{p.displayName}</span>
                    <span className="text-[11px] text-craft-muted ml-1.5 font-mono">({p.userId})</span>
                  </div>
                  <Badge variant={p.role === 'CREATOR' ? 'ember' : 'default'} className="text-[10px]">
                    {p.role}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {!canCancel && !isCancelled && (
            <div className="p-3 rounded bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2 text-left">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Companion access</p>
                <p className="text-[11px] text-amber-300">
                  Only the booking creator or an administrator can cancel or reschedule this reservation.
                </p>
              </div>
            </div>
          )}
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
            disabled={isCancelled || !canCancel}
            onClick={() => setIsCancelOpen(true)}
            leftIcon={<X className="w-3.5 h-3.5" />}
          >
            {isCancelled ? 'Already Cancelled' : canCancel ? 'Cancel Reservation' : 'Cancel (Creator Only)'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isCancelled || !canReschedule}
            onClick={() => {
              setSelectedLocationId(booking.locationId);
              setNewDate(booking.localDate);
              setNewSlotId('');
              setIsRescheduleOpen(true);
            }}
            leftIcon={<CalendarClock className="w-3.5 h-3.5" />}
          >
            {canReschedule ? 'Reschedule' : 'Reschedule (Creator Only)'}
          </Button>
        </CardFooter>
      </Card>

      <Dialog
        isOpen={isRescheduleOpen}
        onClose={() => setIsRescheduleOpen(false)}
        title="Reschedule Table Reservation"
        description="Choose a new campus date and study slot. The original reservation remains completely intact if the replacement slot conflicts or fails."
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsRescheduleOpen(false)}
            >
              Keep Current Booking
            </Button>
            <Button
              variant="ember"
              size="sm"
              disabled={!newDate || !newSlotId || rescheduleBookingMutation.isPending}
              isLoading={rescheduleBookingMutation.isPending}
              onClick={() => {
                rescheduleBookingMutation.mutate(
                  {
                    bookingId: effectiveBookingId,
                    newLocalDate: newDate,
                    newSlotId,
                  },
                  {
                    onSuccess: (data) => {
                      setIsRescheduleOpen(false);
                      addToast({
                        type: 'info',
                        title: 'Reservation Rescheduled',
                        description: `Successfully rescheduled to Table ${data.result.tableNumber || ''} (${data.result.timeWindow || newDate}).`,
                      });
                      if (data.result.bookingId && data.result.bookingId !== effectiveBookingId) {
                        navigate(`/app/booking/${data.result.bookingId}`);
                      }
                    },
                    onError: (err) => {
                      addToast({
                        type: 'error',
                        title: 'Rescheduling Failed',
                        description:
                          err instanceof AppError
                            ? err.message
                            : 'Unable to reschedule; the original booking remains unchanged.',
                      });
                    },
                  }
                );
              }}
            >
              Confirm Reschedule
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-craft-surface border border-craft-border text-xs space-y-1">
            <span className="text-craft-muted font-medium">Current Reservation:</span>
            <p className="font-semibold text-craft-ink">
              {booking.locationName} · Table {booking.tableNumber}
            </p>
            <p className="text-craft-muted">
              {booking.localDate} ({booking.timeWindow})
            </p>
          </div>

          <label className="block text-xs text-craft-muted">
            Campus Study Location
            <select
              value={activeLocationId}
              onChange={(e) => {
                setSelectedLocationId(e.target.value);
                setNewSlotId('');
              }}
              className="block w-full mt-1 px-3 py-2 rounded-lg bg-craft-surface border border-craft-border text-craft-ink"
            >
              {(locationsQuery.data ?? []).map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} ({loc.building})
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-craft-muted">
            Proposed Campus Date (Asia/Kolkata)
            <input
              type="date"
              value={newDate}
              onChange={(event) => {
                setNewDate(event.target.value);
                setNewSlotId('');
              }}
              className="block w-full mt-1 px-3 py-2 rounded-lg bg-craft-surface border border-craft-border text-craft-ink"
            />
          </label>

          <label className="block text-xs text-craft-muted">
            Available Study Table Slot
            {proposedAvailability.isLoading ? (
              <div className="flex items-center gap-2 p-3 text-xs text-craft-muted">
                <Loader2 className="w-4 h-4 animate-spin text-ember-400" />
                <span>Checking available slots...</span>
              </div>
            ) : availableAlternatives.length === 0 ? (
              <div className="p-3 rounded-lg bg-amber-950/20 border border-amber-500/30 text-xs text-amber-300 mt-1">
                No available table slots for this date and location. Please select another date or location.
              </div>
            ) : (
              <select
                value={newSlotId}
                onChange={(event) => setNewSlotId(event.target.value)}
                className="block w-full mt-1 px-3 py-2 rounded-lg bg-craft-surface border border-craft-border text-craft-ink"
                data-testid="reschedule-slot-select"
              >
                <option value="">Select an available slot</option>
                {availableAlternatives.map((slot) => (
                  <option key={slot.slotId} value={slot.slotId}>
                    Table {slot.tableNumber} · {slot.startTime} – {slot.endTime} ({slot.zone.replace(/_/g, ' ')})
                  </option>
                ))}
              </select>
            )}
          </label>

          {proposedAvailability.isError && (
            <p className="text-xs text-red-300">{proposedAvailability.error.message}</p>
          )}

          {rescheduleBookingMutation.isError && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-xs text-red-200">
              {rescheduleBookingMutation.error instanceof AppError
                ? rescheduleBookingMutation.error.message
                : 'Unable to reschedule; the original booking remains unchanged.'}
            </div>
          )}
        </div>
      </Dialog>

      <ConfirmationDialog
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Table Reservation?"
        description={`Are you sure you want to release Table ${booking.tableNumber} for ${booking.timeWindow}?`}
        confirmLabel="Yes, Cancel Booking"
        isLoading={cancelBookingMutation.isPending}
        isDestructive
      />
    </div>
  );
};
