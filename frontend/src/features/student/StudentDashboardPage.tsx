import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, ArrowRight, Sparkles, Clock, AlertCircle, Users2, Handshake } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import {
  useStudyRecommendations,
  useSocialRecommendations,
  useConnectionCounts,
} from '@/queries';

export const StudentDashboardPage: React.FC = () => {
  const { session } = useDemoAuth();
  const { data: recommendations, isLoading: isStudyLoading } = useStudyRecommendations();
  const { data: studyCounts } = useConnectionCounts('STUDY');
  const { data: socialCounts } = useConnectionCounts('SOCIAL');
  const { data: socialPeers } = useSocialRecommendations();

  const topMatch = recommendations && recommendations.length > 0 ? recommendations[0] : null;
  const socialMutualCount = socialCounts?.mutual ?? 0;
  const studyIncomingCount = studyCounts?.incoming ?? 0;
  const studyMutualCount = studyCounts?.mutual ?? 0;
  const discoveryCount = socialPeers?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${session?.name || 'Student'}`}
        subtitle={
          session?.rollNumber
            ? `IIT Kanpur Student · Roll #${session.rollNumber}`
            : 'IIT Kanpur Computer Science & Engineering'
        }
        badge={<Badge variant="ember">Active Semester</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/app/booking/table-grid">
              <Button variant="ember" size="sm" rightIcon={<Calendar className="w-3.5 h-3.5" />}>
                Book Study Table
              </Button>
            </Link>
            <Link to="/app/study">
              <Button variant="outline" size="sm" rightIcon={<BookOpen className="w-3.5 h-3.5" />}>
                Find Partner
              </Button>
            </Link>
          </div>
        }
      />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card variant="craft" className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-craft-muted font-medium">Upcoming Reservation</span>
            <Badge variant="success" dot>Confirmed</Badge>
          </div>
          <p className="text-base font-semibold text-craft-ink">Table T-12 (PK Kelkar 2F)</p>
          <p className="text-xs text-craft-muted mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-ember-400" />
            Today, 16:00 – 18:00 (2 Seats)
          </p>
          <div className="mt-3 pt-2 border-t border-craft-border flex justify-end">
            <Link to="/app/booking/bk-1001" className="text-xs text-ember-400 hover:underline flex items-center gap-1">
              View Pass <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </Card>

        <Card variant="default" className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-craft-muted font-medium">Active Enrolled Courses</span>
            <Badge variant="mono">3 Courses</Badge>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="mono">CS455</Badge>
            <Badge variant="mono">MTH101</Badge>
            <Badge variant="mono">ESC102</Badge>
          </div>
          <p className="text-[11px] text-craft-muted mt-3">
            Matching partners based on course revision pace.
          </p>
        </Card>

        <Card variant="default" className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-craft-muted font-medium flex items-center gap-1.5">
              <Handshake className="w-3.5 h-3.5 text-ember-400" />
              Academic Study Requests
            </span>
            {session?.hasStudyConsent ? (
              <Badge variant="success">Live</Badge>
            ) : (
              <Badge variant="outline">Gated</Badge>
            )}
          </div>
          {session?.hasStudyConsent ? (
            <>
              <p className="text-base font-semibold text-craft-ink">
                {studyIncomingCount} Pending · {studyMutualCount} Mutual
              </p>
              <p className="text-xs text-craft-muted mt-1">
                Derived from Like records. Study mode only.
              </p>
            </>
          ) : (
            <p className="text-xs text-craft-muted leading-normal">
              Enable Study Discovery in Settings to view and manage study partner requests.
            </p>
          )}
          <div className="mt-3 pt-2 border-t border-craft-border flex justify-end">
            <Link to="/app/study/requests" className="text-xs text-ember-400 hover:underline flex items-center gap-1">
              View Requests <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </Card>

        <Card variant="default" className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-craft-muted font-medium flex items-center gap-1.5">
              <Users2 className="w-3.5 h-3.5 text-ember-400" />
              Social Discovery
            </span>
            {session?.hasSocialConsent ? (
              <Badge variant="success">Opted In</Badge>
            ) : (
              <Badge variant="outline">Disabled</Badge>
            )}
          </div>
          {session?.hasSocialConsent ? (
            <>
              <p className="text-base font-semibold text-craft-ink">
                {socialMutualCount} Connection{socialMutualCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-craft-muted mt-1">
                {discoveryCount} peer{discoveryCount !== 1 ? 's' : ''} available to discover
              </p>
            </>
          ) : (
            <p className="text-xs text-craft-muted leading-normal">
              Enable social discovery in Settings to explore campus peers.
            </p>
          )}
          <div className="mt-3 pt-2 border-t border-craft-border flex justify-end">
            <Link to="/app/social/connections" className="text-xs text-ember-400 hover:underline flex items-center gap-1">
              View Connections <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </Card>
      </div>

      {/* Suggested Matches & Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Suggested Study Match (Service-derived) */}
        <Card variant="default">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-ember-400" />
                Suggested Study Match
              </CardTitle>
              {topMatch && (
                <Badge variant="ember">
                  {topMatch.aiMatchScore}% Match (Demo)
                </Badge>
              )}
            </div>
            <CardDescription>
              {topMatch?.aiMatchReasons && topMatch.aiMatchReasons.length > 0
                ? `Grounding: ${topMatch.aiMatchReasons[0]}`
                : 'Service-calculated course & time overlap.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!session?.hasStudyConsent ? (
              <div className="p-3 rounded-md bg-craft-surface border border-craft-border text-xs space-y-2">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="font-semibold">Discovery Consent Disabled</span>
                </div>
                <p className="text-craft-muted text-[11px]">
                  Opt into Study Discovery in settings or complete onboarding to receive academic recommendations.
                </p>
                <div className="flex gap-2 pt-1">
                  <Link to="/app/settings">
                    <Button variant="outline" size="sm">Settings</Button>
                  </Link>
                  <Link to="/app/onboarding">
                    <Button variant="ghost" size="sm">Onboarding</Button>
                  </Link>
                </div>
              </div>
            ) : isStudyLoading ? (
              <div className="p-3 rounded-md bg-craft-surface border border-craft-border text-xs text-craft-muted animate-pulse">
                Calculating study recommendations...
              </div>
            ) : topMatch ? (
              <div className="p-3 rounded-md bg-craft-surface border border-craft-border text-xs flex items-center justify-between">
                <div>
                  <p className="font-semibold text-craft-ink">
                    {topMatch.profile.displayName} ({topMatch.profile.department})
                  </p>
                  <p className="text-[11px] text-craft-muted">
                    Style: {topMatch.profile.studyStyle?.replace(/_/g, ' ') || 'Flexible'} · Pace: {topMatch.profile.preferredPace?.replace(/_/g, ' ') || 'Standard'}
                  </p>
                </div>
                <Link to={`/app/study/${topMatch.profile.userId}`}>
                  <Button variant="outline" size="sm">View Profile</Button>
                </Link>
              </div>
            ) : (
              <div className="p-3 rounded-md bg-craft-surface border border-craft-border text-xs text-craft-muted">
                No active recommendations currently found. Try adjusting your course enrollments or discovery criteria.
              </div>
            )}
          </CardContent>
          <CardFooter>
            <span className="text-[11px] text-craft-muted">
              {topMatch?.compatibilityBreakdown?.isNearTied ? 'Near-tied candidate. ' : ''}
              Service-calculated demo match.
            </span>
            <Link to="/app/study" className="text-xs text-ember-400 hover:underline">
              Browse all partners →
            </Link>
          </CardFooter>
        </Card>


        {/* Quick Booking Hub */}
        <Card variant="default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-400" />
              Shared Table Reservations
            </CardTitle>
            <CardDescription>Canonical 2-person table reservations across campus.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="p-2.5 rounded bg-craft-surface border border-craft-border flex items-center justify-between text-xs">
              <div>
                <p className="font-medium text-craft-ink">P.K. Kelkar Library — 2nd Floor</p>
                <p className="text-[11px] text-craft-muted">Whisper collaboration zone · Power plugs</p>
              </div>
              <Link to="/app/booking/table-grid">
                <Button variant="ember" size="sm">Book Table</Button>
              </Link>
            </div>
            <div className="p-2.5 rounded bg-craft-surface border border-craft-border flex items-center justify-between text-xs">
              <div>
                <p className="font-medium text-craft-ink">Computer Centre CC-101</p>
                <p className="text-[11px] text-craft-muted">Conversational coding workstations</p>
              </div>
              <Link to="/app/booking/table-grid">
                <Button variant="outline" size="sm">Book Table</Button>
              </Link>
            </div>
          </CardContent>
          <CardFooter>
            <span className="text-[11px] text-craft-muted">Strict 2-person table allocation.</span>
            <Link to="/app/booking/history" className="text-xs text-craft-muted hover:text-craft-ink hover:underline">
              Booking History →
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
