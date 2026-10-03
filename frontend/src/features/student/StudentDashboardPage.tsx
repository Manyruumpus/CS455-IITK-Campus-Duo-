import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, ArrowRight, Sparkles, Clock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useDemoAuth } from '@/app/context/DemoAuthContext';

export const StudentDashboardPage: React.FC = () => {
  const { session } = useDemoAuth();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${session?.name || 'Student'}`}
        subtitle="IIT Kanpur Computer Science & Engineering · Roll #210642"
        badge={<Badge variant="ember">Active Semester</Badge>}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/app/booking/table-grid">
              <Button variant="ember" size="sm" rightIcon={<Calendar className="w-3.5 h-3.5" />}>
                Book Study Table
              </Button>
            </Link>
            <Link to="/app/study">
              <Button variant="outline" size="sm" rightIcon={<BookOpen className="w-3.5 h-3.5" />}>
                Find Partner
              </Button>
            </Link>
          </div>
        }
      />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card variant="craft" className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-craft-muted font-medium">Upcoming Reservation</span>
            <Badge variant="success" dot>Confirmed</Badge>
          </div>
          <p className="text-base font-semibold text-craft-ink">Table T-12 (PK Kelkar 2F)</p>
          <p className="text-xs text-craft-muted mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-ember-400" />
            Today, 16:00 – 18:00 (2 Seats)
          </p>
          <div className="mt-3 pt-2 border-t border-craft-border flex justify-end">
            <Link to="/app/booking/bk-1001" className="text-xs text-ember-400 hover:underline flex items-center gap-1">
              View Pass <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </Card>

        <Card variant="default" className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-craft-muted font-medium">Active Enrolled Courses</span>
            <Badge variant="mono">3 Courses</Badge>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="mono">CS455</Badge>
            <Badge variant="mono">CS632</Badge>
            <Badge variant="mono">ESC102</Badge>
          </div>
          <p className="text-[11px] text-craft-muted mt-3">
            Matching partners based on course revision pace.
          </p>
        </Card>

        <Card variant="default" className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-craft-muted font-medium">Social Discovery</span>
            <Badge variant="success">Opted In</Badge>
          </div>
          <p className="text-xs text-craft-muted leading-normal">
            Independent consent active. 2 interest tags active (Robotics, Chess).
          </p>
          <div className="mt-3 pt-2 border-t border-craft-border flex justify-end">
            <Link to="/app/social" className="text-xs text-craft-muted hover:text-craft-ink hover:underline">
              Explore Clubs →
            </Link>
          </div>
        </Card>
      </div>

      {/* Suggested Matches & Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Suggested Study Match */}
        <Card variant="default">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-ember-400" />
                Suggested Study Match
              </CardTitle>
              <Badge variant="ember">94% Overlap (Mock)</Badge>
            </div>
            <CardDescription>Grounding: Shared enrollment in CS455 & afternoon revision window.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-md bg-craft-surface border border-craft-border text-xs flex items-center justify-between">
              <div>
                <p className="font-semibold text-craft-ink">Aarav Sharma (Y21 CSE)</p>
                <p className="text-[11px] text-craft-muted">Pace: Ahead of class · Quiet focus</p>
              </div>
              <Link to="/app/study/prof-210884">
                <Button variant="outline" size="sm">View Profile</Button>
              </Link>
            </div>
          </CardContent>
          <CardFooter>
            <span className="text-[11px] text-craft-muted">Presentation preview only.</span>
            <Link to="/app/study" className="text-xs text-ember-400 hover:underline">Browse all partners →</Link>
          </CardFooter>
        </Card>

        {/* Quick Booking Hub */}
        <Card variant="default">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-400" />
              Shared Table Reservations
            </CardTitle>
            <CardDescription>Canonical 2-person table reservations across campus.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="p-2.5 rounded bg-craft-surface border border-craft-border flex items-center justify-between text-xs">
              <div>
                <p className="font-medium text-craft-ink">P.K. Kelkar Library — 2nd Floor</p>
                <p className="text-[11px] text-craft-muted">Whisper collaboration zone · Power plugs</p>
              </div>
              <Link to="/app/booking/table-grid">
                <Button variant="ember" size="sm">Book Table</Button>
              </Link>
            </div>
            <div className="p-2.5 rounded bg-craft-surface border border-craft-border flex items-center justify-between text-xs">
              <div>
                <p className="font-medium text-craft-ink">Computer Centre CC-101</p>
                <p className="text-[11px] text-craft-muted">Conversational coding workstations</p>
              </div>
              <Link to="/app/booking/table-grid">
                <Button variant="outline" size="sm">Book Table</Button>
              </Link>
            </div>
          </CardContent>
          <CardFooter>
            <span className="text-[11px] text-craft-muted">Strict 2-person table allocation.</span>
            <Link to="/app/booking/history" className="text-xs text-craft-muted hover:text-craft-ink hover:underline">
              Booking History →
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};
