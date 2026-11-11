import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  X,
  Clock,
  User,
  AlertCircle,
  Loader2,
  ArrowRight,
  Calendar,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { useToast } from '@/components/ui/Toast';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import {
  useConnectionSummaries,
  useConnectionCounts,
  useConnectionDetail,
  useReciprocateLike,
} from '@/queries/connectionHooks';
import { ConnectionSummaryItem, ConnectionViewBucket } from '@/types';

type Tab = ConnectionViewBucket | 'ALL';
const TABS: { key: Tab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'INCOMING', label: 'Incoming' },
  { key: 'OUTGOING', label: 'Outgoing' },
  { key: 'MUTUAL', label: 'Mutual' },
];

export const StudyRequestsPage: React.FC = () => {
  const { session } = useDemoAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('ALL');
  const [detailConnectionId, setDetailConnectionId] = useState<string | null>(null);

  const summaries = useConnectionSummaries('STUDY', activeTab);
  const counts = useConnectionCounts('STUDY');
  const detail = useConnectionDetail(detailConnectionId ?? '');
  const reciprocate = useReciprocateLike();

  const data = summaries.data ?? [];
  const incomingCount = counts.data?.incoming ?? 0;
  const outgoingCount = counts.data?.outgoing ?? 0;
  const mutualCount = counts.data?.mutual ?? 0;

  const getTabCount = (tab: Tab): number => {
    if (tab === 'ALL') return (counts.data ? incomingCount + outgoingCount + mutualCount : data.length);
    if (tab === 'INCOMING') return incomingCount;
    if (tab === 'OUTGOING') return outgoingCount;
    return mutualCount;
  };

  if (session && !session.hasStudyConsent) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Study Partnership Requests"
          subtitle="Study consent is required to view study connections."
          breadcrumbs={[
            { label: 'Dashboard', href: '/app/dashboard' },
            { label: 'Study Matching', href: '/app/study' },
            { label: 'Requests', isCurrent: true },
          ]}
          actions={
            <Link to="/app/settings">
              <Button variant="ember" size="sm" leftIcon={<Settings className="w-3.5 h-3.5" />}>
                Privacy Settings
              </Button>
            </Link>
          }
        />
        <ErrorState
          title="Study Consent Required"
          message="Enable Study Matching in Privacy Settings to view and manage your study partnership requests."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="study-requests-page">
      <PageHeader
        title="Study Partnership Requests"
        subtitle="Outgoing, incoming, and mutual study partnership states derived from Like records."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Study Matching', href: '/app/study' },
          { label: 'Requests & Connections', isCurrent: true },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/app/study">
              <Button variant="outline" size="sm">
                Back to Discovery
              </Button>
            </Link>
          </div>
        }
      />

      <DemoPolicyNotice />

      <div
        className="flex flex-wrap items-center gap-2 p-1 bg-craft-surface border border-craft-border rounded-lg w-fit"
        role="tablist"
        aria-label="Study connection views"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`panel-${tab.key}`}
            id={`tab-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-craft-bg text-craft-ink shadow-sm ring-1 ring-craft-border'
                : 'text-craft-muted hover:text-craft-ink'
            }`}
          >
            {tab.label}
            {counts.isSuccess ? ` (${getTabCount(tab.key)})` : ''}
          </button>
        ))}
      </div>

      {detailConnectionId && detail.data ? (
        <ConnectionDetailPanel
          detail={detail.data}
          onClose={() => setDetailConnectionId(null)}
          loading={detail.isFetching}
          error={detail.error?.message}
        />
      ) : detailConnectionId ? (
        <Card variant="craft">
          <CardContent className="p-6 space-y-2">
            {detail.isLoading && <LoadingSkeleton lines={3} />}
            {detail.error && (
              <ErrorState
                title={
                  detail.error.code === 'FORBIDDEN'
                    ? 'Access Forbidden'
                    : detail.error.code === 'NOT_FOUND'
                    ? 'Connection Not Found'
                    : 'Unavailable'
                }
                message={detail.error.message}
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card variant="default" id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        <CardHeader>
          <CardTitle>
            {activeTab === 'ALL'
              ? 'All Study Relationships'
              : activeTab === 'INCOMING'
              ? 'Incoming Study Requests'
              : activeTab === 'OUTGOING'
              ? 'Sent Study Requests'
              : 'Active Mutual Study Connections'}
          </CardTitle>
          <CardDescription>
            {activeTab === 'ALL'
              ? 'Requests, pending states and confirmed partnerships. Decline/Withdrawal is not implemented in current demo policy.'
              : activeTab === 'INCOMING'
              ? 'Peers who have liked your study profile. Use Like Back to confirm mutual partnership.'
              : activeTab === 'OUTGOING'
              ? 'Peers you have liked. Awaiting reciprocal interest.'
              : 'Mutual study partners. Booking navigation is available for eligible mutual STUDY connections only.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {summaries.isLoading && <LoadingSkeleton lines={3} />}

          {summaries.error && !summaries.isLoading && (
            <ErrorState
              title={
                summaries.error.code === 'FORBIDDEN'
                  ? 'Study Consent Required'
                  : 'Service Unavailable'
              }
              message={summaries.error.message}
            />
          )}

          {!summaries.isLoading && !summaries.error && data.length === 0 && (
            <EmptyState
              title="No study requests in this view"
              description={
                activeTab === 'MUTUAL'
                  ? 'No mutual study partnerships yet. Explore the Study Discovery feed and Like potential partners.'
                  : activeTab === 'INCOMING'
                  ? 'No incoming study requests yet.'
                  : activeTab === 'OUTGOING'
                  ? 'You have not sent any outgoing study requests yet.'
                  : 'No request or connection activity. Start with Study Discovery.'
              }
              action={
                <Link to="/app/study">
                  <Button variant="ember" size="sm" rightIcon={<ArrowRight className="w-3 h-3" />}>
                    Open Study Discovery
                  </Button>
                </Link>
              }
            />
          )}

          {!summaries.isLoading &&
            !summaries.error &&
            data.map((item) => (
              <SummaryCard
                key={item.connectionId}
                item={item}
                onAccept={() => {
                  reciprocate.mutate(
                    { mode: 'STUDY', targetStudentId: item.peerId, candidateName: item.peerDisplayName },
                    {
                      onError: () => {
                        // reciprocate hook already shows error toast
                      },
                    }
                  );
                }}
                onUnavailable={() =>
                  addToast({
                    type: 'info',
                    title: 'Action Unavailable',
                    description:
                      'Decline/Withdrawal/Disconnect is not implemented under the current demo policy. Reciprocal LIKE is required for a confirmed connection.',
                  })
                }
                onViewDetail={() => setDetailConnectionId(item.connectionId)}
                acceptPending={reciprocate.isPending}
              />
            ))}
        </CardContent>
      </Card>

      {reciprocate.isError && (
        <Card variant="craft">
          <CardContent className="p-4 flex items-center gap-2 text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-xs">{reciprocate.error.message}</span>
          </CardContent>
        </Card>
      )}
      {reciprocate.isSuccess && (
        <Card variant="craft">
          <CardContent className="p-4 flex items-center gap-2 text-emerald-400">
            <Check className="w-4 h-4 shrink-0" />
            <span className="text-xs">Study action completed. Lists and detail views have been refreshed.</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const DemoPolicyNotice: React.FC = () => (
  <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-950/10 text-[11px] leading-relaxed space-y-1">
    <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
      <ShieldAlert className="w-3.5 h-3.5" />
      Demo-visible policy — not an approved production rule
    </div>
    <p className="text-craft-muted">
      One-sided Like lists (Incoming / Outgoing) are visible in this demo only. Production visibility,
      withdrawal, disconnect and post-opt-out retention policies are still unresolved. Mutual STUDY
      connections are the only relationships eligible for booking workflows.
    </p>
  </div>
);

interface SummaryCardProps {
  item: ConnectionSummaryItem;
  onAccept: () => void;
  onUnavailable: () => void;
  onViewDetail: () => void;
  acceptPending: boolean;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  item,
  onAccept,
  onUnavailable,
  onViewDetail,
  acceptPending,
}) => {
  const isIncoming = item.bucket === 'INCOMING';
  const isMutual = item.bucket === 'MUTUAL';
  return (
    <div
      className="p-4 rounded-lg bg-craft-surface border border-craft-border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      data-testid={`study-row-${item.peerId}`}
    >
      <div className="space-y-1.5 flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <User className="w-4 h-4 text-craft-muted" />
          <span className="font-semibold text-xs text-craft-ink truncate">{item.peerDisplayName}</span>
          <Badge variant="mono">STUDY</Badge>
          <Badge
            variant={
              isMutual ? 'success' : item.bucket === 'INCOMING' ? 'warning' : 'outline'
            }
          >
            {item.bucket === 'MUTUAL'
              ? 'Mutual Connected'
              : item.bucket === 'INCOMING'
              ? 'Pending Received'
              : 'Pending Sent'}
          </Badge>
          <span className="text-[11px] text-craft-muted flex items-center gap-1 ml-auto sm:ml-0">
            <Clock className="w-3 h-3" /> {new Date(item.updatedAt).toLocaleDateString()}
          </span>
        </div>
        {item.peerDepartment && (
          <p className="text-[11px] text-craft-muted">
            {item.peerDepartment} · {item.peerDegree} · Year {item.peerYear}
          </p>
        )}
        {item.peerCourses.length > 0 && (
          <p className="text-[11px] text-craft-muted">
            Courses: {item.peerCourses.slice(0, 4).map((c: {code: string}) => c.code).join(', ')}
          </p>
        )}
        {item.note && <p className="text-[11px] text-craft-muted italic">“{item.note}”</p>}
        {item.isRestricted && (
          <p className="text-[10px] text-amber-400 font-medium">
            Restricted: relationship access is {item.restrictedReason ?? 'pending policy'} — private data not exposed.
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={onViewDetail} rightIcon={<ArrowRight className="w-3 h-3" />}>
          Detail
        </Button>
        {!isMutual && !isIncoming && (
          <Button
            variant="outline"
            size="sm"
            onClick={onUnavailable}
            leftIcon={<X className="w-3.5 h-3.5" />}
          >
            Withdraw
          </Button>
        )}
        {!isMutual && isIncoming && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onUnavailable}
              leftIcon={<X className="w-3.5 h-3.5" />}
            >
              Decline
            </Button>
            <Button
              variant="ember"
              size="sm"
              onClick={onAccept}
              leftIcon={acceptPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              disabled={acceptPending}
              aria-label={`Accept study request from ${item.peerDisplayName}`}
            >
              Accept (Like Back)
            </Button>
          </>
        )}
        {isMutual && item.isStudyBookingEligible && (
          <Link
            to="/app/booking/new"
            aria-label={`New booking with ${item.peerDisplayName}`}
          >
            <Button variant="ember" size="sm" leftIcon={<Calendar className="w-3.5 h-3.5" />}>
              Book Study Table
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
};

interface DetailPanelProps {
  detail: ReturnType<typeof useConnectionDetail>['data'];
  onClose: () => void;
  loading: boolean;
  error?: string;
}

const ConnectionDetailPanel: React.FC<DetailPanelProps> = ({ detail, onClose, loading, error }) => {
  if (!detail) return null;
  return (
    <Card variant="craft" data-testid="study-connection-detail">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Authorized Study Connection Detail</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close study connection detail">
            Close
          </Button>
        </div>
        <CardDescription>
          {detail.visibilityPolicy === 'ONE_SIDED_VISIBLE_DEMO'
            ? 'Visible as a demo-only policy. Production visibility rules are pending approval.'
            : 'Mutual-only visibility.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <LoadingSkeleton lines={4} />}
        {error && (
          <ErrorState title="Detail Unavailable" message={error} />
        )}
        {!loading && !error && (
          <div className="space-y-2 text-xs text-craft-ink">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-sm">{detail.peerDisplayName}</span>
              <Badge variant="mono">{detail.mode}</Badge>
              <Badge
                variant={
                  detail.relationshipStatus === 'MUTUAL_CONNECTED'
                    ? 'success'
                    : detail.relationshipStatus === 'PENDING_RECEIVED'
                    ? 'warning'
                    : 'outline'
                }
              >
                {detail.relationshipStatus.replace(/_/g, ' ')}
              </Badge>
              {detail.isStudyBookingEligible && <Badge variant="ember">Booking Eligible</Badge>}
              {detail.isRestricted && (
                <Badge variant="warning">Restricted {detail.restrictedReason ?? ''}</Badge>
              )}
            </div>
            {detail.peerDepartment && (
              <p className="text-[11px] text-craft-muted">
                {detail.peerDepartment} · {detail.peerDegree} · Year {detail.peerYear}
              </p>
            )}
            {detail.peerCourses.length > 0 && (
              <p className="text-[11px] text-craft-muted">
                Courses: {detail.peerCourses.map((c: {code: string; name: string}) => `${c.code} (${c.name})`).join(', ')}
              </p>
            )}
            <p className="text-[11px] text-craft-muted">
              Created: {new Date(detail.createdAt).toLocaleString()} · Updated:{' '}
              {new Date(detail.updatedAt).toLocaleString()}
            </p>
            {detail.note && (
              <p className="text-[11px] italic text-craft-muted border border-craft-border rounded p-2 bg-craft-bg">
                Note: {detail.note}
              </p>
            )}
            <div className="pt-2 flex items-center gap-2 flex-wrap">
              <Link to={`/app/study/${detail.peerId}`}>
                <Button variant="outline" size="sm">
                  Open Study Profile
                </Button>
              </Link>
              {detail.isStudyBookingEligible && (
                <Link to="/app/booking/new">
                  <Button
                    variant="ember"
                    size="sm"
                    leftIcon={<Calendar className="w-3.5 h-3.5" />}
                  >
                    New Booking
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
