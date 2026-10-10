import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-craft-bg text-craft-ink flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <header className="flex items-center justify-between max-w-4xl mx-auto w-full">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs text-craft-muted hover:text-craft-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 rounded p-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>

        <div className="flex items-center gap-2">
          <Badge variant="mono">Authentication</Badge>
          <Badge variant="warning">Demo Environment</Badge>
        </div>
      </header>

      {/* Main Auth Form Container */}
      <main id="main-content" className="w-full max-w-md mx-auto my-8">
        <Outlet />
      </main>

      {/* Auth Footer with Disclaimers */}
      <footer className="text-center text-xs text-craft-muted max-w-md mx-auto space-y-2">
        <div className="flex items-center justify-center gap-1.5 text-craft-subtle">
          <Shield className="w-3.5 h-3.5" />
          <span>Authentication integration pending · Demonstration environment</span>
        </div>
        <p className="text-[11px] text-craft-subtle">
          Campus Duo is designed for enrolled IIT Kanpur students.
        </p>
      </footer>
    </div>
  );
};
