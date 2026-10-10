import React, { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  CalendarDays,
  BookmarkCheck,
  FileText,
  ArrowLeft,
  Sun,
  Moon,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export const AdminLayout: React.FC = () => {
  const { switchRole, isDemoAuthEnabled } = useDemoAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const adminNavItems = [
    { label: 'Admin Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'User Directory', path: '/admin/users', icon: Users },
    { label: 'Moderation Queue', path: '/admin/reports', icon: ShieldAlert, badge: '3' },
    { label: 'Table & Room Inventory', path: '/admin/tables', icon: CalendarDays },
    { label: 'Campus Reservations', path: '/admin/bookings', icon: BookmarkCheck },
    { label: 'Audit Logs', path: '/admin/audit-logs', icon: FileText },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-craft-bg text-craft-ink transition-colors duration-200">
      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-amber-600 focus:text-white focus:rounded-md focus:shadow-craft-md focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>

      {/* Top Admin Header Bar */}
      <header className="sticky top-0 z-30 border-b border-craft-border bg-craft-bg/90 backdrop-blur-md px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-craft-muted hover:text-craft-ink p-1.5 rounded-md focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:outline-none"
            aria-expanded={mobileMenuOpen}
            aria-controls="admin-sidebar"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link to="/admin/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-mono font-bold text-xs">
              AD
            </div>
            <span className="font-bold text-sm tracking-tight text-craft-ink hidden sm:inline">
              Campus Duo Admin
            </span>
          </Link>

          <Badge variant="warning" dot>Administrative Console</Badge>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Quick link back to student app */}
          <Link to="/app/dashboard" className="hidden sm:inline-flex items-center gap-1.5 text-xs text-craft-muted hover:text-craft-ink px-2 py-1 rounded border border-craft-border">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Student View</span>
          </Link>

          {/* Demo Role Switcher */}
          {isDemoAuthEnabled && (
            <div className="hidden sm:flex items-center gap-1.5 p-1 rounded-md bg-craft-surface border border-craft-border text-[11px] font-mono">
              <span className="text-craft-subtle pl-1.5">Role:</span>
              <button
                onClick={() => {
                  switchRole('ROLE_STUDENT');
                  navigate('/app/dashboard');
                }}
                className="px-2 py-0.5 rounded text-craft-muted hover:text-craft-ink"
              >
                Student
              </button>
              <button
                onClick={() => switchRole('ROLE_ADMIN')}
                className="px-2 py-0.5 rounded bg-amber-600 text-white font-medium"
              >
                Admin
              </button>
              <button
                onClick={() => {
                  switchRole('SIGNED_OUT');
                  navigate('/login');
                }}
                className="px-2 py-0.5 rounded text-craft-muted hover:text-craft-ink"
              >
                Sign Out
              </button>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </header>

      {/* Main Admin Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Admin Sidebar */}
        <aside
          id="admin-sidebar"
          aria-label="Admin Navigation"
          className="hidden md:flex flex-col w-60 border-r border-craft-border bg-craft-surface/50 p-3 shrink-0"
        >
          <nav className="space-y-1 flex-1">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-amber-950/40 text-amber-300 border-l-2 border-amber-500 font-semibold'
                        : 'text-craft-muted hover:text-craft-ink hover:bg-craft-surface'
                    }`
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center font-mono">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="p-2.5 rounded-lg border border-amber-900/40 bg-amber-950/20 text-[11px] text-amber-300 space-y-1">
            <div className="flex items-center gap-1.5 font-medium">
              <Shield className="w-3.5 h-3.5" />
              <span>Audit Logging Active</span>
            </div>
            <p className="text-[10px] text-craft-muted leading-tight">
              Administrative actions are recorded into immutable audit logs.
            </p>
          </div>
        </aside>

        {/* Mobile Admin Drawer */}
        {mobileMenuOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          >
            <div
              className="w-64 max-w-[80vw] h-full bg-craft-surface border-r border-craft-border p-4 flex flex-col space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-craft-border">
                <span className="text-xs font-bold text-amber-400">Admin Navigation</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-craft-muted hover:text-craft-ink p-1 rounded"
                  aria-label="Close navigation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="space-y-1 flex-1">
                {adminNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium ${
                          isActive
                            ? 'bg-amber-950/40 text-amber-300 border-l-2 border-amber-500 font-semibold'
                            : 'text-craft-muted hover:text-craft-ink'
                        }`
                      }
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] flex items-center justify-center font-mono">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </nav>

              <div className="pt-3 border-t border-craft-border">
                <Link to="/app/dashboard" onClick={() => setMobileMenuOpen(false)} className="block w-full">
                  <Button variant="outline" size="sm" className="w-full">
                    Return to Student View
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Primary Main Landmark */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 focus:outline-none"
        >
          <div className="max-w-5xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
