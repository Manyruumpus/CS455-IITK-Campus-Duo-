import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Users,
  Compass,
  Lock,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { useDemoAuth } from '@/app/context/DemoAuthContext';
import { useCompleteOnboarding } from '@/queries/profileHooks';
import { validateReturnPath } from '@/utils/navigation';
import {
  DiscoveryModeSelection,
  PreferredStudyTime,
  StudyStyle,
  TargetPace,
  CourseEnrollment,
  SocialInterestTag,
  AppError,
} from '@/types';

const AVAILABLE_COURSE_OPTIONS: CourseEnrollment[] = [
  { code: 'CS455', name: 'Computer Networks', department: 'CSE' },
  { code: 'MTH101', name: 'Mathematics I', department: 'MTH' },
  { code: 'ESC102', name: 'Introduction to Electronics', department: 'EE' },
  { code: 'CS632', name: 'Advanced Compilers', department: 'CSE' },
];

const AVAILABLE_INTEREST_TAGS: SocialInterestTag[] = [
  { id: 'tag-robotics', name: 'Robotics', category: 'TECH_ACADEMIC' },
  { id: 'tag-chess', name: 'Chess Club', category: 'SPORTS_FITNESS' },
  { id: 'tag-music', name: 'Western Music', category: 'CULTURAL_ARTS' },
  { id: 'tag-table-tennis', name: 'Table Tennis', category: 'SPORTS_FITNESS' },
  { id: 'tag-drones', name: 'Aeromodelling', category: 'TECH_ACADEMIC' },
];

