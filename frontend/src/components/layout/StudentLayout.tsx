import React, { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  Calendar,
  Bell,
  Settings,
  MessageSquare,
  LogOut,
  Sun,
  Moon,
  Menu,
  X,
  UserCheck,
} from 'lucide-react';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { appConfig } from '@/config/features';
import { useUnreadNotificationCount } from '@/queries/notificationHooks';

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const StudentLayout: React.FC = () => {
  const { session, switchRole, logout, isDemoAuthEnabled } = useDemoAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { data: unreadCount } = useUnreadNotificationCount();

  // If student is incomplete, route to /onboarding while preserving /app/settings and logout (Amendment 7)
  if (
    session?.role === 'ROLE_STUDENT' &&
    session.isOnboarded === false &&
    !location.pathname.startsWith('/app/settings')
  ) {
    const fullPath = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/onboarding?from=${encodeURIComponent(fullPath)}`} replace />;
  }

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const navItems: NavItem[] = [
    { label: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard },
    { label: 'Study Matching', path: '/app/study', icon: BookOpen },
    { label: 'Social Discovery', path: '/app/social', icon: Users },
    { label: 'Table Reservations', path: '/app/booking', icon: Calendar },
    ...(appConfig.isMessagingEnabled
      ? [{ label: 'Conversations', path: '/app/conversations', icon: MessageSquare }]
      : []),
    ...(unreadCount
      ? [{ label: 'Notifications', path: '/app/notifications', icon: Bell, badge: String(unreadCount) }]
      : [{ label: 'Notifications', path: '/app/notifications', icon: Bell }]),
    { label: 'Settings & Privacy', path: '/app/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-craft-bg text-craft-ink transition-colors duration-200">
      {/* Skip-to-content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-ember-600 focus:text-white focus:rounded-md focus:shadow-craft-md focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>

      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 border-b border-craft-border bg-craft-bg/90 backdrop-blur-md px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        {/* Left: Mobile trigger & Brand */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-craft-muted hover:text-craft-ink p-1.5 rounded-md focus-visible:ring-2 focus-visible:ring-ember-500 focus-visible:outline-none"
            aria-expanded={mobileMenuOpen}
            aria-controls="student-sidebar"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <Link to="/app/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-ember-600/20 border border-ember-500/40 flex items-center justify-center text-ember-400 font-mono font-bold text-xs">
              CD
            </div>
            <span className="font-bold text-sm tracking-tight text-craft-ink hidden sm:inline">
              Campus Duo
            </span>
          </Link>

          <Badge variant="mono" className="hidden lg:inline-flex">Student Portal</Badge>
        </div>

        {/* Right: Demo Role Switcher, Alerts, Theme, User Profile */}
        <div className="flex items-center gap-2.5">
          {/* Demo Role Switcher (Visible ONLY when demo authentication is enabled) */}
          {isDemoAuthEnabled && (
            <div className="hidden sm:flex items-center gap-1.5 p-1 rounded-md bg-craft-surface border border-craft-border text-[11px] font-mono">
              <span className="text-craft-subtle pl-1.5">Role:</span>
              <button
                onClick={() => switchRole('ROLE_STUDENT')}
                className="px-2 py-0.5 rounded bg-ember-600 text-white font-medium"
              >
                Student
              </button>
              <button
                onClick={() => {
                  switchRole('ROLE_ADMIN');
                  navigate('/admin/dashboard');
                }}
                className="px-2 py-0.5 rounded text-craft-muted hover:text-craft-ink"
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

          {/* Theme Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleTheme}
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          {/* User Profile Pill */}
          {session ? (
            <Link
              to="/app/profile"
              className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-full border border-craft-border hover:border-craft-borderCraft bg-craft-surface text-xs transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-ember-600/30 border border-ember-500/50 flex items-center justify-center text-[10px] font-bold text-ember-400">
                {session.name.charAt(0)}
              </div>
              <span className="font-medium text-craft-ink hidden sm:inline">{session.name}</span>
            </Link>
          ) : (
            <Link to="/login">
              <Button variant="ember" size="sm">
                Sign In
              </Button>
            </Link>
          )}
        </div>
      </header>

      {/* Main Body with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar Navigation */}
        <aside
          id="student-sidebar"
          aria-label="Student Navigation"
          className="hidden md:flex flex-col w-60 border-r border-craft-border bg-craft-bg shrink-0 p-4 space-y-4"
        >
          <nav className="space-y-1 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-ember-950/40 text-ember-300 border-l-2 border-ember-500 font-semibold'
                        : 'text-craft-muted hover:text-craft-ink hover:bg-craft-surface'
                    }`
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="w-4 h-4 rounded-full bg-ember-600 text-white text-[10px] flex items-center justify-center font-mono">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="p-2.5 rounded-lg border border-craft-border bg-craft-surface/80 text-[11px] text-craft-muted space-y-1">
            <div className="flex items-center gap-1.5 text-craft-ink font-medium">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Independent Opt-In</span>
            </div>
            <p className="text-[10px] leading-tight">
              Study and social profiles maintain separate, revokable consent.
            </p>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
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
                <span className="text-xs font-bold text-craft-ink">Navigation</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-craft-muted hover:text-craft-ink p-1 rounded"
                  aria-label="Close navigation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="space-y-1 flex-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium ${
                          isActive
                            ? 'bg-ember-950/40 text-ember-300 border-l-2 border-ember-500 font-semibold'
                            : 'text-craft-muted hover:text-craft-ink'
                        }`
                      }
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="w-4 h-4 rounded-full bg-ember-600 text-white text-[10px] flex items-center justify-center font-mono">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </nav>

              <div className="pt-3 border-t border-craft-border space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    logout();
                    navigate('/login');
                  }}
                  leftIcon={<LogOut className="w-3.5 h-3.5" />}
                >
                  Sign Out (Demo)
                </Button>
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
