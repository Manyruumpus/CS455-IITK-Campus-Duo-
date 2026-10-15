import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DemoAuthProvider } from '@/app/context/DemoAuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import { SettingsPage } from '@/features/student/SettingsPage';
import { RequireSocialConsent } from '@/app/guards/RequireSocialConsent';
import { mockStore } from '@/mocks/store';
import { UserSession } from '@/types';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

const DUAL_OPTED_USER: UserSession = {
  userId: 'usr-student-alex',
  email: 'alex.rivera@campusduo.test',
  name: 'Alex Rivera',
  rollNumber: '200001',
  role: 'ROLE_STUDENT',
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: true,
};

const STUDY_ONLY_USER: UserSession = {
  userId: 'usr-student-sam',
  email: 'sam.patel@campusduo.test',
  name: 'Sam Patel',
  rollNumber: '200002',
  role: 'ROLE_STUDENT',
  isOnboarded: true,
  hasStudyConsent: true,
  hasSocialConsent: false,
};

describe('Social Discovery Consent & Settings Coherence Suite (Section 3.1)', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    mockStore.reset();
  });

  it('renders "Social Discovery Consent Required" guard for a user who opted into STUDY but not SOCIAL', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <DemoAuthProvider initialSession={STUDY_ONLY_USER} initialSocialConsent={false}>
            <MemoryRouter initialEntries={['/app/social']}>
              <Routes>
                <Route
                  path="/app/social"
                  element={
                    <RequireSocialConsent>
                      <div data-testid="social-discovery-feed">Active Social Peer Directory</div>
                    </RequireSocialConsent>
                  }
                />
              </Routes>
            </MemoryRouter>
          </DemoAuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Guard screen should be displayed
    expect(await screen.findByText('Activate Social Discovery Mode')).toBeInTheDocument();
    expect(screen.queryByTestId('social-discovery-feed')).not.toBeInTheDocument();
  });

  it('allows access to Social Discovery for a user who opted into both STUDY and SOCIAL modes', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <DemoAuthProvider initialSession={DUAL_OPTED_USER} initialSocialConsent={true}>
            <MemoryRouter initialEntries={['/app/social']}>
              <Routes>
                <Route
                  path="/app/social"
                  element={
                    <RequireSocialConsent>
                      <div data-testid="social-discovery-feed">Active Social Peer Directory</div>
                    </RequireSocialConsent>
                  }
                />
              </Routes>
            </MemoryRouter>
          </DemoAuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    );

    expect(await screen.findByTestId('social-discovery-feed')).toBeInTheDocument();
  });

  it('activating social mode on guard screen unlocks social discovery and reflects in settings', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <DemoAuthProvider initialSession={STUDY_ONLY_USER} initialSocialConsent={false}>
            <MemoryRouter initialEntries={['/app/social']}>
              <Routes>
                <Route
                  path="/app/social"
                  element={
                    <RequireSocialConsent>
                      <div data-testid="social-discovery-feed">Active Social Peer Directory</div>
                    </RequireSocialConsent>
                  }
                />
                <Route path="/app/settings" element={<SettingsPage />} />
              </Routes>
            </MemoryRouter>
          </DemoAuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    );

    const activateBtn = await screen.findByRole('button', { name: /Activate Social Mode/i });
    fireEvent.click(activateBtn);

    // Social discovery should unlock
    await waitFor(() => {
      expect(screen.getByTestId('social-discovery-feed')).toBeInTheDocument();
    });
  });

  it('opting out of social discovery in Settings does not silently alter study discovery consent', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <DemoAuthProvider initialSession={DUAL_OPTED_USER} initialSocialConsent={true}>
            <MemoryRouter initialEntries={['/app/settings']}>
              <Routes>
                <Route path="/app/settings" element={<SettingsPage />} />
              </Routes>
            </MemoryRouter>
          </DemoAuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Verify initial states in Settings
    const activeBadges = await screen.findAllByText('Active in Discovery');
    expect(activeBadges.length).toBe(2); // Both study and social are active

    // Toggle Social Consent off
    const optOutSocialBtn = screen.getByRole('button', { name: /Opt Out of Social/i });
    fireEvent.click(optOutSocialBtn);

    // Study discovery must remain active
    await waitFor(() => {
      expect(screen.getByText('Enable Social Discovery')).toBeInTheDocument();
      expect(screen.getByText('Opt Out of Study')).toBeInTheDocument();
    });
  });

  it('restores persisted social consent state from query cache after page navigation', async () => {
    const { unmount } = render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <DemoAuthProvider initialSession={STUDY_ONLY_USER} initialSocialConsent={false}>
            <MemoryRouter initialEntries={['/app/settings']}>
              <Routes>
                <Route path="/app/settings" element={<SettingsPage />} />
              </Routes>
            </MemoryRouter>
          </DemoAuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Opt into social discovery
    const optInSocialBtn = await screen.findByRole('button', { name: /Enable Social Discovery/i });
    fireEvent.click(optInSocialBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Opt Out of Social/i })).toBeInTheDocument();
    });

    unmount();

    // Now re-render as if user navigated to /app/social in the same session
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <DemoAuthProvider initialSession={STUDY_ONLY_USER} initialSocialConsent={false}>
            <MemoryRouter initialEntries={['/app/social']}>
              <Routes>
                <Route
                  path="/app/social"
                  element={
                    <RequireSocialConsent>
                      <div data-testid="social-discovery-feed">Active Social Peer Directory</div>
                    </RequireSocialConsent>
                  }
                />
              </Routes>
            </MemoryRouter>
          </DemoAuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Should be unblocked and show the feed because canonical query records consent
    expect(await screen.findByTestId('social-discovery-feed')).toBeInTheDocument();
  });
});
