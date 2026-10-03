import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import { useToast } from '@/components/ui/Toast';

export const SettingsPage: React.FC = () => {
  const { socialConsent, grantSocialConsent, revokeSocialConsent } = useDemoAuth();
  const { addToast } = useToast();

  const handleToggleConsent = () => {
    if (socialConsent) {
      revokeSocialConsent();
      addToast({
        type: 'info',
        title: 'Social Discovery Paused',
        description: 'Your social profile is now dormant. Your study matching remains active.',
      });
    } else {
      grantSocialConsent();
      addToast({
        type: 'success',
        title: 'Social Discovery Activated',
        description: 'You are now discoverable for campus clubs and activities.',
      });
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Privacy & Consent Settings"
        subtitle="Manage independent consent toggles, discovery visibility, and account permissions."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Settings', isCurrent: true },
        ]}
      />

      <Card variant="default">
        <CardHeader>
          <CardTitle>Independent Discovery Consent</CardTitle>
          <CardDescription>
            Decoupled consent architecture: Study matching and social discovery operate independently.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-lg bg-craft-surface border border-craft-border flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-craft-ink">Academic Study Mode</span>
                <Badge variant="success">Active</Badge>
              </div>
              <p className="text-xs text-craft-muted mt-0.5">
                Allows enrolled peers in CS455, MTH101 to find you for course study partnerships.
              </p>
            </div>
            <Badge variant="mono">Enrolled</Badge>
          </div>

          <div className="p-4 rounded-lg bg-craft-surface border border-craft-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs text-craft-ink">Campus Social Discovery Mode</span>
                <Badge variant={socialConsent ? 'success' : 'outline'}>
                  {socialConsent ? 'Active' : 'Disabled'}
                </Badge>
              </div>
              <p className="text-xs text-craft-muted mt-0.5">
                Allows peers to discover your extracurricular club, sport, and hobby tags. Contact handles reveal only upon mutual agreement.
              </p>
            </div>
            <Button
              variant={socialConsent ? 'danger' : 'ember'}
              size="sm"
              onClick={handleToggleConsent}
            >
              {socialConsent ? 'Revoke Consent' : 'Activate Social'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card variant="default">
        <CardHeader>
          <CardTitle className="text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Account Management
          </CardTitle>
          <CardDescription>
            Account deletion and anonymization retention policies are governed by DEC-12 (Open Policy).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-craft-muted">
            Requesting account deletion will immediately remove your profile from all discovery feeds. Audit records regarding reported interactions or facility damage are preserved per campus regulations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
