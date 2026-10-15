import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DemoAuthProvider } from '@/app/context/DemoAuthContext';
import { LoginPage } from '@/features/auth/LoginPage';
import { StudentLayout } from '@/components/layout/StudentLayout';
import { ForbiddenPage } from '@/features/error/ForbiddenPage';
import { MOCK_STUDENT_SESSION } from '@/mocks';

function renderWithProviders(ui: React.ReactElement, initialSession: any = null, initialEntry: string = '/login?test_auth=password') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DemoAuthProvider initialSession={initialSession} isDemoAuthEnabled={true}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/login" element={ui} />
            <Route path="/app/dashboard" element={<div>Dashboard Screen</div>} />
            <Route path="/forbidden" element={<ForbiddenPage />} />
          </Routes>
        </MemoryRouter>
      </DemoAuthProvider>
    </QueryClientProvider>
  );
}

describe('Frontend Local Auth & RBAC Security Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. LoginPage IITK Account Lifecycle Form', () => {
    it('disables password authentication in normal production entry without test harness flag', () => {
      renderWithProviders(<LoginPage />, null, '/login');

      expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^password$/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /request login otp/i })).toBeInTheDocument();
    });

    it('renders Sign In and Register tabs with IITK email inputs in test harness mode', () => {
      renderWithProviders(<LoginPage />);

      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /register \(@iitk\.ac\.in\)/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/iitk email address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it('toggles to Register tab and reveals Full Name field', () => {
      renderWithProviders(<LoginPage />);

      const registerTab = screen.getByRole('button', { name: /register \(@iitk\.ac\.in\)/i });
      fireEvent.click(registerTab);

      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /register student account/i })).toBeInTheDocument();
    });

    it('rejects submission with non-iitk email client-side', async () => {
      renderWithProviders(<LoginPage />);

      const emailInput = screen.getByLabelText(/iitk email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitBtn = screen.getByRole('button', { name: /sign in to account/i });

      fireEvent.change(emailInput, { target: { value: 'user@gmail.com' } });
      fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
      fireEvent.click(submitBtn);

      expect(
        await screen.findByText(/authentication requires a valid @iitk\.ac\.in institutional email address/i)
      ).toBeInTheDocument();
    });

    it('rejects short passwords client-side', async () => {
      renderWithProviders(<LoginPage />);

      const emailInput = screen.getByLabelText(/iitk email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitBtn = screen.getByRole('button', { name: /sign in to account/i });

      fireEvent.change(emailInput, { target: { value: 'student@iitk.ac.in' } });
      fireEvent.change(passwordInput, { target: { value: 'short' } });
      fireEvent.click(submitBtn);

      expect(
        await screen.findByText(/password must be at least 8 characters/i)
      ).toBeInTheDocument();
    });

    it('authenticates user and navigates on successful API response', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            user: {
              userId: '00000000-0000-0000-0000-00000000d501',
              email: 'student@iitk.ac.in',
              displayName: 'Verified Student',
              role: 'ROLE_STUDENT',
              accountStatus: 'ACTIVE',
              verificationStatus: 'VERIFIED',
            },
            token: 'test-session-token-12345',
            expiresAt: '2026-11-15T00:00:00.000Z',
          },
        }),
      });
      globalThis.fetch = mockFetch as any;

      renderWithProviders(<LoginPage />);

      const emailInput = screen.getByLabelText(/iitk email address/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitBtn = screen.getByRole('button', { name: /sign in to account/i });

      fireEvent.change(emailInput, { target: { value: 'student@iitk.ac.in' } });
      fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/auth/login'),
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ email: 'student@iitk.ac.in', password: 'Password123!' }),
          })
        );
        expect(screen.getByText('Dashboard Screen')).toBeInTheDocument();
      });
    });
  });

  describe('2. Header & Forbidden UI Role Privilege Escalation Removal', () => {
    it('StudentLayout renders read-only Student badge and Sign Out, without Admin switch button', () => {
      const queryClient = new QueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <DemoAuthProvider initialSession={MOCK_STUDENT_SESSION} isDemoAuthEnabled={true}>
            <MemoryRouter initialEntries={['/app/dashboard']}>
              <Routes>
                <Route path="/app/*" element={<StudentLayout />}>
                  <Route path="dashboard" element={<div>Inner Content</div>} />
                </Route>
              </Routes>
            </MemoryRouter>
          </DemoAuthProvider>
        </QueryClientProvider>
      );

      // Verify Student role text is rendered as badge
      expect(screen.getByText('Student')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();

      // Crucial: Must NOT contain interactive Admin role toggle button in header
      const adminRoleBtn = screen.queryByRole('button', { name: /^admin$/i });
      expect(adminRoleBtn).not.toBeInTheDocument();
    });

    it('ForbiddenPage renders Return to Student App, without Switch to Admin Role button', () => {
      const queryClient = new QueryClient();
      render(
        <QueryClientProvider client={queryClient}>
          <DemoAuthProvider initialSession={MOCK_STUDENT_SESSION} isDemoAuthEnabled={true}>
            <MemoryRouter initialEntries={['/forbidden']}>
              <ForbiddenPage />
            </MemoryRouter>
          </DemoAuthProvider>
        </QueryClientProvider>
      );

      expect(screen.getByText(/403 — access denied/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /return to student app/i })).toBeInTheDocument();

      // Crucial: Must NOT contain "Switch to Admin Role" bypass button
      expect(screen.queryByText(/switch to admin role/i)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /admin/i })).not.toBeInTheDocument();
    });
  });
});
