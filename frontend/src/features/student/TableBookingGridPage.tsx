import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MOCK_TABLE_SLOTS } from '@/mocks';

export const TableBookingGridPage: React.FC = () => {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>('slot-pk-10');

  const selectedSlot = MOCK_TABLE_SLOTS.find((s) => s.slotId === selectedSlotId);

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
            <Badge variant="success" dot>2 Available</Badge>
            <Badge variant="warning" dot>1 Reserved</Badge>
            <Badge variant="danger" dot>1 Occupied</Badge>
          </div>
        }
      />

      {/* Grid of 2-Person Tables */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {MOCK_TABLE_SLOTS.map((slot) => {
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
            <Link to="/app/booking/new">
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
