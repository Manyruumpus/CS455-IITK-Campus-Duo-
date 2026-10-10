import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Shield, ArrowRight, KeyRound, AlertTriangle, LogOut, CheckCircle } from 'lucide-react';
import { useDemoAuth, DemoAuthRole } from '@/app/context/DemoAuthContext';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { validateReturnPath } from '@/utils/navigation';

export const LoginPage: React.FC = () => {
  const { switchRole, session, logout, isDemoAuthEnabled } = useDemoAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromParam = searchParams.get('from');
  const isExpired = searchParams.get('expired') === 'true';
  const [isLoading, setIsLoading] = useState(false);

  const handleRoleSignIn = (role: DemoAuthRole) => {
    setIsLoading(true);
    // Simulate short network handoff before state change
    setTimeout(() => {
      switchRole(role);
      setIsLoading(false);
      const defaultRole = role === 'ROLE_ADMIN' ? 'ROLE_ADMIN' : 'ROLE_STUDENT';
      const target = validateReturnPath(fromParam, defaultRole);
      navigate(target, { replace: true });
    }, 50);
  };

  const handleSignOut = () => {
    logout();
  };

  // Default production without demo auth: render honest provider-neutral unavailable notice (Amendment B)
  if (!isDemoAuthEnabled) {
    return (
      <Card variant="craft" className="shadow-craft-md max-w-md mx-auto">
        <CardHeader className="text-center">
          <div className="w-10 h-10 rounded-lg bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-mono font-bold text-base mx-auto mb-2">
            CD
          </div>
          <CardTitle>Sign In to Campus Duo</CardTitle>
          <CardDescription>
            Authentication integration pending.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-craft-surface border border-craft-border text-xs space-y-2 text-craft-muted">
            <div className="flex items-center gap-2 text-amber-400 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Production Identity Provider Unavailable</span>
            </div>
            <p className="leading-relaxed">
              Authentication integration pending. Live identity provider integration (DEC-05) is not yet connected for this production deployment. Mock session bypasses and demo role switches are disabled in production.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex justify-center">
          <Link to="/">
            <Button variant="outline" size="sm">
              Return to Campus Duo Home
            </Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  // Development and Demo Showcase Mode
  return (
    <Card variant="craft" className="shadow-craft-md max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="w-10 h-10 rounded-lg bg-ember-600/20 border border-ember-500/40 flex items-center justify-center text-ember-400 font-mono font-bold text-base mx-auto mb-2">
          CD
        </div>
        <CardTitle>Sign In to Campus Duo</CardTitle>
        <CardDescription>
          Select an explicitly labelled demonstration identity to explore application workflows.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isExpired && (
          <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/50 text-xs text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Simulated Session Expired</p>
              <p className="text-[11px] text-amber-300">
                Your previous demonstration session has lapsed. Please select an identity to continue.
              </p>
            </div>
          </div>
        )}

        {fromParam && (
          <div className="p-2.5 rounded bg-craft-surface border border-craft-border text-[11px] text-craft-muted flex items-center justify-between">
            <span>Destination on sign-in:</span>
            <code className="text-ember-400 font-mono text-[10px] truncate max-w-[200px]">
              {fromParam}
            </code>
          </div>
        )}

        {session ? (
          <div className="p-3.5 rounded-lg bg-craft-surface border border-craft-border text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-craft-muted block text-[11px]">Currently Signed In:</span>
                <p className="font-semibold text-craft-ink text-sm">{session.name}</p>
                <span className="font-mono text-[10px] text-craft-muted">({session.role})</span>
              </div>
              <Badge variant="success" dot>Active Demo</Badge>
            </div>

            <div className="flex gap-2 pt-1 border-t border-craft-border">
              <Button
                variant="ember"
                size="sm"
                className="flex-1"
                onClick={() => {
                  const defaultRole = session.role === 'ROLE_ADMIN' ? 'ROLE_ADMIN' : 'ROLE_STUDENT';
                  const target = validateReturnPath(fromParam, defaultRole);
                  navigate(target, { replace: true });
                }}
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              >
                Continue to {session.role === 'ROLE_ADMIN' ? 'Admin Console' : 'Dashboard'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                leftIcon={<LogOut className="w-3.5 h-3.5" />}
              >
                Sign Out
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-2.5 rounded bg-craft-surface border border-craft-border text-[11px] text-craft-muted flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-craft-muted shrink-0" />
            <span>Currently Signed Out. Select a demo identity below.</span>
          </div>
        )}

        <div className="space-y-2">
          <Button
            variant="ember"
            size="md"
            className="w-full justify-between"
            disabled={isLoading}
            onClick={() => handleRoleSignIn('ROLE_STUDENT')}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            <div className="text-left">
              <p className="font-semibold text-xs">Continue as Student (Alex Rivera)</p>
              <span className="text-[10px] opacity-80 font-normal">Onboarded • CS455 enrolled</span>
            </div>
          </Button>

          <Button
            variant="outline"
            size="md"
            className="w-full justify-between"
            disabled={isLoading}
            onClick={() => handleRoleSignIn('ROLE_STUDENT_FRESH')}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            <div className="text-left">
              <p className="font-semibold text-xs">Continue as Fresh Student (Needs Onboarding)</p>
              <span className="text-[10px] opacity-80 font-normal">Incomplete profile • Tests wizard</span>
            </div>
          </Button>

          <Button
            variant="outline"
            size="md"
            className="w-full justify-between"
            disabled={isLoading}
            onClick={() => handleRoleSignIn('ROLE_ADMIN')}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            <div className="text-left">
              <p className="font-semibold text-xs">Continue as Administrator (Senate Moderator)</p>
              <span className="text-[10px] opacity-80 font-normal">Governance console • Bypasses onboarding</span>
            </div>
          </Button>
        </div>

        <div className="pt-2 border-t border-craft-border text-center space-y-2">
          <Link
            to="/auth/callback"
            className="text-xs text-craft-muted hover:text-craft-ink underline flex items-center justify-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Simulate Authentication Callback (Simulation)</span>
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
          <span>Demo authentication mode. No live password or credentials collected.</span>
        </div>
      </CardFooter>
    </Card>
  );
};
