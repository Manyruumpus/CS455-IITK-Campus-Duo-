import React from 'react';
import { MessageSquare, AlertCircle, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { appConfig } from '@/config/features';

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
        badge={<Badge variant="warning">Disabled by Default (DEC-08)</Badge>}
      />

      <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-950/20 text-xs text-amber-300 space-y-2">
        <div className="flex items-center gap-2 font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Architectural Decision DEC-08: Messaging Default & Deferred Preview</span>
        </div>
        <p className="text-craft-muted leading-relaxed">
          Messaging is disabled by default. The conversation route is only registered when the
          environment flag <Badge variant="mono">VITE_ENABLE_MESSAGING</Badge> is explicitly true.
          In the current build the flag evaluates to{' '}
          <Badge variant={appConfig.isMessagingEnabled ? 'success' : 'mono'}>
            {appConfig.isMessagingEnabled ? 'true' : 'false'}
          </Badge>
          .
        </p>
      </div>

      <Card variant="default">
        <CardHeader>
          <CardTitle>Conversation Threads — Deferred / Not Implemented</CardTitle>
          <CardDescription>
            Messaging has not been approved as enabled project functionality. A simulated in-memory
            preview is intentionally not built in Stage 07 to preserve scope boundaries; the
            bounded membership-aware chat surface may be added later only when the demo rule for
            mode sharing is explicitly approved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-8 text-center text-xs text-craft-muted border border-dashed border-craft-border rounded-lg space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto text-craft-subtle" />
            <p className="font-medium text-craft-ink">Messaging deferred — no preview active</p>
            <p>
              No contact handles are disclosed. No delivery, WebSocket, or realtime claims are
              made.
            </p>
            <div className="mt-3 pt-3 border-t border-craft-border inline-flex items-center gap-1.5 text-[11px] text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              Membership and handle boundaries will be enforced if this feature is approved.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
