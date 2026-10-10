import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, AlertTriangle, UserX, ArrowRight, BookOpen, Users, CheckCircle, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import {
  useStudyConsent,
  useSocialConsent,
  useUpdateStudyConsent,
  useUpdateSocialConsent,
  useBlockedUsers,
} from '@/queries/consentHooks';
import { usePrivateProfile } from '@/queries/profileHooks';
import { useResetDemoState } from '@/queries/connectionHooks';
import { AppError } from '@/types';
import { appConfig } from '@/config/features';
import { useMyReports } from '@/queries/moderationHooks';

export const SettingsPage: React.FC = () => {
  const { addToast } = useToast();
  const { data: studyConsent, isLoading: studyLoading } = useStudyConsent();
  const { data: socialConsent, isLoading: socialLoading } = useSocialConsent();
  const { data: profile } = usePrivateProfile();
  const { data: blockedUsers } = useBlockedUsers();
  const { data: myReports } = useMyReports();

  const updateStudyConsentMutation = useUpdateStudyConsent();
  const updateSocialConsentMutation = useUpdateSocialConsent();
  const resetDemoState = useResetDemoState();

  const [studyErrorNotice, setStudyErrorNotice] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const hasRequiredStudyFields = Boolean(
    profile &&
      profile.courses &&
      profile.courses.length > 0 &&
      profile.studyPreferences &&
      profile.studyPreferences.preferredTimes &&
      profile.studyPreferences.preferredTimes.length > 0
  );

  const handleToggleStudyConsent = () => {
    setStudyErrorNotice(null);
    const nextState = !studyConsent?.hasConsent;

    // Amendment 3: Enabling study discovery later in Settings must enforce validation
    if (nextState && !hasRequiredStudyFields) {
      setStudyErrorNotice(
        'Cannot enable study discovery without enrolled courses and valid study availability. Complete your study preferences in Profile first.'
      );
      return;
    }

    updateStudyConsentMutation.mutate(nextState, {
      onSuccess: (res) => {
        addToast({
          type: res.hasConsent ? 'success' : 'info',
          title: res.hasConsent ? 'Study Discovery Activated' : 'Study Discovery Paused',
          description: res.hasConsent
            ? 'Your profile is now visible to classmates enrolled in matching courses.'
            : 'Your profile has been removed from public study partner search feeds.',
        });
      },
      onError: (err) => {
        addToast({
          type: 'error',
          title: 'Update Failed',
          description: err instanceof AppError ? err.message : 'Failed to update study consent.',
        });
      },
    });
  };

  const handleToggleSocialConsent = () => {
    const nextState = !socialConsent?.hasConsent;

    updateSocialConsentMutation.mutate(nextState, {
      onSuccess: (res) => {
        addToast({
          type: res.hasConsent ? 'success' : 'info',
          title: res.hasConsent ? 'Social Discovery Activated' : 'Social Discovery Paused',
          description: res.hasConsent
            ? 'Your extracurricular interest tags are now discoverable by campus peers.'
            : 'Your profile has been removed from public social peer directory feeds.',
        });
      },
      onError: (err) => {
        addToast({
          type: 'error',
          title: 'Update Failed',
          description: err instanceof AppError ? err.message : 'Failed to update social consent.',
        });
      },
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Privacy & Consent Settings"
        subtitle="Manage independent discovery toggles, moderation filters, and data boundaries."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Settings', isCurrent: true },
        ]}
      />

      {/* Independent Discovery Consent (Amendment E) */}
      <Card variant="craft">
        <CardHeader>
          <CardTitle>Independent Discovery Consent</CardTitle>
          <CardDescription>
            Decoupled consent architecture: Academic study matching and campus social discovery operate independently. Mutating one leaves the other untouched.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Study Consent Block */}
          <div className="p-4 rounded-lg bg-craft-surface border border-craft-border space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-ember-400 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-craft-ink">Academic Study Discovery</span>
                    <Badge variant={studyConsent?.hasConsent ? 'success' : 'outline'}>
                      {studyLoading
                        ? 'Loading...'
                        : studyConsent?.hasConsent
                        ? 'Active in Discovery'
                        : 'Disabled'}
                    </Badge>
                  </div>
                  <p className="text-xs text-craft-muted mt-0.5">
                    Permits enrolled peers in your courses to find you for academic collaborations and study-table sharing.
                  </p>
                </div>
              </div>
              <Button
                variant={studyConsent?.hasConsent ? 'danger' : 'ember'}
                size="sm"
                onClick={handleToggleStudyConsent}
                isLoading={updateStudyConsentMutation.isPending}
                disabled={studyLoading}
              >
                {studyConsent?.hasConsent ? 'Opt Out of Study' : 'Enable Study Discovery'}
              </Button>
            </div>

            {studyErrorNotice && (
              <div className="p-3 rounded bg-amber-950/40 border border-amber-500/50 text-xs text-amber-200 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-300">{studyErrorNotice}</p>
                </div>
                <div className="flex justify-end">
                  <Link to="/app/profile">
                    <Button variant="ember" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                      Go to Profile to Complete Required Fields
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Social Consent Block */}
          <div className="p-4 rounded-lg bg-craft-surface border border-craft-border space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-ember-400 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-craft-ink">Campus Social Discovery</span>
                    <Badge variant={socialConsent?.hasConsent ? 'success' : 'outline'}>
                      {socialLoading
                        ? 'Loading...'
                        : socialConsent?.hasConsent
                        ? 'Active in Discovery'
                        : 'Disabled'}
                    </Badge>
                  </div>
                  <p className="text-xs text-craft-muted mt-0.5">
                    Permits campus peers to discover your extracurricular club, sport, and hobby interest tags.
                  </p>
                </div>
              </div>
              <Button
                variant={socialConsent?.hasConsent ? 'danger' : 'ember'}
                size="sm"
                onClick={handleToggleSocialConsent}
                isLoading={updateSocialConsentMutation.isPending}
                disabled={socialLoading}
              >
                {socialConsent?.hasConsent ? 'Opt Out of Social' : 'Enable Social Discovery'}
              </Button>
            </div>

            <div className="p-2.5 rounded bg-craft-base border border-craft-border text-[11px] text-craft-muted space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                <Shield className="w-3.5 h-3.5" />
                <span>Open Policy Notice (DEC-09): Existing Connection Persistence</span>
              </div>
              <p className="leading-relaxed">
                Whether existing connections remain accessible after discovery opt-out is an open decision. In this demonstration, opting out pauses public discovery feeds without silently deleting existing peer relationships.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Moderation & Blocked Accounts (Read-only wire) */}
      <Card variant="craft">
        <CardHeader>
          <CardTitle>Moderation & Blocked Accounts</CardTitle>
          <CardDescription>
            Accounts you have filtered or reported. Unblocking workflows remain pending policy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3.5 rounded-lg bg-craft-surface border border-craft-border text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserX className="w-4 h-4 text-craft-muted" />
              <div>
                <span className="font-medium text-craft-ink">Blocked Accounts</span>
                <p className="text-[11px] text-craft-muted">
                  {blockedUsers && blockedUsers.length > 0
                    ? `${blockedUsers.length} account(s) currently blocked`
                    : 'No accounts blocked.'}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px]">
              Pending Policy (DEC-09)
            </Badge>
          </div>

          <div className="p-2.5 rounded bg-craft-base border border-craft-border text-[11px] text-craft-muted flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Unblock side effects are disabled pending student senate governance policy.</span>
          </div>
          <div className="p-3.5 rounded-lg bg-craft-surface border border-craft-border text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-craft-ink">Your report receipts</span>
              <Badge variant="outline">{myReports?.length ?? 0}</Badge>
            </div>
            <p className="text-[11px] text-craft-muted mt-1">
              Only your own pending receipts are visible. Administrative decisions and confidential notes are not exposed here.
            </p>
            {myReports && myReports.length > 0 && (
              <ul className="mt-2 space-y-1 text-[11px]">
                {myReports.map((report) => (
                  <li key={report.reportId} className="flex justify-between gap-2">
                    <span>{report.reportId}</span>
                    <span className="text-craft-muted">{report.status.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Account Data Retention & Deletion */}
      <Card variant="craft">
        <CardHeader>
          <CardTitle>Account Deletion & Data Retention</CardTitle>
          <CardDescription>
            Campus account retention and data deletion guidelines (DEC-12).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3.5 rounded-lg bg-craft-surface border border-craft-border text-xs flex items-center justify-between">
            <div>
              <span className="font-semibold text-craft-ink">Permanent Account Purge</span>
              <p className="text-[11px] text-craft-muted mt-0.5">
                Account deletion and data retention remain pending team/user-approved retention policy.
              </p>
            </div>
            <Button variant="outline" size="sm" disabled>
              Pending Policy (DEC-12)
            </Button>
          </div>
        </CardContent>
      </Card>

      {appConfig.isDemoAuthEnabled && (
        <Card variant="craft" data-testid="demo-reset-card">
          <CardHeader>
            <CardTitle>Demo Scenario Reset</CardTitle>
            <CardDescription>
              Coordinated full demo-state reset. Clears mock store data, study/social Like maps,
              scenario state, and UI caches. For demonstration purposes only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded border border-amber-500/40 bg-amber-950/10 text-[11px] text-craft-muted space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                <Shield className="w-3.5 h-3.5" />
                Reset affects only in-memory mock services
              </div>
              <p>
                This is NOT a production data action. Production backend adapters continue to throw
                SERVICE_UNAVAILABLE for reset.
              </p>
            </div>

            {!confirmReset ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmReset(true)}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                disabled={resetDemoState.isPending}
                aria-label="Initiate coordinated demo reset"
              >
                Reset Demo State
              </Button>
            ) : (
              <div className="space-y-3 p-3 rounded bg-craft-surface border border-craft-border">
                <p className="text-[11px] text-craft-muted">
                  Confirm that you want to reset mock store, Like maps, scenario state, and UI caches
                  back to seeded baseline. This action cannot be undone inside the mock runtime.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      resetDemoState.mutate(undefined, {
                        onSuccess: () => setConfirmReset(false),
                        onError: () => setConfirmReset(false),
                      });
                    }}
                    isLoading={resetDemoState.isPending}
                    leftIcon={<CheckCircle className="w-3.5 h-3.5" />}
                  >
                    Confirm Reset
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmReset(false)}
                    disabled={resetDemoState.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
