import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Flag, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMarkNotificationUnread,
  useNotifications,
} from '@/queries/notificationHooks';
import { NotificationMode, NotificationItem } from '@/types';

const filters: Array<{ value: NotificationMode | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'BOOKING', label: 'Bookings' },
  { value: 'STUDY', label: 'Study' },
  { value: 'SOCIAL', label: 'Social' },
  { value: 'MODERATION', label: 'Reports' },
];

function destinationFor(notification: NotificationItem): string | null {
  if (!notification.destination) return null;
  if (notification.destination.kind === 'BOOKING') {
    return `/app/booking/${notification.destination.bookingId}`;
  }
  if (notification.destination.kind === 'REPORT') return '/app/settings';
  if (notification.destination.kind === 'CONNECTION') return '/app/study/requests';
  return '/app/settings';
}

function iconFor(notification: NotificationItem) {
  if (notification.type === 'BOOKING') return <Calendar className="w-3.5 h-3.5" />;
  if (notification.type === 'MODERATION') return <Flag className="w-3.5 h-3.5" />;
  return <Users className="w-3.5 h-3.5" />;
}

export const NotificationsPage: React.FC = () => {
  const [filter, setFilter] = useState<NotificationMode | 'ALL'>('ALL');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const query = useNotifications({ type: filter, unreadOnly });
  const markRead = useMarkNotificationRead();
  const markUnread = useMarkNotificationUnread();
  const markAll = useMarkAllNotificationsRead();

  const unreadCount = useMemo(
    () => query.data?.filter((notification) => !notification.isRead).length ?? 0,
    [query.data]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Notifications"
        subtitle="Simulated in-memory alerts from committed demo service operations."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Notifications', isCurrent: true },
        ]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => markAll.mutate(undefined)}
            disabled={markAll.isPending || unreadCount === 0}
            isLoading={markAll.isPending}
          >
            Mark All as Read
          </Button>
        }
      />

      <div role="tablist" aria-label="Notification filters" className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.value}
            role="tab"
            aria-selected={filter === item.value}
            onClick={() => setFilter(item.value)}
            className={`px-3 py-1.5 rounded-md text-xs border ${
              filter === item.value
                ? 'border-ember-500 bg-ember-950/30 text-ember-200'
                : 'border-craft-border text-craft-muted'
            }`}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setUnreadOnly((value) => !value)}
          aria-pressed={unreadOnly}
          className="px-3 py-1.5 rounded-md text-xs border border-craft-border text-craft-muted"
        >
          Unread only
        </button>
      </div>

      <Card variant="default">
        <CardHeader>
          <CardTitle>Recent Alerts {unreadCount > 0 && <Badge variant="ember">{unreadCount} unread</Badge>}</CardTitle>
          <CardDescription>Destinations are rechecked by the target service; restricted records never open directly.</CardDescription>
        </CardHeader>
        <CardContent aria-live="polite" className="divide-y divide-craft-border/60">
          {query.isLoading && <p className="py-6 text-sm text-craft-muted">Loading notifications...</p>}
          {query.isError && (
            <p role="alert" className="py-6 text-sm text-red-300">
              {query.error.message}
            </p>
          )}
          {!query.isLoading && !query.isError && query.data?.length === 0 && (
            <p className="py-6 text-sm text-craft-muted">No notifications match this view.</p>
          )}
          {query.data?.map((item) => {
            const destination = destinationFor(item);
            const action = item.isRead ? () => markUnread.mutate(item.id) : () => markRead.mutate(item.id);
            return (
              <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3">
                <div className="w-7 h-7 rounded bg-ember-900/30 text-ember-400 flex items-center justify-center shrink-0">
                  {iconFor(item)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold text-craft-ink">{item.title}</h4>
                      {!item.isRead && <Badge variant="ember" dot>New</Badge>}
                    </div>
                    <time className="text-[11px] text-craft-muted whitespace-nowrap" dateTime={item.timestamp}>
                      {new Date(item.timestamp).toLocaleString()}
                    </time>
                  </div>
                  <p className="text-xs text-craft-muted mt-0.5">{item.body}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {destination ? (
                      <Link
                        to={destination}
                        onClick={() => {
                          if (!item.isRead) markRead.mutate(item.id);
                        }}
                        className="text-[11px] text-ember-300 hover:underline"
                      >
                        Open approved destination
                      </Link>
                    ) : (
                      <span className="text-[11px] text-craft-subtle">Restricted destination</span>
                    )}
                    <button type="button" onClick={action} className="text-[11px] text-craft-muted hover:text-craft-ink">
                      {item.isRead ? 'Mark unread' : 'Mark read'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};
