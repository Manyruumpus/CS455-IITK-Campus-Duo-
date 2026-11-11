import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';

export const AuthCallbackPage: React.FC = () => {
  return (
    <Card variant="default">
      <CardHeader className="text-center">
        <CardTitle>Sign-in link unavailable</CardTitle>
        <CardDescription>
          Use the standard institutional sign-in flow to access Campus Duo.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <Link to="/login" className="text-xs text-ember-400 underline block">
          Return to sign in
        </Link>
      </CardContent>
    </Card>
  );
};
