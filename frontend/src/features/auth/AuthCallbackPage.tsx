import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';

export const AuthCallbackPage: React.FC = () => {
  const { switchRole } = useDemoAuth();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      switchRole('ROLE_STUDENT');
      setIsProcessing(false);
      setTimeout(() => {
        navigate('/app/dashboard', { replace: true });
      }, 1000);
    }, 1200);

    return () => clearTimeout(timer);
  }, [switchRole, navigate]);

  return (
    <Card variant="default">
      <CardHeader className="text-center">
        <CardTitle>Processing Campus SSO Callback</CardTitle>
        <CardDescription>
          Simulating OAuth2 authorization code exchange and session hydration.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        {isProcessing ? (
          <LoadingSkeleton lines={2} label="Exchanging OAuth authorization code..." />
        ) : (
          <div className="space-y-2 py-4">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <p className="text-xs font-semibold text-craft-ink">
              Authentication Successful! Redirecting to student dashboard...
            </p>
            <Link to="/app/dashboard" className="text-xs text-ember-400 underline block">
              Click here if not redirected automatically
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
