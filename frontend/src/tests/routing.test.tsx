import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { buildRoutes } from '@/app/routes';
import { QueryClientProvider } from '@tanstack/react-query';
import { createApplicationQueryClient } from '@/queries';
import { DemoAuthProvider } from '@/app/context/DemoAuthContext';
import { ToastProvider } from '@/components/ui/Toast';
import { MOCK_STUDENT_SESSION } from '@/mocks';
import { UserSession } from '@/types';
import { AppFeatureFlags } from '@/config/features';

function renderWithRouter(
  initialEntry = '/',
  initialSession: UserSession | null = null,
  featureOverrides: Partial<AppFeatureFlags> = {},
  isDemoAuthEnabled = true
) {
  const routes = buildRoutes(featureOverrides);
  const router = createMemoryRouter(routes, {
    initialEntries: [initialEntry],
  });
  const testQueryClient = createApplicationQueryClient();

  return render(
    <QueryClientProvider client={testQueryClient}>
      <ToastProvider>
        <DemoAuthProvider initialSession={initialSession} isDemoAuthEnabled={isDemoAuthEnabled}>
          <RouterProvider router={router} />
        </DemoAuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe('Application Routing & Navigation Guards', () => {
  it('renders landing page with headline and entry points on root route', async () => {
    renderWithRouter('/');
    expect(screen.getByRole('heading', { name: /quiet focus meets/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /find study partner/i })).toBeInTheDocument();
  });

  it('renders design system preview in dev/demo configuration', async () => {
    renderWithRouter(
      '/preview/design-system',
      null,
      { isDesignSystemPreviewEnabled: true }
    );
    expect(
      screen.getByRole('heading', { name: /design system sandbox/i })
    ).toBeInTheDocument();
  });

  it('falls through to 404 when preview route is accessed in default production', async () => {
    renderWithRouter(
      '/preview/design-system',
      null,
      { isDesignSystemPreviewEnabled: false }
    );
    expect(
      screen.getByRole('heading', { name: /404 — page not found/i })
    ).toBeInTheDocument();
  });

  it('renders login portal in demo mode with demonstration role selector', async () => {
    renderWithRouter('/login', null, {}, true);
    expect(screen.getByRole('heading', { name: /sign in to campus duo/i })).toBeInTheDocument();
    expect(screen.getByText(/continue as student/i)).toBeInTheDocument();
  });

  it('renders honest unavailable notice in production mode when demo auth is disabled', async () => {
    renderWithRouter('/login', null, {}, false);
    expect(screen.getByRole('heading', { name: /sign in to campus duo/i })).toBeInTheDocument();
    expect(
      screen.getByText(/production identity provider unavailable/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/continue as student/i)).not.toBeInTheDocument();
  });

  it('preserves query and hash deep links when redirecting unauthenticated visitor', async () => {
    renderWithRouter('/app/booking/table-grid?zone=LIBRARY#table-10', null);
    expect(screen.getByRole('heading', { name: /sign in to campus duo/i })).toBeInTheDocument();
  });

  it('renders student dashboard on /app/dashboard when authenticated as student', async () => {
    renderWithRouter('/app/dashboard', MOCK_STUDENT_SESSION);
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
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
    await waitFor(() => {
      expect(screen.getAllByText(/t-10/i).length).toBeGreaterThan(0);
    });
  });

  it('falls through to 404 for /app/conversations when messaging is disabled', async () => {
    renderWithRouter(
      '/app/conversations',
      MOCK_STUDENT_SESSION,
      { isMessagingEnabled: false }
    );
    expect(
      screen.getByRole('heading', { name: /404 — page not found/i })
    ).toBeInTheDocument();
  });

  it('renders ConversationsPage when messaging feature flag is explicitly enabled', async () => {
    renderWithRouter(
      '/app/conversations',
      MOCK_STUDENT_SESSION,
      { isMessagingEnabled: true }
    );
    expect(
      screen.getByRole('heading', { name: /direct conversations/i })
    ).toBeInTheDocument();
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

describe('Router Configuration Inventory Counts', () => {
  function countRoutes(flags: Partial<AppFeatureFlags>) {
    const list = buildRoutes(flags);
    let layoutOnlyNodes = 0;
    let indexRedirects = 0;
    let navigablePages = 0;
    let wildcard = 0;
    let conditionalPreview = 0;
    let conditionalMessaging = 0;

    for (const parent of list) {
      layoutOnlyNodes++;
      for (const child of parent.children || []) {
        if (child.index) {
          if (child.element && typeof child.element === 'object' && 'props' in child.element && (child.element.props as { to?: string }).to) {
            indexRedirects++;
          } else {
            navigablePages++;
          }
        } else if (child.path === '*') {
          wildcard++;
        } else if (child.path === 'preview/design-system') {
          conditionalPreview++;
          navigablePages++;
        } else if (child.path === 'conversations') {
          conditionalMessaging++;
          navigablePages++;
        } else {
          navigablePages++;
        }
      }
    }

    return {
      layoutOnlyNodes,
      indexRedirects,
      navigablePages,
      wildcard,
      conditionalPreview,
      conditionalMessaging,
      totalLeafRoutes: indexRedirects + navigablePages + wildcard,
      totalRouteObjects: layoutOnlyNodes + indexRedirects + navigablePages + wildcard,
    };
  }

  it('calculates exact route counts for development configuration', () => {
    const counts = countRoutes({
      isDev: true,
      isDesignSystemPreviewEnabled: true,
      isMessagingEnabled: false,
    });
    expect(counts).toEqual({
      layoutOnlyNodes: 5,
      indexRedirects: 2,
      navigablePages: 28, // 27 standard + 1 preview (includes /onboarding)
      wildcard: 1,
      conditionalPreview: 1,
      conditionalMessaging: 0,
      totalLeafRoutes: 31, // 28 pages + 2 redirects + 1 wildcard
      totalRouteObjects: 36, // 5 layout nodes + 31 children
    });
  });

  it('calculates exact route counts for default production configuration', () => {
    const counts = countRoutes({
      isDev: false,
      isDemoShowcase: false,
      isDesignSystemPreviewEnabled: false,
      isMessagingEnabled: false,
    });
    expect(counts).toEqual({
      layoutOnlyNodes: 5,
      indexRedirects: 2,
      navigablePages: 27, // preview excluded (includes /onboarding)
      wildcard: 1,
      conditionalPreview: 0,
      conditionalMessaging: 0,
      totalLeafRoutes: 30, // 27 pages + 2 redirects + 1 wildcard
      totalRouteObjects: 35, // 5 layout nodes + 30 children
    });
  });

  it('calculates exact route counts for explicit demo showcase configuration', () => {
    const counts = countRoutes({
      isDev: false,
      isDemoShowcase: true,
      isDesignSystemPreviewEnabled: true,
      isMessagingEnabled: false,
    });
    expect(counts).toEqual({
      layoutOnlyNodes: 5,
      indexRedirects: 2,
      navigablePages: 28,
      wildcard: 1,
      conditionalPreview: 1,
      conditionalMessaging: 0,
      totalLeafRoutes: 31,
      totalRouteObjects: 36,
    });
  });

  it('calculates exact route counts when messaging is explicitly enabled', () => {
    const counts = countRoutes({
      isDev: false,
      isDemoShowcase: true,
      isDesignSystemPreviewEnabled: true,
      isMessagingEnabled: true,
    });
    expect(counts).toEqual({
      layoutOnlyNodes: 5,
      indexRedirects: 2,
      navigablePages: 29,
      wildcard: 1,
      conditionalPreview: 1,
      conditionalMessaging: 1,
      totalLeafRoutes: 32,
      totalRouteObjects: 37,
    });
  });
});
