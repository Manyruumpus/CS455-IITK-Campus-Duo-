import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Shield, ArrowRight, KeyRound, AlertTriangle, LogOut, CheckCircle, Mail, Lock, User } from 'lucide-react';
import { useDemoAuth, DemoAuthRole } from '@/app/context/DemoAuthContext';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { validateReturnPath } from '@/utils/navigation';
import { UserSession } from '@/types';

export const LoginPage: React.FC = () => {
  const { switchRole, session, logout, isDemoAuthEnabled, isRestoringSession } = useDemoAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromParam = searchParams.get('from');
  const isExpired = searchParams.get('expired') === 'true';

  const allowTestPassword = searchParams.get('test_auth') === 'password' || import.meta.env.VITE_ENABLE_TEST_PASSWORD_AUTH === 'true';

  // Local account lifecycle state (OTP is mandatory for normal student access per FR-01)
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [authMethod, setAuthMethod] = useState<'password' | 'otp'>(allowTestPassword ? 'password' : 'otp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);

  // OTP authentication lifecycle state
  const [otpStage, setOtpStage] = useState<'request' | 'verify'>('request');
  const [otpCode, setOtpCode] = useState('');
  const [otpChallengeId, setOtpChallengeId] = useState<string | null>(null);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const apiBaseUrl = (
    import.meta.env.VITE_API_URL ??
    import.meta.env.VITE_API_BASE_URL ??
    'http://localhost:4000'
  ).replace(/\/+$/, '');

  const handleRoleSignIn = (role: DemoAuthRole) => {
    setIsDemoLoading(true);
    setTimeout(() => {
      switchRole(role);
      setIsDemoLoading(false);
      const defaultRole = role === 'ROLE_ADMIN' ? 'ROLE_ADMIN' : 'ROLE_STUDENT';
      const target = validateReturnPath(fromParam, defaultRole);
      navigate(target, { replace: true });
    }, 50);
  };

  const handleLocalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.endsWith('@iitk.ac.in')) {
      setFormError('Authentication requires a valid @iitk.ac.in institutional email address.');
      return;
    }

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    if (authMode === 'register' && displayName.trim().length < 2) {
      setFormError('Display name must be at least 2 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const endpoint = authMode === 'register' ? `${apiBaseUrl}/api/auth/register` : `${apiBaseUrl}/api/auth/login`;
      const payload = authMode === 'register'
        ? { email: trimmedEmail, displayName: displayName.trim(), password }
        : { email: trimmedEmail, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const body = await res.json();
      if (!res.ok) {
        setFormError(body?.error?.message || 'Authentication request failed. Please check your credentials.');
        setIsSubmitting(false);
        return;
      }

      const { user, token } = body.data;
      const isFirstLogin = Boolean(body.data.isFirstLogin);
      const userSession: UserSession = {
        userId: user.userId,
        email: user.email,
        name: user.displayName,
        rollNumber: user.email.split('@')[0],
        role: user.role,
        isOnboarded: !isFirstLogin,
        hasStudyConsent: !isFirstLogin,
        hasSocialConsent: false,
        sessionToken: token,
        isFirstLogin,
      };

      switchRole(userSession);
      const target = validateReturnPath(fromParam, user.role);
      navigate(target, { replace: true });
    } catch {
      setFormError('Network error: Unable to reach the backend service. Ensure backend is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setOtpNotice(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail.endsWith('@iitk.ac.in')) {
      setFormError('Authentication requires a valid @iitk.ac.in institutional email address.');
      return;
    }

    if (authMode === 'register' && displayName.trim().length < 2) {
      setFormError('Display name must be at least 2 characters.');
      return;
    }

    setIsOtpLoading(true);
    try {
      const endpoint = authMode === 'register'
        ? `${apiBaseUrl}/api/auth/otp/request-registration`
        : `${apiBaseUrl}/api/auth/otp/request-login`;

      const payload = authMode === 'register'
        ? { email: trimmedEmail, displayName: displayName.trim() }
        : { email: trimmedEmail };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.json();
      if (!res.ok) {
        setFormError(body?.error?.message || 'Failed to dispatch verification code.');
        setIsOtpLoading(false);
        return;
      }

      setOtpChallengeId(body.data.challengeId);
      setOtpStage('verify');
      setResendCooldown(30);
      setOtpNotice(`Verification code dispatched to ${trimmedEmail}. Valid for 10 minutes (max 3 attempts).`);
    } catch {
      setFormError('Network error: Unable to reach the backend service.');
    } finally {
      setIsOtpLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!otpChallengeId) {
      setFormError('No active verification challenge. Please request a new code.');
      setOtpStage('request');
      return;
    }

    const trimmedOtp = otpCode.trim();
    if (!/^\d{6}$/.test(trimmedOtp)) {
      setFormError('Verification code must be exactly 6 digits.');
      return;
    }

    setIsOtpLoading(true);
    try {
      const endpoint = authMode === 'register'
        ? `${apiBaseUrl}/api/auth/otp/verify-registration`
        : `${apiBaseUrl}/api/auth/otp/verify-login`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          challengeId: otpChallengeId,
          otp: trimmedOtp,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        setFormError(body?.error?.message || 'Verification failed. Please check the code.');
        setIsOtpLoading(false);
        return;
      }

      const { user, token, isFirstLogin } = body.data;
      const userSession: UserSession = {
        userId: user.userId,
        email: user.email,
        name: user.displayName,
        rollNumber: user.email.split('@')[0],
        role: user.role,
        isOnboarded: !isFirstLogin,
        hasStudyConsent: !isFirstLogin,
        hasSocialConsent: false,
        sessionToken: token,
        isFirstLogin: Boolean(isFirstLogin),
      };

      switchRole(userSession);
      const target = validateReturnPath(fromParam, user.role);
      navigate(target, { replace: true });
    } catch {
      setFormError('Network error: Unable to reach the backend service.');
    } finally {
      setIsOtpLoading(false);
    }
  };

  const handleSignOut = () => {
    logout();
  };

  if (isRestoringSession) {
    return (
      <div role="status" aria-live="polite" className="text-center text-sm text-craft-muted py-10">
        Restoring your session...
      </div>
    );
  }

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

  return (
    <Card variant="craft" className="shadow-craft-md max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="w-10 h-10 rounded-lg bg-ember-600/20 border border-ember-500/40 flex items-center justify-center text-ember-400 font-mono font-bold text-base mx-auto mb-2">
          CD
        </div>
        <CardTitle>Sign In to Campus Duo</CardTitle>
        <CardDescription>
          Institutional access for IIT Kanpur students and campus administrators.
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
              <Badge variant="success" dot>Active Session</Badge>
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
            <span>Currently Signed Out. Sign in with your IITK email or choose a demo identity.</span>
          </div>
        )}

        {/* Local IITK Account Form */}
        <div className="p-4 rounded-lg bg-craft-surface border border-craft-border space-y-3">
          <div className="flex border-b border-craft-border pb-2 gap-2 text-xs font-medium">
            <button
              type="button"
              className={`pb-1 px-1 transition-colors ${authMode === 'signin' ? 'text-ember-400 border-b-2 border-ember-500 font-semibold' : 'text-craft-muted hover:text-craft-ink'}`}
              onClick={() => { setAuthMode('signin'); setFormError(null); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`pb-1 px-1 transition-colors ${authMode === 'register' ? 'text-ember-400 border-b-2 border-ember-500 font-semibold' : 'text-craft-muted hover:text-craft-ink'}`}
              onClick={() => { setAuthMode('register'); setFormError(null); }}
            >
              Register (@iitk.ac.in)
            </button>
          </div>

          {allowTestPassword && (
            <div className="flex items-center justify-between text-[11px] text-craft-muted pt-1">
              <span>Authentication method (Test Harness):</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${authMethod === 'password' ? 'bg-ember-500/20 text-ember-400 border border-ember-500/40' : 'bg-craft-surface border border-craft-border text-craft-muted hover:text-craft-ink'}`}
                  onClick={() => { setAuthMethod('password'); setFormError(null); setOtpNotice(null); }}
                >
                  Password
                </button>
                <button
                  type="button"
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${authMethod === 'otp' ? 'bg-ember-500/20 text-ember-400 border border-ember-500/40' : 'bg-craft-surface border border-craft-border text-craft-muted hover:text-craft-ink'}`}
                  onClick={() => { setAuthMethod('otp'); setFormError(null); setOtpNotice(null); }}
                >
                  One-Time Code (OTP)
                </button>
              </div>
            </div>
          )}

          {authMethod === 'password' ? (
            <form onSubmit={handleLocalSubmit} className="space-y-3 pt-1">
              {formError && (
                <div className="p-2.5 rounded bg-red-950/40 border border-red-500/50 text-xs text-red-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {authMode === 'register' && (
                <Input
                  label="Full Name"
                  placeholder="e.g. Alex Rivera"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  leftAdornment={<User className="w-4 h-4" />}
                  required
                />
              )}

              <Input
                label="IITK Email Address"
                placeholder="username@iitk.ac.in"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftAdornment={<Mail className="w-4 h-4" />}
                helperText="Must be a valid @iitk.ac.in address"
                required
              />

              <Input
                label="Password"
                placeholder="••••••••"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftAdornment={<Lock className="w-4 h-4" />}
                helperText="At least 8 characters"
                required
              />

              <Button
                type="submit"
                variant="ember"
                size="sm"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? 'Processing...'
                  : authMode === 'register'
                  ? 'Register Student Account'
                  : 'Sign In to Account'}
              </Button>
            </form>
          ) : otpStage === 'request' ? (
            <form onSubmit={handleRequestOtp} className="space-y-3 pt-1">
              {formError && (
                <div className="p-2.5 rounded bg-red-950/40 border border-red-500/50 text-xs text-red-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {authMode === 'register' && (
                <Input
                  label="Full Name"
                  placeholder="e.g. Alex Rivera"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  leftAdornment={<User className="w-4 h-4" />}
                  required
                />
              )}

              <Input
                label="IITK Email Address"
                placeholder="username@iitk.ac.in"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftAdornment={<Mail className="w-4 h-4" />}
                helperText="Must be a valid @iitk.ac.in address"
                required
              />

              <Button
                type="submit"
                variant="ember"
                size="sm"
                className="w-full"
                disabled={isOtpLoading}
              >
                {isOtpLoading
                  ? 'Dispatching OTP...'
                  : authMode === 'register'
                  ? 'Request Registration OTP'
                  : 'Request Login OTP'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-3 pt-1">
              {formError && (
                <div className="p-2.5 rounded bg-red-950/40 border border-red-500/50 text-xs text-red-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {otpNotice && (
                <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-500/50 text-xs text-emerald-300 flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{otpNotice}</span>
                </div>
              )}

              <Input
                label="6-Digit Verification Code"
                placeholder="123456"
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                leftAdornment={<Lock className="w-4 h-4" />}
                helperText="Enter the 6-digit verification code received by email. If multiple codes were received, enter the latest."
                maxLength={6}
                required
              />

              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="ember"
                  size="sm"
                  className="flex-1"
                  disabled={isOtpLoading}
                >
                  {isOtpLoading
                    ? 'Verifying...'
                    : authMode === 'register'
                    ? 'Verify & Register'
                    : 'Verify & Sign In'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRequestOtp}
                  disabled={isOtpLoading || resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Code'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setOtpStage('request'); setOtpNotice(null); setFormError(null); }}
                  disabled={isOtpLoading}
                >
                  Back
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Demo Fast Logins Section (When Demo Authentication is enabled) */}
        {isDemoAuthEnabled && (
          <div className="space-y-2 pt-2 border-t border-craft-border">
            <p className="text-[11px] text-craft-muted font-mono uppercase tracking-wider text-center">
              Demonstration Identities
            </p>

            <Button
              variant="ember"
              size="md"
              className="w-full justify-between"
              disabled={isDemoLoading}
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
              disabled={isDemoLoading}
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
              disabled={isDemoLoading}
              onClick={() => handleRoleSignIn('ROLE_ADMIN')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              <div className="text-left">
                <p className="font-semibold text-xs">Continue as Administrator (Senate Moderator)</p>
                <span className="text-[10px] opacity-80 font-normal">Governance console • Bypasses onboarding</span>
              </div>
            </Button>
          </div>
        )}

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
          <span>Institutional RBAC active. Least-privilege student enrollment enforced.</span>
        </div>
      </CardFooter>
    </Card>
  );
};
