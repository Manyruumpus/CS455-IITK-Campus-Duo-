import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { PageHeader } from '@/components/ui/PageHeader';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '@/app/routes';
import { DemoAuthProvider } from '@/app/context/DemoAuthContext';
import { ToastProvider } from '@/components/ui/Toast';

describe('Navigation & Shell Components', () => {
  it('renders breadcrumbs hierarchy with accessible navigation landmarks', () => {
    const items = [
      { label: 'Home', href: '/' },
      { label: 'Study Matching', href: '/app/study' },
      { label: 'Detail View', isCurrent: true },
    ];

    render(<Breadcrumbs items={items} />);

    const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(nav).toBeInTheDocument();

    const homeLink = screen.getByRole('link', { name: /home/i });
    expect(homeLink).toHaveAttribute('href', '/');

    const currentItem = screen.getByText('Detail View');
    expect(currentItem).toHaveAttribute('aria-current', 'page');
  });

  it('renders PageHeader with title, subtitle, and action buttons', () => {
    render(
      <PageHeader
        title="Active Table Grid"
        subtitle="Canonical 2-person tables"
        actions={<button>Reserve Table</button>}
      />
    );

    expect(screen.getByRole('heading', { name: /active table grid/i })).toBeInTheDocument();
    expect(screen.getByText(/canonical 2-person tables/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reserve table/i })).toBeInTheDocument();
  });

  it('toggles mobile navigation drawer in marketing layout', () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });

    render(
      <ToastProvider>
        <DemoAuthProvider>
          <RouterProvider router={router} />
        </DemoAuthProvider>
      </ToastProvider>
    );

    const toggleButton = screen.getByRole('button', { name: /toggle navigation menu/i });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    // Click to open mobile navigation
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    // Verify mobile navigation container is visible
    const mobileNav = screen.getByRole('navigation', { name: /mobile navigation/i });
    expect(mobileNav).toBeInTheDocument();

    // Click to close
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
  });
});
