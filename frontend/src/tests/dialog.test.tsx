import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Dialog } from '@/components/ui/Dialog';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';

function DialogHarness() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button id="trigger-btn" onClick={() => setIsOpen(true)}>
        Open Modal
      </button>
      <Dialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Confirm Table Reservation"
        description="Check details before booking."
      >
        <div>Modal Body Content</div>
        <button id="inner-action-btn">Action Button</button>
      </Dialog>
    </div>
  );
}

describe('Accessible Dialog Component', () => {
  it('renders with role="dialog", aria-modal="true", and accessible name', () => {
    const handleClose = vi.fn();
    render(
      <Dialog
        isOpen={true}
        onClose={handleClose}
        title="Booking Details"
        description="Verify 2-person table"
      >
        <p>Dialog Content</p>
      </Dialog>
    );

    const dialog = screen.getByRole('dialog', { name: /booking details/i });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/verify 2-person table/i)).toBeInTheDocument();
  });

  it('invokes onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(
      <Dialog isOpen={true} onClose={handleClose} title="Escape Test">
        <p>Pressing escape should close this dialog.</p>
      </Dialog>
    );

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the trigger element upon closing', async () => {
    render(<DialogHarness />);

    const trigger = screen.getByRole('button', { name: /open modal/i });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    // Open dialog
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Close dialog by clicking close button
    const closeBtn = screen.getByRole('button', { name: /close dialog/i });
    fireEvent.click(closeBtn);

    // Verify dialog unmounted and focus returned
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('traps focus using Tab and Shift+Tab key navigation', () => {
    render(
      <Dialog isOpen={true} onClose={vi.fn()} title="Focus Trap Test">
        <button id="btn-1">First Child</button>
        <button id="btn-2">Second Child</button>
      </Dialog>
    );

    const closeBtn = screen.getByRole('button', { name: /close dialog/i });
    const btn1 = screen.getByRole('button', { name: /first child/i });
    const btn2 = screen.getByRole('button', { name: /second child/i });
    expect(btn1).toBeInTheDocument();

    // Close button is rendered in the header, then btn1, then btn2
    // Focus last element (btn2) and press Tab -> should wrap to first element (closeBtn)
    btn2.focus();
    expect(document.activeElement).toBe(btn2);

    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);

    // Focus first element (closeBtn) and press Shift+Tab -> should wrap to last element (btn2)
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);

    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(btn2);
  });

  it('renders ConfirmationDialog with confirm and cancel buttons', () => {
    const handleConfirm = vi.fn();
    const handleClose = vi.fn();

    render(
      <ConfirmationDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="Cancel Booking?"
        description="Are you sure you want to release this table slot?"
        confirmLabel="Confirm Release"
      />
    );

    const confirmBtn = screen.getByRole('button', { name: /confirm release/i });
    const cancelBtn = screen.getByRole('button', { name: /cancel/i });

    fireEvent.click(confirmBtn);
    expect(handleConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(cancelBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
