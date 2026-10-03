import React from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { MOCK_SOCIAL_PEERS } from '@/mocks';

export const SocialConnectionsPage: React.FC = () => {
  const mutualPeers = MOCK_SOCIAL_PEERS.filter((p) => p.connectionStatus === 'MUTUAL_CONNECTED');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mutual Social Connections"
        subtitle="Peers who have mutually agreed to connect. Verified handles are unlocked."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Social Discovery', href: '/app/social' },
          { label: 'Connections', isCurrent: true },
        ]}
      />

      <Card variant="default">
        <CardHeader>
          <CardTitle>Active Mutual Connections</CardTitle>
          <CardDescription>Bilateral consent confirmed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {mutualPeers.map((peer) => (
            <div
              key={peer.id}
              className="p-4 rounded-lg bg-craft-surface border border-craft-border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-craft-ink">{peer.displayName}</span>
                  <Badge variant="success">Connected</Badge>
                </div>
                <p className="text-xs text-craft-muted mt-1">{peer.bio}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-craft-muted">Revealed Handle (Demo Fixture — DEC-08 Open):</span>
                  <span className="font-mono text-xs text-ember-400 font-semibold">
                    [{peer.revealedContact?.platform}] demo_{peer.revealedContact?.handle}
                  </span>
                </div>
              </div>

              <div>
                <Link to={`/app/social/${peer.id}`}>
                  <Button variant="outline" size="sm">
                    View Profile
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
