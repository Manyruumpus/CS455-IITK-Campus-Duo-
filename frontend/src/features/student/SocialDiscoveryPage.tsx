import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, Lock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { MOCK_SOCIAL_PEERS } from '@/mocks';

export const SocialDiscoveryPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const { addToast } = useToast();

  const categories = [
    { id: 'ALL', label: 'All Categories' },
    { id: 'TECH_ACADEMIC', label: 'Tech & Academic' },
    { id: 'CULTURAL_ARTS', label: 'Cultural & Arts' },
    { id: 'SPORTS_FITNESS', label: 'Sports & Fitness' },
    { id: 'CAMPUS_LIFE', label: 'Campus Life' },
  ];

  const handleConnect = (peerName: string) => {
    addToast({
      type: 'success',
      title: 'Connection Request Sent',
      description: `Sent invitation to ${peerName}. Handles will be revealed upon mutual acceptance.`,
    });
  };

  const filteredPeers = MOCK_SOCIAL_PEERS.filter((p) => {
    const matchesSearch =
      p.displayName.toLowerCase().includes(search.toLowerCase()) ||
      p.bio.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === 'ALL' ||
      p.interests.some((i) => i.category === selectedCategory);
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campus Social Connections"
        subtitle="Explore peer connections based strictly on shared campus activities, clubs, sports, and hobbies."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Social Discovery', isCurrent: true },
        ]}
        actions={
          <Link to="/app/social/connections">
            <Button variant="outline" size="sm">
              Mutual Connections
            </Button>
          </Link>
        }
      />

      <FilterBar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter peers by hobby, club, or sport tag..."
        options={categories}
        selectedOption={selectedCategory}
        onOptionSelect={setSelectedCategory}
        onClearFilters={() => {
          setSearch('');
          setSelectedCategory('ALL');
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPeers.map((peer) => (
          <Card key={peer.id} variant="default" className="flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">
                    <Link to={`/app/social/${peer.id}`} className="hover:text-ember-400 transition-colors">
                      {peer.displayName}
                    </Link>
                  </CardTitle>
                  <CardDescription className="line-clamp-2 mt-1">{peer.bio}</CardDescription>
                </div>
                <Badge variant={peer.connectionStatus === 'MUTUAL_CONNECTED' ? 'success' : 'outline'}>
                  {peer.connectionStatus === 'MUTUAL_CONNECTED' ? 'Connected' : 'Peer'}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {peer.interests.map((interest) => (
                  <Badge key={interest.id} variant="default">
                    {interest.name}
                  </Badge>
                ))}
              </div>

              <div className="p-2.5 rounded bg-craft-surface border border-craft-border text-[11px] flex items-center justify-between text-craft-muted">
                <span className="flex items-center gap-1.5">
                  <Lock className="w-3 h-3 text-craft-subtle" />
                  <span>Contact Handle:</span>
                </span>
                <span className="font-mono text-craft-ink">
                  {peer.revealedContact ? `${peer.revealedContact.platform}: ${peer.revealedContact.handle}` : peer.maskedHandle}
                </span>
              </div>
            </CardContent>

            <CardFooter className="pt-2">
              <Link to={`/app/social/${peer.id}`}>
                <Button variant="ghost" size="sm">
                  View Profile
                </Button>
              </Link>
              {peer.connectionStatus === 'MUTUAL_CONNECTED' ? (
                <Badge variant="success">Mutually Connected</Badge>
              ) : (
                <Button
                  variant="ember"
                  size="sm"
                  onClick={() => handleConnect(peer.displayName)}
                  leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                >
                  Connect
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};
