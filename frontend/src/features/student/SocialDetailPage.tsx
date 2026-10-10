import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Heart, EyeOff, SkipForward, AlertCircle, Settings } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import { useSocialPeerDetail, useRecordSocialAction } from '@/queries';
import { useBlockUser } from '@/queries/moderationHooks';
import { ReportDialog } from '@/components/moderation/ReportDialog';

export const SocialDetailPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const { session } = useDemoAuth();
  const { data: rec, isLoading, error } = useSocialPeerDetail(studentId);
  const { mutate: recordAction, isPending: isActionPending } = useRecordSocialAction();
  const blockMutation = useBlockUser();
  const [reportOpen, setReportOpen] = useState(false);

  // Consent required gate
  if (session && !session.hasSocialConsent) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Social Peer Profile"
          breadcrumbs={[
            { label: 'Dashboard', href: '/app/dashboard' },
            { label: 'Social Discovery', href: '/app/social' },
            { label: 'Profile', isCurrent: true },
          ]}
        />
        <Card variant="craft">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="font-semibold text-sm">Social Discovery Consent Required</span>
            </div>
            <p className="text-xs text-craft-muted">
              You must enable social discovery in Settings to view peer profiles.
            </p>
            <Link to="/app/settings">
              <Button variant="ember" size="sm" leftIcon={<Settings className="w-3.5 h-3.5" />}>
                Go to Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-1/3 rounded bg-craft-border" />
        <div className="h-40 rounded bg-craft-border" />
      </div>
    );
  }

  // Error / not found / excluded by privacy
  if (error || !rec) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Profile Unavailable"
          breadcrumbs={[
            { label: 'Dashboard', href: '/app/dashboard' },
            { label: 'Social Discovery', href: '/app/social' },
            { label: 'Unavailable', isCurrent: true },
          ]}
        />
        <Card variant="default">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="text-sm font-semibold">Profile not available</span>
            </div>
            <p className="text-xs text-craft-muted">
              {error?.message ??
                'This profile is unavailable. The candidate may have opted out of social discovery, or the profile does not exist.'}
            </p>
            <Link to="/app/social">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Discovery
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { profile, groundedReasons = [], relationshipStatus, sharedInterests } = rec;

  const handleAction = (action: 'LIKE' | 'PASS' | 'HIDE') => {
    recordAction({ targetUserId: profile.userId, action, candidateName: profile.displayName });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile.displayName}
        subtitle="Campus Social Profile — Clubs & Activities"
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Social Discovery', href: '/app/social' },
          { label: profile.displayName, isCurrent: true },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/app/social">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Feed
              </Button>
            </Link>
            {relationshipStatus === 'MUTUAL_CONNECTED' ? (
              <Badge variant="success" className="px-3 py-1">Mutually Connected</Badge>
            ) : relationshipStatus === 'PENDING_SENT' ? (
              <Badge variant="outline" className="px-3 py-1">Like Sent</Badge>
            ) : (
              <Button
                variant="ember"
                size="sm"
                disabled={isActionPending}
                leftIcon={<Heart className="w-3.5 h-3.5" />}
                onClick={() => handleAction('LIKE')}
                aria-label={`Like ${profile.displayName}`}
              >
                Like
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Bio */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>About & Bio</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-craft-ink leading-relaxed">
                {profile.bio || 'No bio provided.'}
              </p>
            </CardContent>
          </Card>

          {/* Interest tags */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>Campus Activity & Interest Tags</CardTitle>
              <CardDescription>Public extracurricular interest markers.</CardDescription>
            </CardHeader>
            <CardContent>
              {profile.interests.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((interest) => (
                    <Badge
                      key={interest.id}
                      variant={sharedInterests.includes(interest.name) ? 'success' : 'default'}
                      className="py-1 px-2.5 text-xs"
                      title={sharedInterests.includes(interest.name) ? 'Shared interest' : undefined}
                    >
                      {interest.name}
                      <span className="ml-1 text-[10px] opacity-70">({interest.category.replace(/_/g, ' ')})</span>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-craft-muted">No interests listed.</p>
              )}
            </CardContent>
          </Card>

          {/* Grounded match reasons */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>Match Basis</CardTitle>
              <CardDescription>Grounded reasons derived from public data only. No AI ranking.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {groundedReasons.map((reason, idx) => (
                  <li key={idx} className="text-xs text-craft-ink flex items-start gap-2">
                    <span className="text-ember-400 mt-0.5">•</span>
                    {reason}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <span className="text-[11px] text-craft-muted">
                Demo-only. No numeric social compatibility score.
              </span>
            </CardFooter>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Privacy policy */}
          <Card variant="craft">
            <CardHeader>
              <CardTitle className="text-sm">Privacy & Contact Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="p-3 rounded bg-craft-surface border border-craft-border space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Contact Disclosure Protection</span>
                </div>
                <p className="text-craft-ink font-semibold">Privacy-Protected (Not Disclosed)</p>
                <p className="text-[11px] text-craft-muted leading-relaxed">
                  Per DEC-08, personal handles, phone numbers and external messaging addresses are completely excluded from public social profiles. Messaging is not implemented.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          {relationshipStatus !== 'MUTUAL_CONNECTED' && (
            <Card variant="default">
              <CardHeader>
                <CardTitle className="text-sm">Discovery Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  disabled={isActionPending}
                  leftIcon={<SkipForward className="w-3.5 h-3.5" />}
                  onClick={() => handleAction('PASS')}
                  aria-label={`Pass ${profile.displayName} for this discovery round`}
                >
                  Pass — dismiss for this round
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  disabled={isActionPending}
                  leftIcon={<EyeOff className="w-3.5 h-3.5" />}
                  onClick={() => handleAction('HIDE')}
                  aria-label={`Hide ${profile.displayName} permanently from feed`}
                >
                  Hide — remove from feed
                </Button>
              </CardContent>
            </Card>
          )}

          <Card variant="default">
            <CardHeader><CardTitle className="text-sm">Safety controls</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p className="text-[11px] text-craft-muted">
                Block currently excludes this account from supported social discovery, detail, and actions only.
                Existing bookings and connections are not deleted or cancelled.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setReportOpen(true)}>Report</Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => blockMutation.mutate(profile.userId)}
                  disabled={blockMutation.isPending || blockMutation.isSuccess}
                  isLoading={blockMutation.isPending}
                >
                  {blockMutation.isSuccess ? 'Blocked' : 'Block'}
                </Button>
              </div>
              {blockMutation.isError && <p role="alert" className="text-xs text-red-300">{blockMutation.error.message}</p>}
            </CardContent>
          </Card>

          {/* Mutual connection notice */}
          {relationshipStatus === 'MUTUAL_CONNECTED' && (
            <Card variant="craft">
              <CardContent className="p-4 text-xs space-y-1">
                <p className="font-semibold text-emerald-400">Mutually Connected</p>
                <p className="text-craft-muted">
                  You and {profile.displayName} have mutually connected. No contact details are exchanged. Connection management is deferred to Stage 07.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Preferences link */}
          <Link to="/app/settings" className="block">
            <Button variant="outline" size="sm" className="w-full">
              Social Preferences & Settings
            </Button>
          </Link>
        </div>
        <ReportDialog
          isOpen={reportOpen}
          onClose={() => setReportOpen(false)}
          reportedUserId={profile.userId}
          reportedUserName={profile.displayName}
        />
      </div>
    </div>
  );
};
