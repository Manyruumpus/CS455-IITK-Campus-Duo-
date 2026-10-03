import React from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Shield, ArrowRight, KeyRound } from 'lucide-react';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export const LoginPage: React.FC = () => {
  const { switchRole, session } = useDemoAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const from = searchParams.get('from') || '/app/dashboard';

  const handleStudentLogin = () => {
    switchRole('ROLE_STUDENT');
    navigate(from.startsWith('/admin') ? '/app/dashboard' : from, { replace: true });
  };

  const handleAdminLogin = () => {
    switchRole('ROLE_ADMIN');
    navigate(from.startsWith('/app') ? '/admin/dashboard' : from, { replace: true });
  };

  return (
    <Card variant="craft" className="shadow-craft-md">
      <CardHeader className="text-center">
        <div className="w-10 h-10 rounded-lg bg-ember-600/20 border border-ember-500/40 flex items-center justify-center text-ember-400 font-mono font-bold text-base mx-auto mb-2">
          CD
        </div>
        <CardTitle>Sign In to Campus Duo</CardTitle>
        <CardDescription>
          Select a demonstration role to explore the application shell and navigation guards.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {session && (
          <div className="p-3 rounded-md bg-craft-surface border border-craft-border text-xs flex items-center justify-between">
            <div>
              <span className="text-craft-muted">Active Session:</span>
              <p className="font-semibold text-craft-ink">{session.name} ({session.role})</p>
            </div>
            <Badge variant="success" dot>Hydrated</Badge>
          </div>
        )}

        <div className="space-y-2.5">
          <Button
            variant="ember"
            size="md"
            className="w-full justify-between"
            onClick={handleStudentLogin}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            <span>Continue as Student (Mohit Kumar)</span>
          </Button>

          <Button
            variant="outline"
            size="md"
            className="w-full justify-between"
            onClick={handleAdminLogin}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            <span>Continue as Administrator</span>
          </Button>
        </div>

        <div className="pt-2 border-t border-craft-border text-center space-y-2">
          <Link
            to="/auth/callback"
            className="text-xs text-craft-muted hover:text-craft-ink underline flex items-center justify-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Simulate IITK CC Web SSO Callback</span>
          </Link>
          <Link
            to="/auth/recovery"
            className="text-xs text-craft-muted hover:text-craft-ink underline block"
          >
            Simulate Session Expiration & Recovery
          </Link>
        </div>
      </CardContent>

      <CardFooter className="flex-col gap-2 text-center text-xs text-craft-subtle">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          <span>Demo authentication mode. No live password required.</span>
        </div>
      </CardFooter>
    </Card>
  );
};
