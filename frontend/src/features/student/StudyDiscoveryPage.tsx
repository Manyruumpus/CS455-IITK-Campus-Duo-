import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Sparkles,
  Heart,
  EyeOff,
  SkipForward,
  AlertCircle,
  Settings,
  Search,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { useToast } from '@/components/ui/Toast';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import {
  useStudyRecommendations,
  useRecordStudyAction,
  useSubmitMatchingQuery,
} from '@/queries';
import { StudyDiscoveryFilters, StudyRecommendation, PreferredStudyTime, StudyStyle } from '@/types';

export const StudyDiscoveryPage: React.FC = () => {
  const { session } = useDemoAuth();
  const { addToast } = useToast();

  // Filters state
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('ALL');
  const [selectedTime, setSelectedTime] = useState('ALL');
  const [selectedStyle, setSelectedStyle] = useState('ALL');

  // Agent Matching dialog state
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);
  const [agentCourseCode, setAgentCourseCode] = useState('CS455');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentResults, setAgentResults] = useState<{
    queryId: string;
    status: string;
    recommendations?: StudyRecommendation[];
    suggestedAlternatives?: StudyRecommendation[];
    fallbackReason?: string;
  } | null>(null);

  // Filter params for query
  const filters: StudyDiscoveryFilters = {
    search: search.trim() ? search.trim() : undefined,
    courseCode: selectedCourse !== 'ALL' ? selectedCourse : undefined,
    preferredTime: selectedTime !== 'ALL' ? (selectedTime as PreferredStudyTime) : undefined,
    studyStyle: selectedStyle !== 'ALL' ? (selectedStyle as StudyStyle) : undefined,
  };

  const {
    data: recommendations,
    isLoading,
    isError,
    error,
    refetch,
  } = useStudyRecommendations(filters);

  const recordActionMutation = useRecordStudyAction();
  const submitAgentMutation = useSubmitMatchingQuery();

  const handleAction = async (targetStudentId: string, action: 'LIKE' | 'PASS' | 'HIDE', candidateName?: string) => {
    try {
      const res = await recordActionMutation.mutateAsync({
        targetStudentId,
        action,
        candidateName,
      });
      if (res.action === 'LIKE') {
        if (res.relationshipStatus === 'MUTUAL_CONNECTED') {
          addToast({
            type: 'success',
            title: 'Mutual Study Connection!',
            description: "You and this peer both liked each other's study profiles. You are now study partners!",
          });
        } else {
          addToast({
            type: 'info',
            title: 'Study Like Sent',
            description: 'Your study interest has been recorded.',
          });
        }
      } else if (res.action === 'PASS') {
        addToast({
          type: 'info',
          title: 'Candidate Passed',
          description: 'Profile dismissed from current recommendation round.',
        });
      } else if (res.action === 'HIDE') {
        addToast({
          type: 'info',
          title: 'Partner Hidden',
          description: 'This candidate will no longer appear in your study recommendations.',
        });
      }
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Action Failed',
        description: (err as Error)?.message || 'Unable to record study action. Please try again.',
      });
    }
  };

  const handleRunAgentMatcher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentCourseCode) return;
    try {
      const res = await submitAgentMutation.mutateAsync({
        courseCode: agentCourseCode,
        preferences: {
          studyGoals: agentPrompt.trim() || 'Collaborative study for exams and assignments',
        },
      });
      setAgentResults({
        queryId: res.queryId,
        status: res.status,
        recommendations: res.results,
        suggestedAlternatives: res.suggestedAlternatives,
        fallbackReason: res.fallbackReason,
      });
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Agent Match Failed',
        description: (err as Error)?.message || 'Agent service currently unavailable.',
      });
    }
  };

  // 1. Consent Gate Check
  if (!session?.hasStudyConsent) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Study Partner Discovery"
          subtitle="Connect with peers enrolled in shared IITK courses for collaborative problem-solving."
          breadcrumbs={[
            { label: 'Dashboard', href: '/app/dashboard' },
            { label: 'Study Matching', isCurrent: true },
          ]}
        />
        <Card variant="craft" className="p-8 text-center max-w-2xl mx-auto space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-ember-500/10 flex items-center justify-center text-ember-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl">Study Discovery Consent Required</CardTitle>
          <CardDescription className="text-sm leading-relaxed text-craft-muted">
            Study Discovery is currently disabled for your account. In accordance with student privacy
            controls, you must explicitly opt into Study Discovery and configure your academic profile before
            viewing peer recommendations or making study connection requests.
          </CardDescription>
          <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
            <Link to="/app/settings">
              <Button variant="ember" leftIcon={<Settings className="w-4 h-4" />}>
                Enable in Settings
              </Button>
            </Link>
            <Link to="/app/onboarding">
              <Button variant="outline">
                Review Profile Onboarding
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Study Partner Discovery"
        subtitle="Connect with peers enrolled in shared IITK courses for collaborative problem-solving and quiet study."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Study Matching', isCurrent: true },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ember"
              size="sm"
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              onClick={() => {
                setAgentResults(null);
                setIsAgentDialogOpen(true);
              }}
            >
              AI Study Matcher (Demo)
            </Button>
            <Link to="/app/study/requests">
              <Button variant="outline" size="sm">
                Manage Requests
              </Button>
            </Link>
          </div>
        }
      />

      {/* Filter and Control Bar */}
      <Card variant="default" className="p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-craft-muted absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by name, dept..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded border border-craft-border bg-craft-surface text-craft-ink focus:outline-none focus:border-ember-500"
            />
          </div>

          {/* Course filter */}
          <div>
            <select
              aria-label="Filter by course"
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="w-full py-1.5 px-2.5 text-xs rounded border border-craft-border bg-craft-surface text-craft-ink focus:outline-none focus:border-ember-500"
            >
              <option value="ALL">All Enrolled Courses</option>
              <option value="CS455">CS455 - Software Engineering</option>
              <option value="MTH101">MTH101 - Mathematics I</option>
              <option value="ESC102">ESC102 - Intro to Electronics</option>
              <option value="CS632">CS632 - Advanced Algorithms</option>
              <option value="PHY103">PHY103 - Physics I</option>
            </select>
          </div>

          {/* Time Slot Preference */}
          <div>
            <select
              aria-label="Filter by time slot preference"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full py-1.5 px-2.5 text-xs rounded border border-craft-border bg-craft-surface text-craft-ink focus:outline-none focus:border-ember-500"
            >
              <option value="ALL">Any Time Availability</option>
              <option value="MORNING">Morning (08:00–12:00)</option>
              <option value="AFTERNOON">Afternoon (12:00–17:00)</option>
              <option value="EVENING">Evening (17:00–21:00)</option>
              <option value="LATE_NIGHT">Late Night (21:00+)</option>
            </select>
          </div>

          {/* Study Style */}
          <div>
            <select
              aria-label="Filter by study style"
              value={selectedStyle}
              onChange={(e) => setSelectedStyle(e.target.value)}
              className="w-full py-1.5 px-2.5 text-xs rounded border border-craft-border bg-craft-surface text-craft-ink focus:outline-none focus:border-ember-500"
            >
              <option value="ALL">Any Study Style</option>
              <option value="QUIET_FOCUSED">Quiet Focus</option>
              <option value="DISCUSSION_HEAVY">Discussion Heavy</option>
              <option value="PROBLEM_SOLVING">Problem Solving</option>
              <option value="HYBRID">Hybrid</option>
            </select>
          </div>
        </div>

        {/* Clear Filters & Unsupported Filter Notice */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-craft-border text-[11px] text-craft-muted">
          <div className="flex items-center gap-3">
            <span className="text-craft-subtle font-medium">Active Filters</span>
            {(search || selectedCourse !== 'ALL' || selectedTime !== 'ALL' || selectedStyle !== 'ALL') && (
              <button
                onClick={() => {
                  setSearch('');
                  setSelectedCourse('ALL');
                  setSelectedTime('ALL');
                  setSelectedStyle('ALL');
                }}
                className="text-ember-400 hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-craft-subtle">
            <span className="italic">Hall of Residence filter (Unsupported in Stage 05)</span>
            <span className="inline-block w-1 h-1 rounded-full bg-craft-border" />
            <span>Formula: 35C + 25T + 20P + 10L + 10G (Demo)</span>
          </div>
        </div>
      </Card>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="space-y-4">
          <LoadingSkeleton lines={3} />
          <LoadingSkeleton lines={3} />
          <LoadingSkeleton lines={3} />
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to Load Recommendations"
          message={(error as Error)?.message || 'Service temporarily unavailable. Please retry.'}
          onRetry={() => refetch()}
        />
      ) : recommendations && recommendations.length === 0 ? (
        <EmptyState
          title="No Study Partners Found"
          description="No active study partners match your selected criteria and enrollment overlap. Try clearing course or time filters."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setSelectedCourse('ALL');
                setSelectedTime('ALL');
                setSelectedStyle('ALL');
              }}
            >
              Clear Filters
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations?.map((rec) => {
            const { profile, aiMatchScore, compatibilityBreakdown, relationshipStatus } = rec;
            const isMutual = relationshipStatus === 'MUTUAL_CONNECTED';
            const isPending = relationshipStatus === 'PENDING_SENT';
            const isNearTied = compatibilityBreakdown?.isNearTied;
            const isLowCompleteness =
              compatibilityBreakdown && compatibilityBreakdown.dataCompletenessScore < 0.7;

            return (
              <Card key={profile.userId} variant="default" className="flex flex-col justify-between">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        <Link
                          to={`/app/study/${profile.userId}`}
                          className="hover:text-ember-400 transition-colors"
                        >
                          {profile.displayName}
                        </Link>
                      </CardTitle>
                      <CardDescription>
                        {profile.degree} · Year {profile.year} · {profile.department}
                      </CardDescription>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="ember" dot>
                        {aiMatchScore}% Match (Demo)
                      </Badge>
                      {isNearTied && (
                        <Badge variant="mono" className="text-[10px]">
                          Near-Tied Demo Score
                        </Badge>
                      )}
                      {isLowCompleteness && (
                        <Badge variant="warning" className="text-[10px]">
                          Limited preference data
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Course Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {profile.courses.map((c) => (
                      <Badge key={c.code} variant="mono">
                        {c.code}
                      </Badge>
                    ))}
                  </div>

                  {/* Match Grounding Explanations */}
                  {rec.aiMatchReasons && rec.aiMatchReasons.length > 0 && (
                    <div className="p-2.5 rounded bg-craft-surface border border-craft-border text-[11px] space-y-1">
                      <span className="font-semibold text-craft-subtle">Match Grounding:</span>
                      {rec.aiMatchReasons.map((reason, i) => (
                        <p key={i} className="text-craft-muted flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span>{reason}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-2 flex items-center justify-between border-t border-craft-border">
                  <Link to={`/app/study/${profile.userId}`}>
                    <Button variant="ghost" size="sm">
                      View Detail
                    </Button>
                  </Link>

                  <div className="flex items-center gap-1.5">
                    {isMutual ? (
                      <Badge variant="success">Connected Partner</Badge>
                    ) : isPending ? (
                      <Badge variant="ember">Liked (Pending)</Badge>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Hide partner permanently"
                          disabled={recordActionMutation.isPending}
                          onClick={() => handleAction(profile.userId, 'HIDE', profile.displayName)}
                          className="text-craft-muted hover:text-rose-400"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          title="Pass this round"
                          disabled={recordActionMutation.isPending}
                          onClick={() => handleAction(profile.userId, 'PASS', profile.displayName)}
                        >
                          <SkipForward className="w-3.5 h-3.5 mr-1" />
                          Pass
                        </Button>
                        <Button
                          variant="ember"
                          size="sm"
                          disabled={recordActionMutation.isPending}
                          onClick={() => handleAction(profile.userId, 'LIKE', profile.displayName)}
                        >
                          <Heart className="w-3.5 h-3.5 mr-1 fill-current" />
                          Like
                        </Button>
                      </>
                    )}
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* AI Agent Matcher Dialog */}
      <Dialog
        isOpen={isAgentDialogOpen}
        onClose={() => setIsAgentDialogOpen(false)}
        title="AI Study Matcher (Demo Simulator)"
        description="Submit an academic matching prompt to discover study partners grounded in course schedules and study habits. (Simulated demo mode - immediate return)."
        footer={
          <div className="flex justify-between w-full items-center text-[11px] text-craft-muted">
            <span>Agent has no booking or messaging authority; suggestions are informational only.</span>
            <Button variant="ghost" size="sm" onClick={() => setIsAgentDialogOpen(false)}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <form onSubmit={handleRunAgentMatcher} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-craft-subtle">Target Enrolled Course</label>
              <select
                value={agentCourseCode}
                onChange={(e) => setAgentCourseCode(e.target.value)}
                className="w-full py-1.5 px-2.5 text-xs rounded border border-craft-border bg-craft-surface text-craft-ink focus:outline-none focus:border-ember-500"
              >
                <option value="CS455">CS455 - Software Engineering</option>
                <option value="MTH101">MTH101 - Mathematics I</option>
                <option value="ESC102">ESC102 - Intro to Electronics</option>
                <option value="CS632">CS632 - Advanced Algorithms</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-craft-subtle">Matching Prompt / Focus</label>
              <input
                type="text"
                placeholder="e.g. Need peer for quiet afternoon problem solving sessions"
                value={agentPrompt}
                onChange={(e) => setAgentPrompt(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded border border-craft-border bg-craft-surface text-craft-ink focus:outline-none focus:border-ember-500"
              />
            </div>

            <Button
              type="submit"
              variant="ember"
              size="sm"
              disabled={submitAgentMutation.isPending}
              leftIcon={<Sparkles className="w-3.5 h-3.5" />}
            >
              {submitAgentMutation.isPending ? 'Simulating Agent Matching...' : 'Run Match Query'}
            </Button>
          </form>

          {/* Results Display */}
          {agentResults && (
            <div className="mt-4 p-4 rounded-lg bg-craft-surface border border-craft-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-craft-ink flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-ember-400" />
                  Simulated Agent Findings ({agentResults.status})
                </span>
                {agentResults.status === 'FALLBACK' ? (
                  <Badge variant="warning">Deterministic Fallback</Badge>
                ) : (
                  <Badge variant="mono">{agentResults.status}</Badge>
                )}
              </div>

              {agentResults.fallbackReason && (
                <p className="text-xs text-craft-muted leading-relaxed italic">
                  Notice: {agentResults.fallbackReason}
                </p>
              )}

              {/* Exact Matches (Enrolled in requested course) */}
              {agentResults.recommendations && agentResults.recommendations.length > 0 ? (
                <div className="space-y-2 pt-2 border-t border-craft-border">
                  <span className="text-xs font-semibold text-craft-subtle">
                    Course Matches ({agentCourseCode}):
                  </span>
                  <div className="space-y-2">
                    {agentResults.recommendations.map((cand) => (
                      <div
                        key={cand.profile.userId}
                        className="p-2.5 rounded bg-craft-bg border border-craft-border flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-craft-ink">{cand.profile.displayName}</p>
                            <Badge variant="success" className="text-[10px]">Enrolled in {agentCourseCode}</Badge>
                          </div>
                          <p className="text-[11px] text-craft-muted">
                            {cand.profile.department} · {cand.aiMatchScore}% Compatibility
                          </p>
                        </div>
                        <Link to={`/app/study/${cand.profile.userId}`}>
                          <Button variant="outline" size="sm">
                            View Profile
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              ) : agentResults.status === 'COMPLETED' ? (
                <div className="p-2.5 rounded bg-craft-bg/50 border border-dashed border-craft-border text-xs text-craft-muted">
                  No peer enrollments found for course <span className="font-mono text-ember-400 font-semibold">{agentCourseCode}</span>.
                </div>
              ) : null}

              {/* Broader Alternative Suggestions (Do NOT satisfy requested course, no green confirmation) */}
              {agentResults.suggestedAlternatives && agentResults.suggestedAlternatives.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-craft-border">
                  <div>
                    <span className="text-xs font-semibold text-amber-400">
                      Broader Alternative Suggestions (Course Filter Not Satisfied):
                    </span>
                    <p className="text-[11px] text-craft-muted mt-0.5">
                      Peers with overlapping availability or work style who are not enrolled in {agentCourseCode}.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {agentResults.suggestedAlternatives.map((cand) => (
                      <div
                        key={cand.profile.userId}
                        className="p-2.5 rounded bg-craft-bg border border-amber-500/30 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-craft-ink">{cand.profile.displayName}</p>
                            <Badge variant="warning" className="text-[10px]">Alternative Enrolled</Badge>
                          </div>
                          <p className="text-[11px] text-craft-muted">
                            Courses: {cand.profile.courses.map((c) => c.code).join(', ')} · {cand.aiMatchScore}% Overall Compatibility
                          </p>
                        </div>
                        <Link to={`/app/study/${cand.profile.userId}`}>
                          <Button variant="outline" size="sm">
                            View Profile
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
};

