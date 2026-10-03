import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { FilterBar } from '@/components/ui/FilterBar';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { useToast } from '@/components/ui/Toast';
import { MOCK_STUDY_PROFILES } from '@/mocks';

export const StudyDiscoveryPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('ALL');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const { addToast } = useToast();

  const courseOptions = [
    { id: 'ALL', label: 'All Courses' },
    { id: 'CS455', label: 'CS455' },
    { id: 'MTH101', label: 'MTH101' },
    { id: 'ESC102', label: 'ESC102' },
  ];

  const handleSendRequest = () => {
    addToast({
      type: 'success',
      title: 'Study Request Sent',
      description: 'Your study partnership invitation has been delivered to the peer.',
    });
    setSelectedProfileId(null);
  };

  const filteredProfiles = MOCK_STUDY_PROFILES.filter((p) => {
    const matchesSearch =
      p.displayName.toLowerCase().includes(search.toLowerCase()) ||
      p.department.toLowerCase().includes(search.toLowerCase());
    const matchesCourse =
      selectedCourse === 'ALL' || p.courses.some((c) => c.code === selectedCourse);
    return matchesSearch && matchesCourse;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Study Partner Discovery"
        subtitle="Connect with peers enrolled in shared IITK courses for collaborative problem-solving and quiet study."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Study Matching', isCurrent: true },
        ]}
        actions={
          <Link to="/app/study/requests">
            <Button variant="outline" size="sm">
              Manage Requests
            </Button>
          </Link>
        }
      />

      <FilterBar
        searchQuery={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search study partners by name or department..."
        options={courseOptions}
        selectedOption={selectedCourse}
        onOptionSelect={setSelectedCourse}
        onClearFilters={() => {
          setSearch('');
          setSelectedCourse('ALL');
        }}
      />

      {/* Profiles Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProfiles.map((profile) => (
          <Card key={profile.id} variant="default" className="flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    <Link to={`/app/study/${profile.id}`} className="hover:text-ember-400 transition-colors">
                      {profile.displayName}
                    </Link>
                  </CardTitle>
                  <CardDescription>
                    {profile.degree} · Year {profile.year} · {profile.department}
                  </CardDescription>
                </div>
                {profile.aiMatchScore && (
                  <Badge variant="ember" dot>
                    {profile.aiMatchScore}% Match (Mock)
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {profile.courses.map((c) => (
                  <Badge key={c.code} variant="mono">
                    {c.code}
                  </Badge>
                ))}
              </div>

              {profile.aiMatchReasons && profile.aiMatchReasons.length > 0 && (
                <div className="p-2.5 rounded bg-craft-surface border border-craft-border text-[11px] space-y-1">
                  <span className="font-semibold text-craft-subtle">Match Grounding:</span>
                  {profile.aiMatchReasons.map((reason, i) => (
                    <p key={i} className="text-craft-muted flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>{reason}</span>
                    </p>
                  ))}
                </div>
              )}
            </CardContent>

            <CardFooter className="pt-2">
              <Link to={`/app/study/${profile.id}`}>
                <Button variant="ghost" size="sm">
                  View Detail
                </Button>
              </Link>
              <Button
                variant="ember"
                size="sm"
                onClick={() => setSelectedProfileId(profile.id)}
              >
                Send Request
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Confirmation Dialog for Request */}
      <ConfirmationDialog
        isOpen={!!selectedProfileId}
        onClose={() => setSelectedProfileId(null)}
        onConfirm={handleSendRequest}
        title="Send Study Partnership Request"
        description="Invite this student to form a study partnership. You will be able to coordinate shared 2-person table bookings once accepted."
        confirmLabel="Send Invitation"
      />
    </div>
  );
};
