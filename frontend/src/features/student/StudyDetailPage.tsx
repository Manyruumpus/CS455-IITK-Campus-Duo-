import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MOCK_STUDY_PROFILES } from '@/mocks';

export const StudyDetailPage: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const profile = MOCK_STUDY_PROFILES.find((p) => p.id === studentId) || MOCK_STUDY_PROFILES[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile.displayName}
        subtitle={`${profile.degree} in ${profile.department} · Year ${profile.year}`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Study Matching', href: '/app/study' },
          { label: profile.displayName, isCurrent: true },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/app/study">
              <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Back to Feed
              </Button>
            </Link>
            <Button variant="ember" size="sm">
              Send Study Request
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card variant="default">
            <CardHeader>
              <CardTitle>Academic Course Enrollments</CardTitle>
              <CardDescription>Courses actively enrolled for this semester.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.courses.map((course) => (
                <div
                  key={course.code}
                  className="p-3 rounded-lg bg-craft-surface border border-craft-border flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono text-xs font-bold text-ember-400">{course.code}</span>
                    <p className="text-xs font-medium text-craft-ink">{course.name}</p>
                  </div>
                  <Badge variant="mono">{course.department}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card variant="craft">
            <CardHeader>
              <CardTitle>AI Match Factor Grounding</CardTitle>
              <CardDescription>Explainability signals generated for this profile (Mock presentation).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {profile.aiMatchReasons?.map((reason, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-craft-muted">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{reason}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card variant="default">
            <CardHeader>
              <CardTitle>Study Habits & Schedule</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div>
                <span className="text-craft-muted">Study Style:</span>
                <p className="font-medium text-craft-ink mt-0.5">{profile.studyStyle.replace('_', ' ')}</p>
              </div>
              <div>
                <span className="text-craft-muted">Revision Pace:</span>
                <p className="font-medium text-craft-ink mt-0.5">{profile.preferredPace.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <span className="text-craft-muted">Preferred Time Slots:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {profile.preferredTimes.map((t) => (
                    <Badge key={t} variant="mono">{t}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
