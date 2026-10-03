import React, { useState } from 'react';
import { Check, X, Clock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';

export const StudyRequestsPage: React.FC = () => {
  const { addToast } = useToast();
  const [requests, setRequests] = useState([
    {
      id: 'req-01',
      studentName: 'Riya Sen',
      courseCode: 'CS455',
      note: 'Hey! Looking for a problem-solving partner for the upcoming networks lab assignments.',
      timestamp: '2 hours ago',
    },
  ]);

  const handleAccept = (id: string, name: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    addToast({
      type: 'success',
      title: 'Study Partnership Accepted',
      description: `You are now connected with ${name} for shared study table booking.`,
    });
  };

  const handleDecline = (id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    addToast({
      type: 'info',
      title: 'Request Declined',
      description: 'The invitation has been removed.',
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Study Partnership Requests"
        subtitle="Manage incoming and outgoing study collaboration invitations."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Study Matching', href: '/app/study' },
          { label: 'Requests', isCurrent: true },
        ]}
      />

      <Card variant="default">
        <CardHeader>
          <CardTitle>Incoming Study Invitations</CardTitle>
          <CardDescription>Peers who requested to collaborate with you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.length === 0 ? (
            <p className="text-xs text-craft-muted py-6 text-center">
              No pending study requests at this time.
            </p>
          ) : (
            requests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-lg bg-craft-surface border border-craft-border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-craft-ink">{req.studentName}</span>
                    <Badge variant="mono">{req.courseCode}</Badge>
                    <span className="text-[11px] text-craft-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {req.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-craft-muted">{req.note}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDecline(req.id)}
                    leftIcon={<X className="w-3.5 h-3.5" />}
                  >
                    Decline
                  </Button>
                  <Button
                    variant="ember"
                    size="sm"
                    onClick={() => handleAccept(req.id, req.studentName)}
                    leftIcon={<Check className="w-3.5 h-3.5" />}
                  >
                    Accept
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
