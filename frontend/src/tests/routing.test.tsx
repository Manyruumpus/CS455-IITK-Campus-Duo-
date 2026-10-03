import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '@/app/routes';
import { DemoAuthProvider } from '@/app/context/DemoAuthContext';
import { ToastProvider } from '@/components/ui/Toast';

import { MOCK_STUDENT_SESSION } from '@/mocks';
import { UserSession } from '@/types';

function renderWithRouter(initialEntry = '/', initialSession: UserSession | null = null) {
  const router = createMemoryRouter(routes, {
    initialEntries: [initialEntry],
  });

  return render(
    <ToastProvider>
      <DemoAuthProvider initialSession={initialSession}>
        <RouterProvider router={router} />
      </DemoAuthProvider>
    </ToastProvider>
  );
}

describe('Application Routing & Navigation Guards', () => {
  it('renders landing page with headline and entry points on root route', async () => {
    renderWithRouter('/');
    expect(screen.getByRole('heading', { name: /quiet focus meets/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /find study partner/i })).toBeInTheDocument();
  });

  it('renders public design system preview at /preview/design-system', async () => {
    renderWithRouter('/preview/design-system');
    expect(
      screen.getByRole('heading', { name: /design system sandbox/i })
    ).toBeInTheDocument();
  });

  it('renders login portal at /login', async () => {
    renderWithRouter('/login');
    expect(screen.getByRole('heading', { name: /sign in to campus duo/i })).toBeInTheDocument();
    expect(screen.getByText(/continue as student/i)).toBeInTheDocument();
  });

  it('renders student dashboard on /app/dashboard when authenticated as student', async () => {
    renderWithRouter('/app/dashboard', MOCK_STUDENT_SESSION);
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  it('redirects unauthenticated visitor accessing /app/dashboard to /login', async () => {
    renderWithRouter('/app/dashboard', null);
    expect(screen.getByRole('heading', { name: /sign in to campus duo/i })).toBeInTheDocument();
  });

  it('renders study discovery feed on /app/study', async () => {
    renderWithRouter('/app/study', MOCK_STUDENT_SESSION);
    expect(screen.getByRole('heading', { name: /study partner discovery/i })).toBeInTheDocument();
  });

  it('renders canonical 2-person table availability grid on /app/booking/table-grid', async () => {
    renderWithRouter('/app/booking/table-grid', MOCK_STUDENT_SESSION);
    expect(
      screen.getByRole('heading', { name: /table availability matrix/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/t-10/i).length).toBeGreaterThan(0);
  });

  it('redirects student accessing /admin/dashboard to /forbidden (403 Access Denied)', async () => {
    renderWithRouter('/admin/dashboard', MOCK_STUDENT_SESSION);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /403 — access denied/i })).toBeInTheDocument();
    });
  });

  it('renders 404 Not Found page on unknown route', async () => {
    renderWithRouter('/some/unknown/route');
    expect(screen.getByRole('heading', { name: /404 — page not found/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /return to campus duo home/i })).toBeInTheDocument();
  });
});
