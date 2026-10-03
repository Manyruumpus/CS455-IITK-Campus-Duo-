import React, { useState } from 'react';
import { Calendar, Users, Shield } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

export const NotificationsPage: React.FC = () => {
  const { addToast } = useToast();
  const [notifications, setNotifications] = useState([
    {
      id: 'notif-1',
      title: 'Table Reservation Reminder',
      body: 'Your booking at PK Kelkar Library (Table T-10) begins in 30 minutes (16:00).',
      type: 'BOOKING',
      read: false,
      timestamp: '15 mins ago',
    },
    {
      id: 'notif-2',
      title: 'Study Partnership Request',
      body: 'Riya Sen invited you to collaborate on CS455 problem sets.',
      type: 'INVITE',
      read: false,
      timestamp: '2 hours ago',
    },
    {
      id: 'notif-3',
      title: 'Campus Maintenance Notice',
      body: 'Computer Centre CC-101 will undergo scheduled network maintenance on Sunday.',
      type: 'SYSTEM',
      read: true,
      timestamp: 'Yesterday',
    },
  ]);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    addToast({
      type: 'success',
      title: 'Notifications Cleared',
      description: 'All in-app alerts marked as read.',
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Notifications"
        subtitle="Stay updated on study requests, booking reminders, and administrative announcements."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Notifications', isCurrent: true },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            Mark All as Read
          </Button>
        }
      />

      <Card variant="default">
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
          <CardDescription>Filtered by urgency and category.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-craft-border/60">
          {notifications.map((item) => (
            <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                {item.type === 'BOOKING' && (
                  <div className="w-7 h-7 rounded bg-sky-900/30 text-sky-400 flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5" />
                  </div>
                )}
                {item.type === 'INVITE' && (
                  <div className="w-7 h-7 rounded bg-ember-900/30 text-ember-400 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                )}
                {item.type === 'SYSTEM' && (
                  <div className="w-7 h-7 rounded bg-zinc-800 text-zinc-300 flex items-center justify-center">
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold text-craft-ink">{item.title}</h4>
                    {!item.read && <Badge variant="ember" dot>New</Badge>}
                  </div>
                  <span className="text-[11px] text-craft-muted">{item.timestamp}</span>
                </div>
                <p className="text-xs text-craft-muted mt-0.5">{item.body}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
