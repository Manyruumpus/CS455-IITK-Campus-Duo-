import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="space-y-5">
      <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-craft-muted mx-auto">
        <Compass className="w-8 h-8 text-ember-400" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-craft-ink">
          404 — Page Not Found
        </h1>
        <p className="text-xs text-craft-muted max-w-sm mx-auto leading-relaxed">
          The requested campus route or resource does not exist. Please check the URL or return to the platform home.
        </p>
      </div>

      <div className="pt-2">
        <Link to="/">
          <Button variant="ember" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
            Return to Campus Duo Home
          </Button>
        </Link>
      </div>
    </div>
  );
};
