import React from 'react';
import { MessageSquare, AlertCircle, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export const ConversationsPage: React.FC = () => {
  return (
    <div className="space-y-6" data-testid="conversations-page">
      <PageHeader
        title="Direct Conversations"
        subtitle="Peer-to-peer messaging boundary for confirmed mutual connections."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Conversations', isCurrent: true },
        ]}
        badge={<Badge variant="warning">Currently unavailable</Badge>}
      />

      <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/20 text-xs text-amber-300 space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Messaging is not available yet</span>
        </div>
        <p className="text-craft-muted leading-relaxed">
          Messaging is being kept separate from discovery and reservations. You can still manage
          your study and social connections without sharing contact details.
        </p>
      </div>

      <Card variant="default">
        <CardHeader>
          <CardTitle>Conversation threads</CardTitle>
          <CardDescription>
            Conversation threads are not available in this release. Your connections and reservations
            remain available from the navigation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-8 text-center text-xs text-craft-muted border border-dashed border-craft-border rounded-lg space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto text-craft-subtle" />
            <p className="font-medium text-craft-ink">Messaging is unavailable</p>
            <p>
              No contact handles are disclosed.
            </p>
            <div className="mt-3 pt-3 border-t border-craft-border inline-flex items-center gap-1.5 text-[11px] text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              Your privacy settings continue to apply to every connection.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
