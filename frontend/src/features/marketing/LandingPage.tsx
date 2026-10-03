import React from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Users,
  Calendar,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Compass,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export const LandingPage: React.FC = () => {
  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="relative rounded-2xl border border-craft-borderCraft/50 bg-craft-card p-6 sm:p-12 lg:p-16 overflow-hidden craft-radial-glow mt-4 max-w-6xl mx-auto">
        <div className="absolute inset-0 craft-subtle-grid pointer-events-none opacity-40" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-950/30 text-amber-300 text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5 text-ember-400" />
            Kyoto Craft Aesthetic · Built for IIT Kanpur Students
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-craft-ink leading-[1.12]">
            Quiet focus meets <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-ember-400 via-ember-500 to-brass-400">
              deliberate connection.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-craft-muted leading-relaxed max-w-2xl">
            Campus Duo brings together course-grounded academic study partnerships, consent-first peer connections, and real-time PK Kelkar Library study table bookings. Exclusively for the IITK student community.
          </p>

          {/* Dual Action CTAs */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link to="/app/study">
              <Button variant="ember" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Find Study Partner
              </Button>
            </Link>
            <Link to="/app/social">
              <Button variant="outline" size="lg" rightIcon={<Users className="w-4 h-4" />}>
                Explore Campus Clubs
              </Button>
            </Link>
            <Link to="/preview/design-system">
              <Button variant="ghost" size="lg" rightIcon={<Compass className="w-4 h-4" />}>
                Design Tokens
              </Button>
            </Link>
          </div>

          {/* Tri-Pillar Architecture Highlight Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8">
            <Card variant="craft" className="p-4 bg-craft-surface/60 backdrop-blur-sm">
              <div className="w-8 h-8 rounded bg-ember-900/40 border border-ember-700/50 flex items-center justify-center text-ember-400 mb-3">
                <BookOpen className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-craft-ink">Academic Study Match</h2>
              <p className="text-xs text-craft-muted mt-1 leading-normal">
                Pair up for CS455, MTH101, or ESC102 based on compatible revision pace and quiet focus habits.
              </p>
            </Card>

            <Card variant="craft" className="p-4 bg-craft-surface/60 backdrop-blur-sm">
              <div className="w-8 h-8 rounded bg-emerald-900/40 border border-emerald-700/50 flex items-center justify-center text-emerald-400 mb-3">
                <Users className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-craft-ink">Consent-First Social</h2>
              <p className="text-xs text-craft-muted mt-1 leading-normal">
                Independent opt-in for campus clubs and peer interests. Contact handles reveal only upon mutual agreement.
              </p>
            </Card>

            <Card variant="craft" className="p-4 bg-craft-surface/60 backdrop-blur-sm">
              <div className="w-8 h-8 rounded bg-sky-900/40 border border-sky-700/50 flex items-center justify-center text-sky-400 mb-3">
                <Calendar className="w-4 h-4" />
              </div>
              <h2 className="text-sm font-semibold text-craft-ink">Two-Person Table Bookings</h2>
              <p className="text-xs text-craft-muted mt-1 leading-normal">
                Reserve 2-person study tables at PK Kelkar Library & CC with server-authoritative collision detection.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Independent Consent Guarantee Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-craft-border bg-craft-surface p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <Badge variant="mono">Architectural Privacy</Badge>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-craft-ink">
              Independent Discovery Consent
            </h2>
            <p className="text-xs sm:text-sm text-craft-muted leading-relaxed">
              Study collaboration and social networking operate under decoupled consent. You can actively seek course study partners while keeping your social profile completely disabled.
            </p>
            <ul className="space-y-2 text-xs text-craft-ink">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Zero unsolicited peer exposure</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>No dating, courtship, or romantic matchmaking scope</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Consent toggles can be revoked at any time</span>
              </li>
            </ul>
          </div>

          <div className="p-5 rounded-lg border border-craft-borderCraft bg-craft-card space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-craft-border">
              <span className="text-xs font-semibold text-craft-ink font-mono">Consent Architecture</span>
              <Badge variant="success">Granular</Badge>
            </div>
            <div className="p-3 rounded bg-craft-surface border border-craft-border flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-craft-ink">Academic Study Mode</p>
                <p className="text-[11px] text-craft-muted">Course matching & table pairing</p>
              </div>
              <Badge variant="success">Active</Badge>
            </div>
            <div className="p-3 rounded bg-craft-surface border border-craft-border flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-craft-ink">Campus Social Mode</p>
                <p className="text-[11px] text-craft-muted">Clubs, sports & activity tags</p>
              </div>
              <Badge variant="outline">Optional Opt-In</Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Two-Person Table Reservation Showcase */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <Badge variant="mono">Physical Campus Utility</Badge>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-craft-ink mt-1">
              Canonical Two-Person Table Reservations
            </h2>
            <p className="text-xs text-craft-muted mt-1">
              P.K. Kelkar Library (2nd Floor Quiet Zone) and Computer Centre (Lab CC-101).
            </p>
          </div>
          <Link to="/app/booking">
            <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              View Live Table Grid
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card variant="default">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>PK Kelkar Library</CardTitle>
                <Badge variant="success" dot>Available</Badge>
              </div>
              <CardDescription>2nd Floor · Whisper Collaboration</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-craft-muted leading-relaxed">
                24 canonical two-person tables with individual AC power outlets, task lighting, and reliable Wi-Fi 6 coverage.
              </p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Computer Centre CC-101</CardTitle>
                <Badge variant="success" dot>Available</Badge>
              </div>
              <CardDescription>Ground Floor · Terminal Workstations</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-craft-muted leading-relaxed">
                Dual-monitor workstations configured for programming assignments, compiler labs, and technical projects.
              </p>
            </CardContent>
          </Card>

          <Card variant="default">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Server-Authoritative</CardTitle>
                <Badge variant="mono">Integrity</Badge>
              </div>
              <CardDescription>Collision Detection & Slot Locking</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-craft-muted leading-relaxed">
                Prevents double-booking collisions through server validation and instant seat release upon session cancellation.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="p-8 sm:p-12 rounded-2xl border border-craft-borderCraft bg-craft-card text-center space-y-4 craft-radial-glow">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-craft-ink">
            Ready to explore Campus Duo?
          </h2>
          <p className="text-xs sm:text-sm text-craft-muted max-w-xl mx-auto leading-relaxed">
            Sign in with the demonstration portal to test the student dashboard, study discovery cards, 2-person table grids, and administrative moderation tools.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link to="/login">
              <Button variant="ember" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Launch Demo Portal
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};
