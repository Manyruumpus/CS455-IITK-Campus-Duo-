import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Heart,
  EyeOff,
  SkipForward,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorState } from '@/components/ui/ErrorState';
import { useToast } from '@/components/ui/Toast';
import { useStudyPartnerDetail, useRecordStudyAction } from '@/queries';

export const StudyDetailPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const {
    data: detail,
    isLoading,
    isError,
    error,
    refetch,
  } = useStudyPartnerDetail(studentId);

  const recordActionMutation = useRecordStudyAction();

  const handleAction = async (action: 'LIKE' | 'PASS' | 'HIDE') => {
    if (!detail) return;
    try {
      const res = await recordActionMutation.mutateAsync({
        targetStudentId: detail.profile.userId,
        action,
        candidateName: detail.profile.displayName,
      });

      if (action === 'LIKE') {
        if (res.relationshipStatus === 'MUTUAL_CONNECTED') {
          addToast({
            type: 'success',
            title: 'Mutual Study Connection Established!',
            description: 'You and this peer both liked each other. You are now study partners!',
          });
        } else {
          addToast({
            type: 'info',
            title: 'Study Like Sent',
            description: 'Your study interest has been recorded.',
          });
        }
      } else if (action === 'PASS') {
        addToast({
          type: 'info',
          title: 'Candidate Passed',
          description: 'Profile dismissed from recommendations.',
        });
        navigate('/app/study');
      } else if (action === 'HIDE') {
        addToast({
          type: 'info',
          title: 'Partner Hidden',
          description: 'This candidate will no longer appear in your study recommendations.',
        });
        navigate('/app/study');
      }
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Action Failed',
        description: (err as Error)?.message || 'Unable to record study action. Please try again.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <LoadingSkeleton lines={2} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <LoadingSkeleton lines={4} />
            <LoadingSkeleton lines={5} />
          </div>
          <div>
            <LoadingSkeleton lines={6} />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Study Partner Profile"
          breadcrumbs={[
            { label: 'Dashboard', href: '/app/dashboard' },
            { label: 'Study Matching', href: '/app/study' },
            { label: 'Profile Not Found', isCurrent: true },
          ]}
        />
        <ErrorState
          title="Unable to Load Study Partner Profile"
          message={(error as Error)?.message || 'This student may have disabled study discovery or profile is unavailable.'}
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const { profile, compatibilityBreakdown: breakdown, relationshipStatus, aiMatchScore } = detail;
  const isMutual = relationshipStatus === 'MUTUAL_CONNECTED';
  const isPending = relationshipStatus === 'PENDING_SENT';

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile.displayName}
        subtitle={`${profile.degree} in ${profile.department} · Year ${profile.year}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Study Matching', href: '/app/study' },
          { label: profile.displayName, isCurrent: true },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/app/study">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Feed
              </Button>
            </Link>

            {isMutual ? (
              <div className="flex items-center gap-2">
                <Badge variant="success">Mutual Study Partner</Badge>
                <Link to="/app/booking/table-grid">
                  <Button variant="ember" size="sm">
                    Book Shared Table
                  </Button>
                </Link>
              </div>
            ) : isPending ? (
              <Badge variant="ember">Liked (Pending Acceptance)</Badge>
            ) : (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  title="Hide partner permanently"
                  disabled={recordActionMutation.isPending}
                  onClick={() => handleAction('HIDE')}
                  className="text-craft-muted hover:text-rose-400"
                >
                  <EyeOff className="w-3.5 h-3.5 mr-1" />
                  Hide
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={recordActionMutation.isPending}
                  onClick={() => handleAction('PASS')}
                >
                  <SkipForward className="w-3.5 h-3.5 mr-1" />
                  Pass
                </Button>
                <Button
                  variant="ember"
                  size="sm"
                  disabled={recordActionMutation.isPending}
                  onClick={() => handleAction('LIKE')}
                >
                  <Heart className="w-3.5 h-3.5 mr-1 fill-current" />
                  Send Study Like
                </Button>
              </div>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Academic details and Factor breakdown */}
        <div className="md:col-span-2 space-y-6">
          {/* Enrolled Courses */}
          <Card variant="default">
            <CardHeader>
              <CardTitle>Academic Course Enrollments</CardTitle>
              <CardDescription>Courses actively enrolled for collaborative study.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.courses.map((course) => (
                <div
                  key={course.code}
                  className="p-3 rounded-lg bg-craft-surface border border-craft-border flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono text-xs font-bold text-ember-400">{course.code}</span>
                    <p className="text-xs font-medium text-craft-ink">{course.name}</p>
                  </div>
                  <Badge variant="mono">{course.department}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Compatibility Breakdown Card */}
          <Card variant="craft">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-ember-400" />
                  Compatibility Factor Breakdown
                </CardTitle>
                <Badge variant="ember">
                  {aiMatchScore}% Compatibility (Demo)
                </Badge>
              </div>
              <CardDescription>
                Calculated via proposed demo formula (35C + 25T + 10Style + 10Pace + 10Loc + 10Goals) with active weight renormalization.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {breakdown ? (
                <div className="space-y-3">
                  {/* Course Factor */}
                  <div className="p-3 rounded bg-craft-surface border border-craft-border space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-craft-ink">
                        Course Overlap (Base 35% · Effective {breakdown.courseFactor.effectiveWeight.toFixed(1)}%)
                      </span>
                      <span className="text-ember-400 font-mono font-medium">
                        {(breakdown.courseFactor.normalizedScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-[11px] text-craft-muted">{breakdown.courseFactor.explanation}</p>
                  </div>

                  {/* Time Factor */}
                  <div className="p-3 rounded bg-craft-surface border border-craft-border space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-craft-ink">
                        Time Availability (Base 25% · Effective {breakdown.timeFactor.effectiveWeight.toFixed(1)}%)
                      </span>
                      <span className="text-ember-400 font-mono font-medium">
                        {(breakdown.timeFactor.normalizedScore * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-[11px] text-craft-muted">{breakdown.timeFactor.explanation}</p>
                  </div>

                  {/* Study Style Subfactor (Optional) */}
                  <div className="p-3 rounded bg-craft-surface border border-craft-border space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-craft-ink">
                        Study Style (Base 10% · {breakdown.styleFactor ? `Effective ${breakdown.styleFactor.effectiveWeight.toFixed(1)}%` : 'Omitted - Not Comparable'})
                      </span>
                      <span className="text-craft-muted font-mono font-medium">
                        {breakdown.styleFactor ? `${(breakdown.styleFactor.normalizedScore * 100).toFixed(0)}%` : 'Omitted'}
                      </span>
                    </div>
                    <p className="text-[11px] text-craft-muted">
                      {breakdown.styleFactor?.explanation || 'Optional preference not comparable between profiles. Weight renormalized.'}
                    </p>
                  </div>

                  {/* Study Pace Subfactor (Optional) */}
                  <div className="p-3 rounded bg-craft-surface border border-craft-border space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-craft-ink">
                        Study Pace (Base 10% · {breakdown.paceFactor ? `Effective ${breakdown.paceFactor.effectiveWeight.toFixed(1)}%` : 'Omitted - Not Comparable'})
                      </span>
                      <span className="text-craft-muted font-mono font-medium">
                        {breakdown.paceFactor ? `${(breakdown.paceFactor.normalizedScore * 100).toFixed(0)}%` : 'Omitted'}
                      </span>
                    </div>
                    <p className="text-[11px] text-craft-muted">
                      {breakdown.paceFactor?.explanation || 'Optional preference not comparable between profiles. Weight renormalized.'}
                    </p>
                  </div>

                  {/* Location Factor (Optional) */}
                  <div className="p-3 rounded bg-craft-surface border border-craft-border space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-craft-ink">
                        Location Proximity (Base 10% · {breakdown.locationFactor ? `Effective ${breakdown.locationFactor.effectiveWeight.toFixed(1)}%` : 'Omitted'})
                      </span>
                      <span className="text-craft-muted font-mono font-medium">
                        {breakdown.locationFactor ? `${(breakdown.locationFactor.normalizedScore * 100).toFixed(0)}%` : 'Omitted'}
                      </span>
                    </div>
                    <p className="text-[11px] text-craft-muted">
                      {breakdown.locationFactor?.explanation || 'Attribute not configured in profile. Weight renormalized.'}
                    </p>
                  </div>

                  {/* Goals Factor (Optional) */}
                  <div className="p-3 rounded bg-craft-surface border border-craft-border space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-craft-ink">
                        Academic Goals (Base 10% · {breakdown.goalsFactor ? `Effective ${breakdown.goalsFactor.effectiveWeight.toFixed(1)}%` : 'Omitted'})
                      </span>
                      <span className="text-craft-muted font-mono font-medium">
                        {breakdown.goalsFactor ? `${(breakdown.goalsFactor.normalizedScore * 100).toFixed(0)}%` : 'Omitted'}
                      </span>
                    </div>
                    <p className="text-[11px] text-craft-muted">
                      {breakdown.goalsFactor?.explanation || 'Attribute not configured in profile. Weight renormalized.'}
                    </p>
                  </div>

                  {/* Completeness & Near-Tie Metadata */}
                  <div className="pt-2 border-t border-craft-border flex flex-wrap items-center justify-between gap-2 text-[11px] text-craft-muted">
                    <div className="flex items-center">
                      <span>Preference Completeness: </span>
                      <span className="font-medium text-craft-ink ml-1">
                        {(breakdown.dataCompletenessScore * 100).toFixed(0)}%
                      </span>
                      {breakdown.dataCompletenessScore < 0.8 && (
                        <Badge variant="warning" className="ml-2" data-testid="completeness-badge">
                          Limited preference data
                        </Badge>
                      )}
                    </div>
                    {breakdown.isNearTied && (
                      <Badge variant="mono">Near-Tied Candidate</Badge>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-craft-muted">
                  Detailed compatibility metrics unavailable for this profile.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Schedule and Habits */}
        <div className="space-y-4">
          <Card variant="default">
            <CardHeader>
              <CardTitle>Study Habits & Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div>
                <span className="text-craft-muted">Study Style:</span>
                <p className="font-medium text-craft-ink mt-0.5">
                  {profile.studyStyle ? profile.studyStyle.replace(/_/g, ' ') : 'Not specified'}
                </p>
              </div>
              <div>
                <span className="text-craft-muted">Revision Pace:</span>
                <p className="font-medium text-craft-ink mt-0.5">
                  {profile.preferredPace ? profile.preferredPace.replace(/_/g, ' ') : 'Not specified'}
                </p>
              </div>
              <div>
                <span className="text-craft-muted">Preferred Time Slots:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {profile.preferredTimes && profile.preferredTimes.length > 0 ? (
                    profile.preferredTimes.map((t) => (
                      <Badge key={t} variant="mono">
                        {t}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-craft-muted">Flexible / Not set</span>
                  )}
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-3 border-t border-craft-border text-[11px] text-craft-muted">
              <div className="space-y-1">
                <p className="font-semibold text-craft-subtle">Privacy & Boundary Notice:</p>
                <p>
                  Study connections enable 2-person table bookings only. Contact details and personal chats
                  remain protected and are not unlocked by study partnerships.
                </p>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
};


