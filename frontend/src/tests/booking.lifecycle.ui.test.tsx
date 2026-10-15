import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BookingDetailPage } from '@/features/student/BookingDetailPage';
import { DemoAuthProvider } from '@/app/context/DemoAuthContext';
import { appServices } from '@/services';
import { ToastProvider } from '@/components/ui/Toast';
import { BookingRecord, StudyTableSlot } from '@/types';

vi.mock('@/services', () => ({
  appServices: {
    booking: {
      getBooking: vi.fn(),
      cancelBooking: vi.fn(),
      rescheduleBooking: vi.fn(),
      listTableAvailability: vi.fn(),
      listLocations: vi.fn(),
    },
  },
}));

describe('BookingDetailPage Lifecycle UI Suite (FR-08 & FR-09)', () => {
  let queryClient: QueryClient;

  const mockBookingCreator: BookingRecord = {
    bookingId: '00000000-0000-0000-0000-00000000d581',
    bookerId: '00000000-0000-0000-0000-00000000d501',
    participants: [
      { userId: '00000000-0000-0000-0000-00000000d501', displayName: 'Dev Student Alex', role: 'CREATOR' },
      { userId: '00000000-0000-0000-0000-00000000d502', displayName: 'Dev Student Sam', role: 'COMPANION' },
    ],
    tableId: '00000000-0000-0000-0000-00000000d572',
    tableNumber: 'DB05-A',
    locationId: '00000000-0000-0000-0000-00000000d571',
    locationName: 'P.K. Kelkar Library',
    localDate: '2026-11-14',
    slotId: '00000000-0000-0000-0000-00000000d574',
    timeWindow: '10:00 - 12:00',
    status: 'CONFIRMED',
    allowedActions: ['CANCEL', 'RESCHEDULE'],
    partnerApprovalStatus: 'NOT_REQUIRED',
    createdAt: '2026-10-14T10:00:00Z',
  };

  const mockBookingCompanion: BookingRecord = {
    ...mockBookingCreator,
    allowedActions: [],
  };

  const mockAvailableSlots: StudyTableSlot[] = [
    {
      slotId: '00000000-0000-0000-0000-00000000d575',
      tableId: '00000000-0000-0000-0000-00000000d572',
      tableNumber: 'DB05-B',
      locationId: '00000000-0000-0000-0000-00000000d571',
      date: '2026-11-15',
      startTime: '12:00',
      endTime: '14:00',
      zone: 'COLLABORATIVE_STUDY',
      status: 'AVAILABLE',
      capacity: 2,
      reservedCount: 0,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.mocked(appServices.booking.listLocations).mockResolvedValue([
      {
        id: '00000000-0000-0000-0000-00000000d571',
        name: 'P.K. Kelkar Library',
        building: 'Main Campus',
        totalTables: 10,
        openTime: '08:00',
        closeTime: '22:00',
        hasPowerOutlets: true,
        hasWifi6: true,
        noisePolicy: 'CONVERSATIONAL',
      },
    ]);

    vi.mocked(appServices.booking.listTableAvailability).mockResolvedValue(mockAvailableSlots);
  });

  const creatorSession = {
    userId: '00000000-0000-0000-0000-00000000d501',
    email: 'alex@campusduo.test',
    name: 'Dev Student Alex',
    role: 'ROLE_STUDENT' as const,
    isOnboarded: true,
    hasStudyConsent: true,
    hasSocialConsent: true,
  };

  const companionSession = {
    userId: '00000000-0000-0000-0000-00000000d502',
    email: 'sam@campusduo.test',
    name: 'Dev Student Sam',
    role: 'ROLE_STUDENT' as const,
    isOnboarded: true,
    hasStudyConsent: true,
    hasSocialConsent: true,
  };

  const renderPage = (
    bookingId: string = '00000000-0000-0000-0000-00000000d581',
    session = creatorSession
  ) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <DemoAuthProvider initialSession={session} isDemoAuthEnabled={true}>
            <MemoryRouter initialEntries={[`/app/booking/detail/${bookingId}`]}>
              <Routes>
                <Route path="/app/booking/detail/:bookingId" element={<BookingDetailPage />} />
                <Route path="/app/booking/:bookingId" element={<BookingDetailPage />} />
                <Route path="/app/booking/history" element={<div>Booking History Page</div>} />
              </Routes>
            </MemoryRouter>
          </DemoAuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    );
  };

  it('renders confirmed reservation pass with active actions for creator', async () => {
    vi.mocked(appServices.booking.getBooking).mockResolvedValue(mockBookingCreator);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('P.K. Kelkar Library — Table DB05-A')).toBeInTheDocument();
    });

    expect(screen.getByText('Cancel Reservation')).toBeEnabled();
    expect(screen.getByText('Reschedule')).toBeEnabled();
  });

  it('opens accessible modal Dialog when clicking Reschedule button', async () => {
    vi.mocked(appServices.booking.getBooking).mockResolvedValue(mockBookingCreator);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Reschedule')).toBeEnabled();
    });

    fireEvent.click(screen.getByText('Reschedule'));

    // Modal dialog should now be visible with accessible heading
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Reschedule Table Reservation')).toBeInTheDocument();
    });

    // Contains replacement guidance and options
    expect(screen.getByText(/Choose a new campus date and study slot/i)).toBeInTheDocument();
    expect(screen.getByText('Keep Current Booking')).toBeInTheDocument();
    expect(screen.getByText('Confirm Reschedule')).toBeInTheDocument();
  });

  it('successfully submits reschedule mutation and closes dialog', async () => {
    vi.mocked(appServices.booking.getBooking).mockResolvedValue(mockBookingCreator);
    const newBookingRecord: BookingRecord = {
      ...mockBookingCreator,
      bookingId: '00000000-0000-0000-0000-00000000d583',
      localDate: '2026-11-15',
      slotId: '00000000-0000-0000-0000-00000000d575',
      timeWindow: '12:00 – 14:00',
    };
    vi.mocked(appServices.booking.rescheduleBooking).mockResolvedValue(newBookingRecord);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Reschedule')).toBeEnabled();
    });

    fireEvent.click(screen.getByText('Reschedule'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Select the available slot
    const slotSelect = await screen.findByTestId('reschedule-slot-select');
    fireEvent.change(slotSelect, {
      target: { value: '00000000-0000-0000-0000-00000000d575' },
    });

    // Confirm reschedule
    const confirmBtn = screen.getByText('Confirm Reschedule');
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(appServices.booking.rescheduleBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          bookingId: '00000000-0000-0000-0000-00000000d581',
          newSlotId: '00000000-0000-0000-0000-00000000d575',
        }),
        expect.anything()
      );
    });

    // Modal should close on success
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('disables action buttons and shows demo policy notice for companion', async () => {
    vi.mocked(appServices.booking.getBooking).mockResolvedValue(mockBookingCompanion);
    renderPage('00000000-0000-0000-0000-00000000d581', companionSession);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel \(Creator Only\)/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Reschedule \(Creator Only\)/i })).toBeDisabled();
    });

    expect(screen.getByText(/Companion Read-Only Mode/i)).toBeInTheDocument();
  });
});
