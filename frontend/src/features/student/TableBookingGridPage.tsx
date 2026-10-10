import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Clock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useTableAvailability } from '@/queries';
import { AppError } from '@/types';

export const TableBookingGridPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const locationId = searchParams.get('locationId') || 'loc-pk-kelkar-2f';
  const selectedDate = searchParams.get('date') || '2026-10-08';
  const { data: slots, isLoading, isError, error, refetch } = useTableAvailability(locationId, selectedDate);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const selectedSlot = slots?.find((s) => s.slotId === selectedSlotId);

  const availableCount = slots?.filter((s) => s.status === 'AVAILABLE').length ?? 0;
  const reservedCount = slots?.filter((s) => s.status === 'RESERVED').length ?? 0;
  const occupiedCount = slots?.filter((s) => s.status === 'OCCUPIED').length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Table Availability Matrix"
        subtitle="Canonical 2-person shared study tables at P.K. Kelkar Library (2nd Floor Quiet Zone)."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Table Booking', href: '/app/booking' },
          { label: 'Availability Grid', isCurrent: true },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="success" dot>{availableCount} Available</Badge>
            <Badge variant="warning" dot>{reservedCount} Reserved</Badge>
            <Badge variant="danger" dot>{occupiedCount} Occupied</Badge>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-craft-border bg-craft-card">
        <label className="text-xs text-craft-muted">
          Campus date (Asia/Kolkata)
          <input
            aria-label="Booking date"
            type="date"
            value={selectedDate}
            onChange={(event) => {
              setSelectedSlotId(null);
              setSearchParams({ locationId, date: event.target.value });
            }}
            className="block mt-1 px-3 py-2 rounded-lg bg-craft-surface border border-craft-border text-craft-ink"
          />
        </label>
        <p className="text-[11px] text-craft-subtle pb-2">Times shown in campus local time (Asia/Kolkata).</p>
      </div>

      {isLoading && (
        <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-ember-400" />
          <p className="text-sm text-craft-muted">Fetching live table slot occupancy...</p>
        </div>
      )}

      {isError && (
        <div className="p-6 rounded-xl border border-red-900/50 bg-red-950/20 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <h3 className="text-sm font-semibold text-red-200">Unable to load table availability</h3>
          <p className="text-xs text-red-300">
            {error instanceof AppError ? error.message : 'A temporary error occurred reading table data.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry Query
          </Button>
        </div>
      )}

      {/* Grid of 2-Person Tables */}
      {slots && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {slots.map((slot) => {
            const isSelected = selectedSlotId === slot.slotId;
            const statusColors = {
              AVAILABLE: 'border-emerald-500/40 bg-emerald-950/20 hover:border-emerald-400',
              OCCUPIED: 'border-red-900/30 bg-red-950/10 opacity-60 cursor-not-allowed',
              RESERVED: 'border-amber-500/40 bg-amber-950/20 hover:border-amber-400',
              LOCKED_MAINTENANCE: 'border-zinc-800 bg-zinc-900/30 opacity-40 cursor-not-allowed',
            }[slot.status];

            return (
              <button
                key={slot.slotId}
                type="button"
                disabled={slot.status === 'OCCUPIED' || slot.status === 'LOCKED_MAINTENANCE'}
                onClick={() => setSelectedSlotId(slot.slotId)}
                className={`p-4 rounded-xl border text-left transition-all ${statusColors} ${
                  isSelected ? 'ring-2 ring-ember-500 border-ember-500 shadow-craft-glow' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-sm font-bold text-craft-ink">{slot.tableNumber}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      slot.status === 'AVAILABLE'
                        ? 'bg-emerald-400'
                        : slot.status === 'RESERVED'
                        ? 'bg-amber-400'
                        : 'bg-red-400'
                    }`}
                  />
                </div>
                <p className="text-xs text-craft-muted">{slot.capacity} Seats (Canonical Pair)</p>
                <p className="text-[11px] font-mono text-craft-subtle uppercase mt-1">{slot.status}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Reservation Action Banner */}
      {selectedSlot && (
        <div className="p-5 rounded-xl border border-craft-borderCraft bg-craft-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 craft-radial-glow">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-craft-ink">Selected Table:</span>
              <span className="font-mono font-bold text-ember-400">{selectedSlot.tableNumber}</span>
              <Badge variant="mono">{selectedSlot.zone.replace('_', ' ')}</Badge>
            </div>
            <p className="text-xs text-craft-muted flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-ember-400" />
              <span>Time Slot: {selectedSlot.startTime} – {selectedSlot.endTime} (Date: {selectedSlot.date})</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button variant="outline" size="sm" onClick={() => setSelectedSlotId(null)}>
              Clear
            </Button>
            <Link
              to={`/app/booking/new?slotId=${selectedSlot.slotId}&tableId=${selectedSlot.tableId ?? selectedSlot.slotId}&tableNumber=${selectedSlot.tableNumber}&date=${selectedSlot.date}&startTime=${selectedSlot.startTime}&endTime=${selectedSlot.endTime}&locationId=${selectedSlot.locationId}`}
            >
              <Button variant="ember" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                Proceed to Reservation
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
