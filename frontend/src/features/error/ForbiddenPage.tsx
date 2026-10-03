import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useDemoAuth } from '@/app/context/DemoAuthContext';

export const ForbiddenPage: React.FC = () => {
  const { session, switchRole } = useDemoAuth();

  return (
    <div className="space-y-5">
      <div className="w-16 h-16 rounded-full bg-red-900/30 border border-red-800/60 flex items-center justify-center text-red-400 mx-auto">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-craft-ink">
          403 — Access Denied
        </h1>
        <p className="text-xs text-craft-muted max-w-sm mx-auto leading-relaxed">
          Your current session ({session?.role || 'Guest'}) does not have permission to access this administrative or protected route.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <Link to="/app/dashboard">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
            Return to Student App
          </Button>
        </Link>
        <Button
          variant="ember"
          size="sm"
          onClick={() => switchRole('ROLE_ADMIN')}
        >
          Switch to Admin Role (Demo)
        </Button>
      </div>
    </div>
  );
};
