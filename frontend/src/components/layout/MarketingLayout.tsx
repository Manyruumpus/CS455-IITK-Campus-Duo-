import React, { useState } from 'react';
import { Outlet, Link, NavLink } from 'react-router-dom';
import { Sun, Moon, ArrowRight, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export const MarketingLayout: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const navLinks = [
    { label: 'Study Matching', path: '/app/study' },
    { label: 'Social Clubs', path: '/app/social' },
    { label: 'Library Tables', path: '/app/booking' },
    { label: 'Dev Preview', path: '/preview/design-system' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-craft-bg text-craft-ink transition-colors duration-200">
      {/* Accessible Skip Link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-ember-600 focus:text-white focus:rounded-md focus:shadow-craft-md focus:outline-none focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>

      {/* Top Public Header */}
      <header className="sticky top-0 z-40 border-b border-craft-border bg-craft-bg/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 rounded-md">
            <div className="w-8 h-8 rounded-md bg-ember-600/20 border border-ember-500/40 flex items-center justify-center text-ember-400 font-mono font-bold text-sm shadow-sm">
              CD
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-craft-ink">Campus Duo</span>
                <Badge variant="mono">IITK</Badge>
              </div>
              <p className="text-[10px] text-craft-muted font-mono leading-none">
                Study & Peer Platform
              </p>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label="Public Navigation" className="hidden md:flex items-center gap-6 text-xs font-medium text-craft-muted">
            {navLinks.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `transition-colors hover:text-craft-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 rounded px-1.5 py-1 ${
                    isActive ? 'text-ember-400 font-semibold' : ''
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Actions & Controls */}
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </Button>

            <Link to="/login" className="hidden sm:inline-block">
              <Button variant="ember" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                Demo Sign In
              </Button>
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-craft-muted hover:text-craft-ink p-1.5 rounded-md focus-visible:ring-2 focus-visible:ring-ember-500 focus-visible:outline-none"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <nav
            id="mobile-nav"
            aria-label="Mobile Navigation"
            className="md:hidden border-t border-craft-border bg-craft-surface px-4 py-4 space-y-3"
          >
            {navLinks.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-xs font-medium text-craft-muted hover:text-craft-ink py-1.5"
              >
                {item.label}
              </NavLink>
            ))}
            <div className="pt-2 border-t border-craft-border">
              <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block w-full">
                <Button variant="ember" size="sm" className="w-full">
                  Sign In to Campus Duo
                </Button>
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* Primary Main Content Landmark */}
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>

      {/* Kyoto Academic Craft Footer */}
      <footer className="border-t border-craft-border bg-craft-surface/80 py-12 px-4 sm:px-6 lg:px-8 text-xs text-craft-muted">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded bg-ember-600/20 border border-ember-500/40 flex items-center justify-center text-ember-400 font-mono font-bold text-xs">
                CD
              </div>
              <span className="font-bold text-sm text-craft-ink">Campus Duo</span>
            </div>
            <p className="text-xs text-craft-muted leading-relaxed">
              Course-grounded study partnerships and consent-first social discovery for Indian Institute of Technology Kanpur students.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-xs text-craft-ink uppercase tracking-wider mb-3">Platform</h3>
            <ul className="space-y-2 text-xs">
              <li><Link to="/app/study" className="hover:text-craft-ink">Course Matcher</Link></li>
              <li><Link to="/app/social" className="hover:text-craft-ink">Social Discovery</Link></li>
              <li><Link to="/app/booking" className="hover:text-craft-ink">Table Booking (2-Person)</Link></li>
              <li><Link to="/preview/design-system" className="hover:text-craft-ink">Design Tokens Preview</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-xs text-craft-ink uppercase tracking-wider mb-3">Architecture</h3>
            <ul className="space-y-2 text-xs">
              <li><span className="text-craft-muted">React 18 + TypeScript + Vite</span></li>
              <li><span className="text-craft-muted">Kyoto Woodshop Aesthetic</span></li>
              <li><span className="text-craft-muted">WCAG AA/AAA Contrast Target</span></li>
              <li><span className="text-craft-muted">Server-Authoritative Bookings</span></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-xs text-craft-ink uppercase tracking-wider mb-3">Notice</h3>
            <p className="text-[11px] text-craft-muted leading-relaxed">
              Academic student project for IIT Kanpur CS455. Campus Duo is not a commercial dating application.
            </p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-6 border-t border-craft-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-craft-subtle font-mono">
          <p>© 2026 Campus Duo · IIT Kanpur · Stage 02 Application Shell</p>
          <p>Review-Gated Antigravity Architecture</p>
        </div>
      </footer>
    </div>
  );
};
