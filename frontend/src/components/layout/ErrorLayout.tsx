import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const ErrorLayout: React.FC = () => {
  return (
    <div className="min-h-screen bg-craft-bg text-craft-ink flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      <header className="max-w-4xl mx-auto w-full">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs text-craft-muted hover:text-craft-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500 rounded p-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return Home</span>
        </Link>
      </header>

      <main id="main-content" className="w-full max-w-lg mx-auto my-12 text-center">
        <Outlet />
      </main>

      <footer className="text-center text-xs text-craft-muted font-mono">
        <p>Campus Duo · IIT Kanpur System Navigation</p>
      </footer>
    </div>
  );
};