export const OnboardingPage: React.FC = () => {
  const { session, onboardingDraft, setOnboardingDraft } = useDemoAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromParam = searchParams.get('from');
  const { addToast } = useToast();

  const completeOnboardingMutation = useCompleteOnboarding();

  // If user is Admin, bypass onboarding completely (Amendment 7)
  useEffect(() => {
    if (session?.role === 'ROLE_ADMIN') {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [session, navigate]);

  // Wizard state initialized from in-memory draft (Amendment 6)
  const [step, setStep] = useState<number>(() => onboardingDraft?.currentStep ?? 1);
  const [modesSelected, setModesSelected] = useState<DiscoveryModeSelection>(
    () => onboardingDraft?.modesSelected ?? 'BOTH'
  );
  const [displayName, setDisplayName] = useState<string>(
    () => onboardingDraft?.displayName ?? session?.name ?? 'Alex Rivera'
  );
  const [selectedCourses, setSelectedCourses] = useState<CourseEnrollment[]>(
    () => onboardingDraft?.courses ?? [{ code: 'CS455', name: 'Computer Networks', department: 'CSE' }]
  );
  const [preferredTimes, setPreferredTimes] = useState<PreferredStudyTime[]>(
    () => onboardingDraft?.studyPreferences?.preferredTimes ?? ['AFTERNOON', 'EVENING']
  );
  const [studyStyle, setStudyStyle] = useState<StudyStyle>(
    () => (onboardingDraft?.studyPreferences?.studyStyle as StudyStyle) ?? 'QUIET_FOCUSED'
  );
  const [preferredPace, setPreferredPace] = useState<TargetPace>(
    () => (onboardingDraft?.studyPreferences?.preferredPace as TargetPace) ?? 'STANDARD_REGULAR'
  );
  const [socialBio, setSocialBio] = useState<string>(
    () => onboardingDraft?.socialBio ?? ''
  );
  const [selectedInterests, setSelectedInterests] = useState<SocialInterestTag[]>(
    () => onboardingDraft?.socialInterests ?? []
  );

  // Discovery Opt-Ins: explicit and unchecked unless previously saved (Amendment 2)
  const [studyConsent, setStudyConsent] = useState<boolean>(
    () => onboardingDraft?.studyConsent ?? false
  );
  const [socialConsent, setSocialConsent] = useState<boolean>(
    () => onboardingDraft?.socialConsent ?? false
  );

  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync draft to DemoAuthContext on every change (Amendment 6)
  useEffect(() => {
    setOnboardingDraft({
      currentStep: step,
      displayName,
      modesSelected,
      studyPreferences: {
        studyStyle,
        preferredPace,
        preferredTimes,
      },
      courses: selectedCourses,
      socialBio,
      socialInterests: selectedInterests,
      studyConsent,
      socialConsent,
    });
  }, [
    step,
    displayName,
    modesSelected,
    studyStyle,
    preferredPace,
    preferredTimes,
    selectedCourses,
    socialBio,
    selectedInterests,
    studyConsent,
    socialConsent,
    setOnboardingDraft,
  ]);

  // Check inconsistency between mode and consent toggles (Amendment 2)
  const getConsistencyError = (): string | null => {
    if (modesSelected === 'STUDY' && (!studyConsent || socialConsent)) {
      return 'Inconsistency detected: Study mode requires Study Discovery enabled and Social Discovery disabled.';
    }
    if (modesSelected === 'SOCIAL' && (!socialConsent || studyConsent)) {
      return 'Inconsistency detected: Social mode requires Social Discovery enabled and Study Discovery disabled.';
    }
    if (modesSelected === 'BOTH' && (!studyConsent || !socialConsent)) {
      return 'Inconsistency detected: Both mode requires both Study Discovery and Social Discovery enabled.';
    }
    if (modesSelected === 'NEITHER' && (studyConsent || socialConsent)) {
      return 'Inconsistency detected: Neither mode requires both discovery toggles disabled.';
    }
    return null;
  };

  const handleNextStep = () => {
    setValidationError(null);

    // Step 2 validation
    if (step === 2) {
      if (!displayName.trim()) {
        setValidationError('Display name cannot be empty.');
        return;
      }
    }

    // Step 3 validation (Study fields required only if study discovery is enabled)
    if (step === 3 && (modesSelected === 'STUDY' || modesSelected === 'BOTH')) {
      if (selectedCourses.length === 0) {
        setValidationError('At least one enrolled course is required for study matching.');
        return;
      }
      if (preferredTimes.length === 0) {
        setValidationError('At least one available study time window is required.');
        return;
      }
    }

    // Step 5 validation (Consistency between mode and consent)
    if (step === 5) {
      const consistencyErr = getConsistencyError();
      if (consistencyErr) {
        setValidationError(consistencyErr);
        return;
      }
    }

    setStep((prev) => Math.min(prev + 1, 6));
  };

  const handlePrevStep = () => {
    setValidationError(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSyncConsentToMode = () => {
    if (modesSelected === 'STUDY') {
      setStudyConsent(true);
      setSocialConsent(false);
    } else if (modesSelected === 'SOCIAL') {
      setStudyConsent(false);
      setSocialConsent(true);
    } else if (modesSelected === 'BOTH') {
      setStudyConsent(true);
      setSocialConsent(true);
    } else {
      setStudyConsent(false);
      setSocialConsent(false);
    }
    setValidationError(null);
  };

  const handleSubmitOnboarding = () => {
    setValidationError(null);

    const consistencyErr = getConsistencyError();
    if (consistencyErr) {
      setValidationError(consistencyErr);
      return;
    }

    completeOnboardingMutation.mutate(
      {
        displayName,
        modesSelected,
        studyPreferences: {
          studyStyle,
          preferredPace,
          preferredTimes,
        },
        courses: selectedCourses,
        socialBio: socialBio.trim() ? socialBio.trim() : undefined,
        socialInterests: selectedInterests,
        studyConsent,
        socialConsent,
      },
      {
        onSuccess: (saved) => {
          // Clear draft on successful completion
          setOnboardingDraft(null);
          addToast({
            type: 'success',
            title: 'Onboarding Complete',
            description: `Welcome, ${saved.displayName}! Your profile and preferences have been established.`,
          });
          const target = validateReturnPath(fromParam, 'ROLE_STUDENT');
          navigate(target, { replace: true });
        },
        onError: (err) => {
          setValidationError(
            err instanceof AppError
              ? `${err.code}: ${err.message}`
              : 'Failed to complete onboarding. Please verify required fields.'
          );
        },
      }
    );
  };

  const toggleCourse = (course: CourseEnrollment) => {
    setSelectedCourses((prev) =>
      prev.some((c) => c.code === course.code)
        ? prev.filter((c) => c.code !== course.code)
        : [...prev, course]
    );
  };

  const toggleTime = (t: PreferredStudyTime) => {
    setPreferredTimes((prev) =>
      prev.includes(t) ? prev.filter((item) => item !== t) : [...prev, t]
    );
  };

  const toggleInterest = (tag: SocialInterestTag) => {
    setSelectedInterests((prev) =>
      prev.some((i) => i.id === tag.id)
        ? prev.filter((i) => i.id !== tag.id)
        : [...prev, tag]
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Student Onboarding"
        subtitle="Establish your academic study preferences and campus social visibility."
        breadcrumbs={[
          { label: 'Campus Duo', href: '/' },
          { label: 'Onboarding', isCurrent: true },
        ]}
      />

      {/* Progress indicator */}
      <div className="flex items-center justify-between text-xs text-craft-muted border-b border-craft-border pb-3">
        <span>Step {step} of 6</span>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className={`h-1.5 w-8 rounded-full transition-colors ${
                i <= step ? 'bg-ember-500' : 'bg-craft-surface border border-craft-border'
              }`}
            />
          ))}
        </div>
      </div>

      {validationError && (
        <div className="p-3.5 rounded-lg bg-red-950/40 border border-red-500/50 text-xs text-red-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Validation Required</p>
            <p className="text-[11px] text-red-300 mt-0.5">{validationError}</p>
          </div>
        </div>
      )}

      {/* STEP 1: Discovery Mode Selection (Amendment 2: placed before conditional fields) */}
      {step === 1 && (
        <Card variant="craft">
          <CardHeader>
            <CardTitle>1. Select Discovery Modes</CardTitle>
            <CardDescription>
              Choose how you wish to participate in Campus Duo. Mode selection guides this wizard, but discovery consent toggles must be explicitly granted in Step 5.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                id: 'BOTH',
                label: 'Study Matching & Social Discovery (Both)',
                desc: 'Find classmates enrolled in your courses and discover extracurricular peer hobby groups.',
                icon: Compass,
              },
              {
                id: 'STUDY',
                label: 'Academic Study Matching Only',
                desc: 'Strictly course-based study groups, exam preparation, and library table reservations.',
                icon: BookOpen,
              },
              {
                id: 'SOCIAL',
                label: 'Campus Social Discovery Only',
                desc: 'Extracurricular clubs, sports, and hobby interest tags without study matching.',
                icon: Users,
              },
              {
                id: 'NEITHER',
                label: 'Private Account (Neither)',
                desc: 'Table reservation passes only; your profile will not appear in any public discovery feeds.',
                icon: Lock,
              },
            ].map((option) => {
              const Icon = option.icon;
              const isSelected = modesSelected === option.id;
              return (
                <div
                  key={option.id}
                  onClick={() => setModesSelected(option.id as DiscoveryModeSelection)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-colors flex items-start gap-3 ${
                    isSelected
                      ? 'bg-ember-950/30 border-ember-500/60 ring-1 ring-ember-500'
                      : 'bg-craft-surface border-craft-border hover:border-craft-muted'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${isSelected ? 'text-ember-400' : 'text-craft-muted'}`} />
                  <div>
                    <p className="font-semibold text-xs text-craft-ink">{option.label}</p>
                    <p className="text-[11px] text-craft-muted mt-0.5">{option.desc}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Link to="/app/settings">
              <Button variant="outline" size="sm">
                Cancel to Settings
              </Button>
            </Link>
            <Button variant="ember" size="sm" onClick={handleNextStep} rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Next: Basic Profile
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 2: Basic Profile & Identity Provenance (Amendment 1) */}
      {step === 2 && (
        <Card variant="craft">
          <CardHeader>
            <CardTitle>2. Basic Profile & Credentials</CardTitle>
            <CardDescription>
              Demo fixture data. Production credential source and edit policy remain unresolved (DEC-05).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Input
                id="onboard-display-name"
                label="Display Name (Editable)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
              />
              <p className="text-[10px] text-craft-subtle">
                This name is visible to peers in discovery results.
              </p>
            </div>

            <div className="p-3.5 rounded-lg bg-craft-surface border border-craft-border text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-craft-ink font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Read-Only Demo Academic Fixtures</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-craft-muted">
                <div>
                  <span className="block text-craft-subtle">Campus Email:</span>
                  <span className="font-mono text-craft-ink">{session?.email ?? 'alex.rivera@campusduo.test'}</span>
                </div>
                <div>
                  <span className="block text-craft-subtle">Roll Number:</span>
                  <span className="font-mono text-craft-ink">{session?.rollNumber ?? '200001'}</span>
                </div>
                <div>
                  <span className="block text-craft-subtle">Department:</span>
                  <span className="text-craft-ink">Computer Science & Engineering</span>
                </div>
                <div>
                  <span className="block text-craft-subtle">Degree / Year:</span>
                  <span className="text-craft-ink">B.Tech (Year 4)</span>
                </div>
              </div>
              <p className="text-[10px] text-craft-subtle pt-1 border-t border-craft-border">
                Identity and academic fields are protected read-only demo fixtures. Changes are rejected by the service boundary.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" size="sm" onClick={handlePrevStep} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Back
            </Button>
            <Button variant="ember" size="sm" onClick={handleNextStep} rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Next: Study Preferences
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 3: Study Preferences & Availability (Conditional on mode) */}
      {step === 3 && (
        <Card variant="craft">
          <CardHeader>
            <CardTitle>3. Academic Courses & Availability</CardTitle>
            <CardDescription>
              {modesSelected === 'SOCIAL' || modesSelected === 'NEITHER'
                ? 'Study inputs are optional for your selected mode.'
                : 'Enrolled courses and valid study availability are required for study discovery.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {modesSelected === 'SOCIAL' || modesSelected === 'NEITHER' ? (
              <div className="p-4 rounded-lg bg-craft-surface border border-craft-border text-xs text-craft-muted space-y-1">
                <p className="font-semibold text-craft-ink">Study Matching Omitted</p>
                <p>
                  You selected <strong className="text-craft-ink">{modesSelected}</strong> mode in Step 1. You may skip this step without configuring study courses or availability.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-craft-ink">
                    Enrolled Courses / Topics <span className="text-ember-400">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_COURSE_OPTIONS.map((c) => {
                      const isSelected = selectedCourses.some((item) => item.code === c.code);
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => toggleCourse(c)}
                          className={`px-2.5 py-1 rounded text-xs border font-mono transition-colors ${
                            isSelected
                              ? 'bg-ember-600 text-white border-ember-500 font-semibold'
                              : 'bg-craft-surface text-craft-muted border-craft-border hover:border-craft-muted'
                          }`}
                        >
                          {c.code}: {c.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-craft-subtle">Select at least one course for matching.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-craft-ink">
                    Study Availability Windows <span className="text-ember-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {(['MORNING', 'AFTERNOON', 'EVENING', 'LATE_NIGHT'] as PreferredStudyTime[]).map((t) => {
                      const isSelected = preferredTimes.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleTime(t)}
                          className={`p-2 rounded border text-left transition-colors ${
                            isSelected
                              ? 'bg-ember-950/40 border-ember-500 text-ember-300 font-medium'
                              : 'bg-craft-surface border-craft-border text-craft-muted hover:border-craft-muted'
                          }`}
                        >
                          {t.replace('_', ' ')}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-craft-subtle">Select non-empty availability windows.</p>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-craft-border text-xs">
                  <div>
                    <label className="block text-[11px] text-craft-muted mb-1">Study Style (Optional)</label>
                    <select
                      value={studyStyle}
                      onChange={(e) => setStudyStyle(e.target.value as StudyStyle)}
                      className="w-full px-2.5 py-1.5 rounded bg-craft-surface border border-craft-border text-craft-ink text-xs"
                    >
                      <option value="QUIET_FOCUSED">Quiet Focused</option>
                      <option value="DISCUSSION_HEAVY">Discussion Heavy</option>
                      <option value="PROBLEM_SOLVING">Problem Solving</option>
                      <option value="HYBRID">Hybrid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-craft-muted mb-1">Preferred Pace (Optional)</label>
                    <select
                      value={preferredPace}
                      onChange={(e) => setPreferredPace(e.target.value as TargetPace)}
                      className="w-full px-2.5 py-1.5 rounded bg-craft-surface border border-craft-border text-craft-ink text-xs"
                    >
                      <option value="STANDARD_REGULAR">Standard Regular</option>
                      <option value="AHEAD_OF_CLASS">Ahead of Class</option>
                      <option value="EXAM_CRAMMING">Exam Cramming</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" size="sm" onClick={handlePrevStep} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Back
            </Button>
            <Button variant="ember" size="sm" onClick={handleNextStep} rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Next: Social Preferences
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 4: Social Preferences (Optional generic tags) */}
      {step === 4 && (
        <Card variant="craft">
          <CardHeader>
            <CardTitle>4. Campus Social Preferences</CardTitle>
            <CardDescription>
              Generic club and hobby interest tags. Dating-specific preferences are strictly deferred (DEC-01).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="onboard-social-bio" className="block text-xs font-medium text-craft-ink">
                Social Bio (Optional)
              </label>
              <textarea
                id="onboard-social-bio"
                rows={3}
                value={socialBio}
                onChange={(e) => setSocialBio(e.target.value)}
                placeholder="Brief summary of campus activities, hobbies, or clubs..."
                className="w-full p-2.5 rounded-lg bg-craft-surface border border-craft-border text-craft-ink text-xs focus:outline-none focus:ring-1 focus:ring-ember-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-craft-ink">
                Interest Tags (Optional)
              </label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_INTEREST_TAGS.map((tag) => {
                  const isSelected = selectedInterests.some((t) => t.id === tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleInterest(tag)}
                      className={`px-2.5 py-1 rounded text-xs border transition-colors ${
                        isSelected
                          ? 'bg-ember-600 text-white border-ember-500 font-semibold'
                          : 'bg-craft-surface text-craft-muted border-craft-border hover:border-craft-muted'
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" size="sm" onClick={handlePrevStep} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Back
            </Button>
            <Button variant="ember" size="sm" onClick={handleNextStep} rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Next: Discovery Consent
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 5: Explicit Discovery Opt-Ins & Consistency Validation (Amendment 2) */}
      {step === 5 && (
        <Card variant="craft">
          <CardHeader>
            <CardTitle>5. Independent Discovery Opt-Ins</CardTitle>
            <CardDescription>
              Explicit consent is required to enable discovery visibility. Final enabled modes must match your Step 1 selection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3.5 rounded-lg bg-craft-surface border border-craft-border space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={studyConsent}
                  onChange={(e) => setStudyConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-craft-border text-ember-600 focus:ring-ember-500"
                />
                <div>
                  <span className="font-semibold text-xs text-craft-ink">
                    Academic Study Discovery Opt-In
                  </span>
                  <p className="text-[11px] text-craft-muted mt-0.5">
                    Permits classmates to find your profile in course study partner listings.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 cursor-pointer pt-2 border-t border-craft-border">
                <input
                  type="checkbox"
                  checked={socialConsent}
                  onChange={(e) => setSocialConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-craft-border text-ember-600 focus:ring-ember-500"
                />
                <div>
                  <span className="font-semibold text-xs text-craft-ink">
                    Campus Social Discovery Opt-In
                  </span>
                  <p className="text-[11px] text-craft-muted mt-0.5">
                    Permits peers to find your club, sport, and hobby interest tags.
                  </p>
                </div>
              </label>
            </div>

            {getConsistencyError() && (
              <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/50 space-y-2 text-xs text-amber-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Inconsistency Detected</p>
                    <p className="text-[11px] text-amber-300 mt-0.5">{getConsistencyError()}</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="ember" size="sm" onClick={handleSyncConsentToMode}>
                    Synchronize Consent Toggles to Mode ({modesSelected})
                  </Button>
                </div>
              </div>
            )}

            <div className="p-3 rounded bg-craft-surface border border-craft-border text-[11px] text-craft-muted space-y-1">
              <span className="font-semibold text-craft-ink block">Privacy & Booking Boundaries:</span>
              <p>
                • Discovery consent makes your profile visible in matching feeds. It does <strong>not</strong> authorize contact handle disclosure (DEC-08).
              </p>
              <p>
                • Discovery consent does <strong>not</strong> grant any peer authority to reserve table seats on your behalf.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" size="sm" onClick={handlePrevStep} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Back
            </Button>
            <Button
              variant="ember"
              size="sm"
              onClick={handleNextStep}
              disabled={!!getConsistencyError()}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Next: Review & Confirm
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 6: Review & Save (Amendment 3: Transactional Mock Save) */}
      {step === 6 && (
        <Card variant="craft">
          <CardHeader>
            <CardTitle>6. Review & Save Onboarding</CardTitle>
            <CardDescription>
              Confirm your preferences before saving. Profile, consent, and session state update atomically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-craft-surface border border-craft-border">
              <div>
                <span className="text-craft-subtle block">Display Name:</span>
                <span className="font-semibold text-craft-ink">{displayName}</span>
              </div>
              <div>
                <span className="text-craft-subtle block">Mode Selected:</span>
                <Badge variant="ember">{modesSelected}</Badge>
              </div>
              <div>
                <span className="text-craft-subtle block">Study Discovery:</span>
                <Badge variant={studyConsent ? 'success' : 'outline'}>
                  {studyConsent ? 'Active' : 'Disabled'}
                </Badge>
              </div>
              <div>
                <span className="text-craft-subtle block">Social Discovery:</span>
                <Badge variant={socialConsent ? 'success' : 'outline'}>
                  {socialConsent ? 'Active' : 'Disabled'}
                </Badge>
              </div>
            </div>

            {studyConsent && (
              <div className="p-3 rounded-lg bg-craft-surface border border-craft-border space-y-1">
                <span className="font-semibold text-craft-ink block">Enrolled Courses:</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCourses.map((c) => (
                    <Badge key={c.code} variant="mono">{c.code}: {c.name}</Badge>
                  ))}
                </div>
              </div>
            )}

            {socialConsent && selectedInterests.length > 0 && (
              <div className="p-3 rounded-lg bg-craft-surface border border-craft-border space-y-1">
                <span className="font-semibold text-craft-ink block">Interest Tags:</span>
                <div className="flex flex-wrap gap-1.5">
                  {selectedInterests.map((t) => (
                    <Badge key={t.id} variant="default">{t.name}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" size="sm" onClick={handlePrevStep} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
              Back
            </Button>
            <Button
              variant="ember"
              size="sm"
              onClick={handleSubmitOnboarding}
              isLoading={completeOnboardingMutation.isPending}
              rightIcon={<CheckCircle className="w-3.5 h-3.5" />}
            >
              Save & Complete Onboarding
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};
