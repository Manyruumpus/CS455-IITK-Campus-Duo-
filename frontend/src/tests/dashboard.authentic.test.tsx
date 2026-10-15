import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DemoAuthProvider } from '@/app/context/DemoAuthContext';
import { StudentDashboardPage } from '@/features/student/StudentDashboardPage';
import { mockStore } from '@/mocks/store';
import { UserSession } from '@/types';

function renderDashboard(session: UserSession) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DemoAuthProvider initialSession={session} isDemoAuthEnabled={true} queryClient={queryClient}>
        <MemoryRouter initialEntries={['/app/dashboard']}>
          <Routes>
            <Route path="/app/dashboard" element={<StudentDashboardPage />} />
          </Routes>
        </MemoryRouter>
      </DemoAuthProvider>
    </QueryClientProvider>
  );
}

describe('Authentic Student Dashboard Suite (TE-009 & KAN-35)', () => {
  beforeEach(() => {
    mockStore.reset();
  });

  it('renders authentic first-time greeting and zero-state cards for a fresh student', async () => {
    const freshSession: UserSession = {
      userId: 'usr-student-fresh',
      email: 'fresh.student@iitk.ac.in',
      name: 'Fresh Student',
      rollNumber: '210001',
      role: 'ROLE_STUDENT',
      isOnboarded: false,
      hasStudyConsent: false,
      hasSocialConsent: false,
      isFirstLogin: true,
    };

    renderDashboard(freshSession);

    // 1. First-time greeting
    expect(await screen.findByText(/welcome, fresh student/i)).toBeInTheDocument();
    expect(screen.queryByText(/welcome back/i)).not.toBeInTheDocument();

    // 2. Truthful zero reservations state (no hardcoded Table T-12 / bk-1001)
    expect(screen.getByText(/no upcoming reservations/i)).toBeInTheDocument();
    expect(screen.queryByText(/table t-12/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/bk-1001/i)).not.toBeInTheDocument();

    // 3. Truthful zero enrolled courses state (no hardcoded CS455, MTH101, ESC102)
    expect(screen.getByText(/no courses added yet/i)).toBeInTheDocument();

    // 4. Relabeled Study Table Locations section
    expect(screen.getByText(/study table locations/i)).toBeInTheDocument();
    expect(screen.queryByText(/shared table reservations/i)).not.toBeInTheDocument();

    // 5. Computer Centre CC-101 accurately reflects "No slots available"
    expect(await screen.findByText(/computer centre/i)).toBeInTheDocument();
    expect(await screen.findByText(/no slots available/i)).toBeInTheDocument();
  });

  it('renders returning user greeting, enrolled courses, and confirmed booking when active', async () => {
    const returningSession: UserSession = {
      userId: 'usr-student-alex',
      email: 'alex.rivera@iitk.ac.in',
      name: 'Alex Rivera',
      rollNumber: '200001',
      role: 'ROLE_STUDENT',
      isOnboarded: true,
      hasStudyConsent: true,
      hasSocialConsent: false,
      isFirstLogin: false,
    };

    renderDashboard(returningSession);

    // 1. Returning user greeting
    expect(await screen.findByText(/welcome back, alex rivera/i)).toBeInTheDocument();

    // 2. Profile courses are rendered
    expect(await screen.findByText('CS455')).toBeInTheDocument();

    // 3. Study Table Locations is active with P.K. Kelkar and CC-101
    const pkMatches = await screen.findAllByText(/p\.k\. kelkar library/i);
    expect(pkMatches.length).toBeGreaterThanOrEqual(1);

    expect(await screen.findByText(/computer centre/i)).toBeInTheDocument();
    expect(await screen.findByText(/no slots available/i)).toBeInTheDocument();
  });
});
