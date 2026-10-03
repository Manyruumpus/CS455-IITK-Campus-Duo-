import React from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';

export const AuthRecoveryPage: React.FC = () => {
  return (
    <Card variant="default">
      <CardHeader className="text-center">
        <div className="w-10 h-10 rounded-full bg-amber-900/30 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto mb-2">
          <RotateCcw className="w-5 h-5" />
        </div>
        <CardTitle>Session Recovery</CardTitle>
        <CardDescription>
          Simulating recovery for an expired campus session token.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-craft-muted leading-relaxed">
        <p>
          In production, session refresh tokens are exchanged silently in the background. If a session token expires while editing a form, Campus Duo preserves dirty inputs and prompts seamless re-authentication.
        </p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Link to="/login">
          <Button variant="ember" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
            Re-authenticate Session
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};
