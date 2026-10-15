import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DemoAuthProvider } from '@/app/context/DemoAuthContext';
import { LoginPage } from '@/features/auth/LoginPage';

function renderLoginPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DemoAuthProvider isDemoAuthEnabled={true}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/app/dashboard" element={<div>Dashboard Screen</div>} />
          </Routes>
        </MemoryRouter>
      </DemoAuthProvider>
    </QueryClientProvider>
  );
}

describe('Frontend OTP Authentication UI Suite (FR-01 & FR-02)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('enforces One-Time Code (OTP) as the mandatory authentication method without password fields', () => {
    renderLoginPage();

    expect(screen.getByRole('button', { name: /request login otp/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^password$/i })).not.toBeInTheDocument();
  });

  it('rejects OTP request with non-iitk email client-side', async () => {
    renderLoginPage();

    const emailInput = screen.getByLabelText(/iitk email address/i);
    const requestBtn = screen.getByRole('button', { name: /request login otp/i });

    fireEvent.change(emailInput, { target: { value: 'student@gmail.com' } });
    fireEvent.click(requestBtn);

    expect(
      await screen.findByText(/authentication requires a valid @iitk\.ac\.in institutional email address/i)
    ).toBeInTheDocument();
  });

  it('completes the full OTP challenge request and 6-digit verification lifecycle', async () => {
    const mockFetch = vi.fn()
      // First call: /api/auth/otp/request-login
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            challengeId: '00000000-0000-0000-0000-00000000c001',
            email: 'student@iitk.ac.in',
            expiresAt: new Date(Date.now() + 600000).toISOString(),
            maxAttempts: 3,
            isDevTransport: true,
          },
        }),
      })
      // Second call: /api/auth/otp/verify-login
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            user: {
              userId: '00000000-0000-0000-0000-00000000d501',
              email: 'student@iitk.ac.in',
              displayName: 'Verified Student',
              role: 'ROLE_STUDENT',
              accountStatus: 'ACTIVE',
              verificationStatus: 'VERIFIED',
            },
            token: 'test-session-jwt-token-999',
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
            isFirstLogin: false,
          },
        }),
      });

    globalThis.fetch = mockFetch as any;

    renderLoginPage();

    // 1. Request OTP (page is strictly OTP-based by default)
    const emailInput = screen.getByLabelText(/iitk email address/i);
    fireEvent.change(emailInput, { target: { value: 'student@iitk.ac.in' } });
    fireEvent.click(screen.getByRole('button', { name: /request login otp/i }));

    // 3. Verify stage transition
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/otp/request-login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'student@iitk.ac.in' }),
        })
      );
      expect(screen.getByLabelText(/6-digit verification code/i)).toBeInTheDocument();
      expect(screen.getByText(/verification code dispatched to student@iitk\.ac\.in/i)).toBeInTheDocument();
    });

    // 4. Enter 6-digit code and verify
    const otpInput = screen.getByLabelText(/6-digit verification code/i);
    fireEvent.change(otpInput, { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: /verify & sign in/i }));

    // 5. Successful verification navigates to destination
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/otp/verify-login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'student@iitk.ac.in',
            challengeId: '00000000-0000-0000-0000-00000000c001',
            otp: '654321',
          }),
        })
      );
      expect(screen.getByText('Dashboard Screen')).toBeInTheDocument();
    });
  });
});
