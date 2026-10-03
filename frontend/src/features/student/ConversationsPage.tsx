import React from 'react';
import { MessageSquare, AlertCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export const ConversationsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Direct Conversations"
        subtitle="Peer-to-peer messaging for confirmed study partners and mutual social connections."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Conversations', isCurrent: true },
        ]}
        badge={<Badge variant="warning">Feature Flagged (DEC-08)</Badge>}
      />

      {/* Feature Flag Notice Card */}
      <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/20 text-xs text-amber-300 space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Architectural Decision DEC-08: In-App Chat vs Handle Exchange</span>
        </div>
        <p className="text-craft-muted leading-relaxed">
          Full persistent web-socket chat is currently subject to open decision DEC-08. Campus Duo is evaluating whether bilateral connection should reveal verified student contact handles (e.g. Telegram, IITK email) versus maintaining in-app chat infrastructure.
        </p>
      </div>

      <Card variant="default">
        <CardHeader>
          <CardTitle>Conversation Threads Placeholder</CardTitle>
          <CardDescription>
            Simulated message thread container. No unapproved chat infrastructure is active.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-8 text-center text-xs text-craft-muted border border-dashed border-craft-border rounded-lg space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto text-craft-subtle" />
            <p className="font-medium text-craft-ink">Messaging is provisionally deferred</p>
            <p>Once mutual connection is confirmed, verified handles are revealed on the connections page.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
