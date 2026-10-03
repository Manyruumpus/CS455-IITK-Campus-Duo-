import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MOCK_SOCIAL_PEERS } from '@/mocks';

export const SocialDetailPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const peer = MOCK_SOCIAL_PEERS.find((p) => p.id === studentId) || MOCK_SOCIAL_PEERS[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={peer.displayName}
        subtitle="Campus Social Profile (Clubs & Activities)"
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Social Discovery', href: '/app/social' },
          { label: peer.displayName, isCurrent: true },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/app/social">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Feed
              </Button>
            </Link>
            <Button variant="ember" size="sm">
              Connect Peer
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card variant="default">
            <CardHeader>
              <CardTitle>About & Bio</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-craft-ink leading-relaxed">{peer.bio}</p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader>
              <CardTitle>Campus Activity & Interest Tags</CardTitle>
              <CardDescription>Curated extracurricular interest markers.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {peer.interests.map((interest) => (
                  <Badge key={interest.id} variant="default" className="py-1 px-2.5 text-xs">
                    {interest.name} ({interest.category.replace('_', ' ')})
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card variant="craft">
            <CardHeader>
              <CardTitle className="text-sm">Privacy & Handle State</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="p-3 rounded bg-craft-surface border border-craft-border space-y-1.5">
                <span className="text-craft-muted">Contact Handle:</span>
                <p className="font-mono font-semibold text-craft-ink">
                  {peer.revealedContact ? `${peer.revealedContact.platform}: ${peer.revealedContact.handle}` : peer.maskedHandle}
                </p>
                <p className="text-[10px] text-craft-subtle">
                  Handles are masked until mutual connection acceptance.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
