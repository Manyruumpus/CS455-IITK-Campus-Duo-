import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  AlertCircle,
  Settings,
  ArrowRight,
  User,
  Clock,
  Check,
  X,
  Loader2,
  ShieldAlert,
  MessageSquare,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import {
  useConnectionSummaries,
  useConnectionCounts,
  useConnectionDetail,
  useReciprocateLike,
} from '@/queries/connectionHooks';
import { useToast } from '@/components/ui/Toast';
import { appConfig } from '@/config/features';
import { ConnectionViewBucket, ConnectionSummaryItem } from '@/types';

type Tab = ConnectionViewBucket | 'ALL';
const TABS: { key: Tab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'INCOMING', label: 'Incoming' },
  { key: 'OUTGOING', label: 'Outgoing' },
  { key: 'MUTUAL', label: 'Mutual' },
];

export const SocialConnectionsPage: React.FC = () => {
  const { session } = useDemoAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('ALL');
  const [detailConnectionId, setDetailConnectionId] = useState<string | null>(null);

  const summaries = useConnectionSummaries('SOCIAL', activeTab);
  const counts = useConnectionCounts('SOCIAL');
  const detail = useConnectionDetail(detailConnectionId ?? '');
  const reciprocate = useReciprocateLike();

  const data = summaries.data ?? [];
  const incomingCount = counts.data?.incoming ?? 0;
  const outgoingCount = counts.data?.outgoing ?? 0;
  const mutualCount = counts.data?.mutual ?? 0;

  const getTabCount = (tab: Tab): number => {
    if (tab === 'ALL') return counts.data ? incomingCount + outgoingCount + mutualCount : data.length;
    if (tab === 'INCOMING') return incomingCount;
    if (tab === 'OUTGOING') return outgoingCount;
    return mutualCount;
  };

  if (session && !session.hasSocialConsent) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Campus Social Connections"
          breadcrumbs={[
            { label: 'Dashboard', href: '/app/dashboard' },
            { label: 'Social Discovery', href: '/app/social' },
            { label: 'Connections', isCurrent: true },
          ]}
          actions={
            <Link to="/app/settings">
              <Button variant="ember" size="sm" leftIcon={<Settings className="w-3.5 h-3.5" />}>
                Privacy Settings
              </Button>
            </Link>
          }
        />
        <Card variant="craft">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="font-semibold text-sm">Social Consent Required</span>
            </div>
            <p className="text-xs text-craft-muted">
              Enable social discovery in Settings to view your connections.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="social-connections-page">
      <PageHeader
        title="Campus Social Connections"
        subtitle="Manage mutual connections and pending social interests derived from Like records."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Social Discovery', href: '/app/social' },
          { label: 'Connections', isCurrent: true },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/app/social">
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
        aria-label="Social connection views"
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`social-panel-${tab.key}`}
            id={`social-tab-${tab.key}`}
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

      <Card
        variant="default"
        id={`social-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`social-tab-${activeTab}`}
      >
        <CardHeader>
          <CardTitle>
            {activeTab === 'ALL'
              ? 'All Social Relationships'
              : activeTab === 'MUTUAL'
              ? 'Active Mutual Connections'
              : activeTab === 'INCOMING'
              ? 'Incoming Social Interests'
              : 'Sent Social Interests'}
          </CardTitle>
          <CardDescription>
            {activeTab === 'MUTUAL'
              ? 'Bilateral social interest confirmed. Messaging is disabled by project policy (DEC-08).'
              : activeTab === 'ALL'
              ? 'Mutual connections and one-sided social interests. Decline/Withdrawal/Disconnect are not implemented; only reciprocal LIKE forms a confirmed relationship.'
              : activeTab === 'INCOMING'
              ? 'Peers who have liked your public social profile.'
              : 'Social peers you have liked. Awaiting reciprocal interest.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {summaries.isLoading && <LoadingSkeleton lines={3} />}

          {summaries.error && !summaries.isLoading && (
              <ErrorState
                title={summaries.error.code === 'FORBIDDEN' ? 'Social Consent Required' : 'Service Unavailable'}
                message={summaries.error.message}
              />
          )}

          {!summaries.isLoading && !summaries.error && data.length === 0 && (
            <EmptyState
              title="No social relationships in this view"
              description={
                activeTab === 'MUTUAL'
                  ? 'No mutual connections yet. Explore Social Discovery and Like peers you are interested in.'
                  : activeTab === 'INCOMING'
                  ? 'No incoming social interests yet.'
                  : activeTab === 'OUTGOING'
                  ? 'You have not sent any outgoing social interests yet.'
                  : 'No activity yet. Start from Social Discovery.'
              }
              action={
                <Link to="/app/social">
                  <Button variant="ember" size="sm" rightIcon={<ArrowRight className="w-3 h-3" />}>
                    Explore Social Peers
                  </Button>
                </Link>
              }
            />
          )}

          {!summaries.isLoading &&
            !summaries.error &&
            data.map((item) => (
              <ConnectionCard
                key={item.connectionId}
                item={item}
                onAccept={() =>
                  reciprocate.mutate({
                    mode: 'SOCIAL',
                    targetStudentId: item.peerId,
                    candidateName: item.peerDisplayName,
                  })
                }
                onUnavailable={() =>
                  addToast({
                    type: 'info',
                    title: 'Action Unavailable',
                    description:
                      'Decline/Withdrawal/Disconnect is not implemented under the current demo policy. A confirmed relationship requires reciprocal LIKE.',
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
            <span className="text-xs">Social action completed. Lists and detail views refreshed.</span>
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
      One-sided Like lists (Incoming / Outgoing) are visible in this demo only. SOCIAL-only connections
      never enable study-booking eligibility. Messaging is{' '}
      <Badge variant="mono">
        {appConfig.isMessagingEnabled ? 'Preview (Mock)' : 'Disabled by default (DEC-08)'}
      </Badge>
      ; production messaging policy and handle-exchange decisions are still unresolved.
    </p>
  </div>
);

type ItemType = ConnectionSummaryItem;

interface ConnectionCardProps {
  item: ItemType;
  isIncoming?: boolean;
  onAccept?: () => void;
  onUnavailable: () => void;
  onViewDetail: () => void;
  acceptPending: boolean;
}

const ConnectionCard: React.FC<ConnectionCardProps> = ({
  item,
  onAccept,
  onUnavailable,
  onViewDetail,
  acceptPending,
}) => {
  const isMutual = item.bucket === 'MUTUAL';
  const isIncoming = item.bucket === 'INCOMING';
  return (
    <div
      className="p-4 rounded-lg bg-craft-surface border border-craft-border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      data-testid={`social-row-${item.peerId}`}
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <User className="w-4 h-4 text-craft-muted" />
          <span className="font-semibold text-xs text-craft-ink truncate">{item.peerDisplayName}</span>
          <Badge variant="mono">SOCIAL</Badge>
          {isMutual ? (
            <Badge variant="success">Connected</Badge>
          ) : (
            <Badge variant={isIncoming ? 'warning' : 'outline'}>
              {isIncoming ? 'Pending Received' : 'Pending Sent'}
            </Badge>
          )}
          <span className="text-[11px] text-craft-muted flex items-center gap-1 ml-auto sm:ml-0">
            <Clock className="w-3 h-3" /> {new Date(item.updatedAt).toLocaleDateString()}
          </span>
        </div>
        <p className="text-xs text-craft-muted mt-1 line-clamp-2">{item.peerBio ?? 'No public bio available.'}</p>
        {item.peerInterests.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {item.peerInterests.slice(0, 5).map((i: {id: string; name: string}) => (
              <Badge key={i.id} variant="outline">
                {i.name}
              </Badge>
            ))}
          </div>
        )}
        {item.isRestricted && (
          <p className="text-[10px] text-amber-400 font-medium">
            Restricted: relationship access is {item.restrictedReason ?? 'pending policy'} — private data not exposed.
          </p>
        )}

        {isMutual && (
          <div className="mt-2 p-2 rounded bg-craft-bg border border-craft-border text-xs space-y-1">
            <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3" />
              Privacy Protection:
            </span>
            <span className="text-[11px] text-craft-muted block">
              Messaging is currently disabled by project policy (DEC-08). No contact handles disclosed.
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={onViewDetail}
          rightIcon={<ArrowRight className="w-3 h-3" />}
        >
          Detail
        </Button>
        {!isMutual && (
          <Button
            variant="outline"
            size="sm"
            onClick={onUnavailable}
            leftIcon={<X className="w-3.5 h-3.5" />}
          >
            {isIncoming ? 'Decline' : 'Withdraw'}
          </Button>
        )}
        {!isMutual && isIncoming && onAccept && (
          <Button
            variant="ember"
            size="sm"
            onClick={onAccept}
            leftIcon={acceptPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            disabled={acceptPending}
            aria-label={`Accept social request from ${item.peerDisplayName}`}
          >
            Like Back
          </Button>
        )}
        {isMutual && (
          <Link to={`/app/social/${item.peerId}`}>
            <Button variant="outline" size="sm" aria-label={`Open social profile for ${item.peerDisplayName}`}>
              Social Profile
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
  // Booking eligibility for SOCIAL must never be true; enforce even if upstream changes
  const safeBookingEligible = detail.isStudyBookingEligible && detail.mode === 'STUDY';
  return (
    <Card variant="craft" data-testid="social-connection-detail">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Authorized Social Connection Detail</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close social connection detail">
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
        {error && <ErrorState title="Detail Unavailable" message={error} />}
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
              {detail.isRestricted && (
                <Badge variant="warning">Restricted {detail.restrictedReason ?? ''}</Badge>
              )}
              {safeBookingEligible && <Badge variant="ember">Booking Eligible</Badge>}
              {!safeBookingEligible && detail.relationshipStatus === 'MUTUAL_CONNECTED' && detail.mode === 'SOCIAL' && (
                <Badge variant="outline">Not Booking Eligible (Social Only)</Badge>
              )}
            </div>
            <p className="text-[11px] text-craft-muted">
              Bio: {detail.peerBio ?? 'No public bio available.'}
            </p>
            {detail.peerInterests.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {detail.peerInterests.map((i: {id: string; name: string}) => (
                  <Badge key={i.id} variant="outline">
                    {i.name}
                  </Badge>
                ))}
              </div>
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
            <div className="p-2 rounded bg-craft-bg border border-craft-border space-y-1">
              <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" /> Messaging Policy (DEC-08)
              </p>
              <p className="text-[11px] text-craft-muted">
                Messaging is disabled by default. No contact handles are revealed. Whether two modes share
                a conversation is an unresolved demo policy decision, not production behavior.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-2 flex-wrap">
              <Link to={`/app/social/${detail.peerId}`}>
                <Button variant="outline" size="sm">
                  Open Social Profile
                </Button>
              </Link>
              {detail.mode === 'SOCIAL' && (
                <span className="text-[11px] text-craft-muted">
                  SOCIAL connections do not enable study-booking eligibility.
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
