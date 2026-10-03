import React, { useState, useEffect } from 'react';
import {
  Moon,
  Sun,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';

export const DesignSystemPreviewPage: React.FC = () => {
  const [treatment, setTreatment] = useState<'marketing' | 'functional'>('marketing');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [osReducedMotion, setOsReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });
  const [userReducedMotion] = useState(false);
  const [btnLoading, setBtnLoading] = useState(false);
  const [rollInput, setRollInput] = useState('210642');
  const [rollError, setRollError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const listener = (event: MediaQueryListEvent) => {
        setOsReducedMotion(event.matches);
      };

      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  const effectiveReducedMotion = osReducedMotion || userReducedMotion;

  const toggleTheme = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleRollChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setRollInput(val);
    if (!/^\d{6}$/.test(val)) {
      setRollError('IITK Roll Number must be exactly 6 digits (e.g., 210642)');
    } else {
      setRollError('');
    }
  };

  return (
    <div className={`space-y-8 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto ${effectiveReducedMotion ? 'motion-reduce' : ''}`}>
      <PageHeader
        title="Design System Sandbox (Stage 01 Foundation)"
        subtitle="Interactive tokens explorer, dual marketing/functional treatments, and accessible primitives."
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Design System Preview', isCurrent: true },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-craft-surface border border-craft-border rounded-lg p-0.5 text-xs font-medium">
              <button
                onClick={() => setTreatment('marketing')}
                className={`px-3 py-1 rounded-md transition-all ${
                  treatment === 'marketing'
                    ? 'bg-ember-600 text-white shadow-sm'
                    : 'text-craft-muted hover:text-craft-ink'
                }`}
              >
                Craft Marketing
              </button>
              <button
                onClick={() => setTreatment('functional')}
                className={`px-3 py-1 rounded-md transition-all ${
                  treatment === 'functional'
                    ? 'bg-ember-600 text-white shadow-sm'
                    : 'text-craft-muted hover:text-craft-ink'
                }`}
              >
                Functional App
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </Button>
          </div>
        }
      />

      {/* Primitive Workbench */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="default">
          <CardHeader>
            <CardTitle>Button Primitives</CardTitle>
            <CardDescription>All 6 token variants and loading states.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ember" isLoading={btnLoading}>Ember</Button>
              <Button variant="primary">Primary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBtnLoading(true);
                setTimeout(() => setBtnLoading(false), 1200);
              }}
            >
              Simulate 1.2s Async Loading
            </Button>
          </CardContent>
        </Card>

        <Card variant="default">
          <CardHeader>
            <CardTitle>Form Inputs & Zod Validation</CardTitle>
            <CardDescription>Accessible label associations and error alerts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              label="Student Roll Number"
              value={rollInput}
              onChange={handleRollChange}
              errorMessage={rollError}
              helperText="Must be a valid 6-digit IIT Kanpur roll number."
              required
            />
          </CardContent>
        </Card>

        <Card variant="default">
          <CardHeader>
            <CardTitle>Status & Categorical Badges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="mono">CS455</Badge>
              <Badge variant="ember" dot>AI 94%</Badge>
              <Badge variant="success" dot>Available</Badge>
              <Badge variant="warning" dot>Reserved</Badge>
              <Badge variant="danger" dot>Occupied</Badge>
            </div>
          </CardContent>
        </Card>

        <Card variant="craft">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>AI Match Reasoning Card</CardTitle>
              <Badge variant="mono">Mock-Only Client Preview</Badge>
            </div>
            <CardDescription>Demonstrates REQ-AI-01: Transparent reasoning presentation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="p-3 rounded bg-craft-surface border border-craft-border text-xs space-y-1">
              <p className="text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled in CS455 (Computer Networks)
              </p>
              <p className="text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Quiet problem-solving pace match
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
