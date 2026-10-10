import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Heart, EyeOff, SkipForward, AlertCircle, SearchX, Settings } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import { useSocialRecommendations, useRecordSocialAction } from '@/queries';
import { SocialDiscoveryFilters } from '@/types/social';

const CATEGORIES = [
  { id: 'ALL', label: 'All Categories' },
  { id: 'TECH_ACADEMIC', label: 'Tech & Academic' },
  { id: 'CULTURAL_ARTS', label: 'Cultural & Arts' },
  { id: 'SPORTS_FITNESS', label: 'Sports & Fitness' },
  { id: 'CAMPUS_LIFE', label: 'Campus Life' },
];

export const SocialDiscoveryPage: React.FC = () => {
  const { session } = useDemoAuth();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const filters: SocialDiscoveryFilters = {
    search: search.trim() || undefined,
    category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
  };

  const { data: recommendations, isLoading, error, refetch } = useSocialRecommendations(filters);
  const { mutate: recordAction, isPending: isActionPending } = useRecordSocialAction();

  const handleAction = (targetUserId: string, action: 'LIKE' | 'PASS' | 'HIDE', candidateName: string) => {
    recordAction({ targetUserId, action, candidateName }, { onSuccess: () => refetch() });
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedCategory('ALL');
  };

  // Not a student or consent disabled — show guidance
  if (!session || session.role !== 'ROLE_STUDENT') {
    return (
      <div className="space-y-6">
        <PageHeader title="Campus Social Connections" subtitle="Sign in as a student to explore social discovery." />
        <Card variant="default">
          <CardContent className="p-6 text-center text-sm text-craft-muted">
            Student session required.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session.hasSocialConsent) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Campus Social Connections"
          subtitle="Enable social discovery to explore peers based on shared campus activities."
          breadcrumbs={[
            { label: 'Dashboard', href: '/app/dashboard' },
            { label: 'Social Discovery', isCurrent: true },
          ]}
        />
        <Card variant="craft">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="font-semibold text-sm">Social Discovery Consent Required</span>
            </div>
            <p className="text-xs text-craft-muted leading-relaxed">
              You have not opted into social discovery. Enable it in Settings to explore campus peers based on shared clubs, sports and hobbies. Your contact details are never disclosed.
            </p>
            <div className="flex gap-2 pt-1">
              <Link to="/app/settings">
                <Button variant="ember" size="sm" leftIcon={<Settings className="w-3.5 h-3.5" />}>
                  Go to Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campus Social Connections"
        subtitle="Explore peer connections based on shared campus activities, clubs, sports and hobbies."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Social Discovery', isCurrent: true },
        ]}
        actions={
          <Link to="/app/social/connections">
            <Button variant="outline" size="sm">
              My Connections
            </Button>
          </Link>
        }
      />

      <FilterBar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Filter by name, hobby, club or sport…"
        options={CATEGORIES}
        selectedOption={selectedCategory}
        onOptionSelect={setSelectedCategory}
        onClearFilters={clearFilters}
      />

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} variant="default" className="animate-pulse">
              <CardContent className="p-6 space-y-2">
                <div className="h-4 w-1/2 rounded bg-craft-border" />
                <div className="h-3 w-3/4 rounded bg-craft-border" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <Card variant="craft">
          <CardContent className="p-6 space-y-2">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="font-semibold text-sm">Discovery Unavailable</span>
            </div>
            <p className="text-xs text-craft-muted">{error.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty */}
      {!isLoading && !error && recommendations && recommendations.length === 0 && (
        <Card variant="default">
          <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
            <SearchX className="w-8 h-8 text-craft-muted" />
            <p className="text-sm font-semibold text-craft-ink">No peers found</p>
            <p className="text-xs text-craft-muted">
              No candidates match your current filters, or all have been passed or hidden for this discovery round.
            </p>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {!isLoading && !error && recommendations && recommendations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.map((rec) => (
            <Card key={rec.profile.userId} variant="default" className="flex flex-col justify-between">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      <Link
                        to={`/app/social/${rec.profile.userId}`}
                        className="hover:text-ember-400 transition-colors"
                        aria-label={`View ${rec.profile.displayName}'s profile`}
                      >
                        {rec.profile.displayName}
                      </Link>
                    </CardTitle>
                    <CardDescription className="line-clamp-2 mt-1">{rec.profile.bio}</CardDescription>
                  </div>
                  <Badge
                    variant={rec.relationshipStatus === 'MUTUAL_CONNECTED' ? 'success' : 'outline'}
                  >
                    {rec.relationshipStatus === 'MUTUAL_CONNECTED'
                      ? 'Connected'
                      : rec.relationshipStatus === 'PENDING_SENT'
                      ? 'Liked'
                      : 'Peer'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Interest tags */}
                <div className="flex flex-wrap gap-1.5">
                  {rec.profile.interests.map((interest) => (
                    <Badge key={interest.id} variant="default" className="text-[11px]">
                      {interest.name}
                    </Badge>
                  ))}
                </div>

                {/* Grounded reasons */}
                <div className="p-2.5 rounded bg-craft-surface border border-craft-border text-[11px] text-craft-muted">
                  <span className="font-medium text-craft-ink">Match basis: </span>
                  {rec.groundedReasons?.[0] ?? 'No explicit shared interests'}
                </div>

                {/* Privacy notice */}
                <div className="p-2.5 rounded bg-craft-surface border border-craft-border text-[11px] flex items-center justify-between text-craft-muted">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>Privacy Protection:</span>
                  </span>
                  <span className="text-craft-ink font-medium">Contact details excluded by policy</span>
                </div>
              </CardContent>

              <CardFooter className="pt-2 gap-2">
                <Link to={`/app/social/${rec.profile.userId}`}>
                  <Button variant="ghost" size="sm" aria-label={`View ${rec.profile.displayName}'s full profile`}>
                    View Profile
                  </Button>
                </Link>

                {rec.relationshipStatus === 'MUTUAL_CONNECTED' ? (
                  <Badge variant="success" className="ml-auto">Mutually Connected</Badge>
                ) : (
                  <div className="ml-auto flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isActionPending}
                      aria-label={`Pass ${rec.profile.displayName}`}
                      onClick={() => handleAction(rec.profile.userId, 'PASS', rec.profile.displayName)}
                      title="Pass — dismiss for this discovery round"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isActionPending}
                      aria-label={`Hide ${rec.profile.displayName}`}
                      onClick={() => handleAction(rec.profile.userId, 'HIDE', rec.profile.displayName)}
                      title="Hide — remove from your feed permanently"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                    </Button>
                    {rec.relationshipStatus !== 'PENDING_SENT' && (
                      <Button
                        variant="ember"
                        size="sm"
                        disabled={isActionPending}
                        aria-label={`Like ${rec.profile.displayName}`}
                        leftIcon={<Heart className="w-3.5 h-3.5" />}
                        onClick={() => handleAction(rec.profile.userId, 'LIKE', rec.profile.displayName)}
                      >
                        Like
                      </Button>
                    )}
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Footer note — mock qualification */}
      <p className="text-[11px] text-craft-muted text-center">
        Social discovery connected to in-memory mock service. No real backend integration.
        Messaging is disabled. Contact disclosure is not implemented.
      </p>
    </div>
  );
};
