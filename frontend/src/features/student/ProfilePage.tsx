import React, { useState } from 'react';
import {
  ShieldCheck,
  Save,
  RotateCcw,
  AlertTriangle,
  Eye,
  Edit3,
  CheckCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import {
  usePrivateProfile,
  useUpdateProfile,
  usePublicStudyProfilePreview,
  usePublicSocialProfilePreview,
} from '@/queries/profileHooks';
import {
  PrivateUserProfile,
  CourseEnrollment,
  PreferredStudyTime,
  StudyStyle,
  TargetPace,
  SocialInterestTag,
  AppError,
} from '@/types';

const AVAILABLE_COURSES: CourseEnrollment[] = [
  { code: 'CS455', name: 'Computer Networks', department: 'CSE' },
  { code: 'MTH101', name: 'Mathematics I', department: 'MTH' },
  { code: 'ESC102', name: 'Introduction to Electronics', department: 'EE' },
  { code: 'CS632', name: 'Advanced Compilers', department: 'CSE' },
];

const AVAILABLE_TAGS: SocialInterestTag[] = [
  { id: 'tag-robotics', name: 'Robotics', category: 'TECH_ACADEMIC' },
  { id: 'tag-chess', name: 'Chess Club', category: 'SPORTS_FITNESS' },
  { id: 'tag-music', name: 'Western Music', category: 'CULTURAL_ARTS' },
  { id: 'tag-table-tennis', name: 'Table Tennis', category: 'SPORTS_FITNESS' },
  { id: 'tag-drones', name: 'Aeromodelling', category: 'TECH_ACADEMIC' },
];

interface ProfileEditFormProps {
  profile: PrivateUserProfile;
}

const ProfileEditForm: React.FC<ProfileEditFormProps> = ({ profile }) => {
  const { addToast } = useToast();
  const updateProfileMutation = useUpdateProfile();

  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [selectedCourses, setSelectedCourses] = useState<CourseEnrollment[]>(profile.courses || []);
  const [preferredTimes, setPreferredTimes] = useState<PreferredStudyTime[]>(
    profile.studyPreferences?.preferredTimes || []
  );
  const [studyStyle, setStudyStyle] = useState<StudyStyle>(
    profile.studyPreferences?.studyStyle || 'QUIET_FOCUSED'
  );
  const [preferredPace, setPreferredPace] = useState<TargetPace>(
    profile.studyPreferences?.preferredPace || 'STANDARD_REGULAR'
  );
  const [socialBio, setSocialBio] = useState(profile.socialBio || '');
  const [selectedInterests, setSelectedInterests] = useState<SocialInterestTag[]>(
    profile.socialInterests || []
  );

  const [fieldErrors, setFieldErrors] = useState<{ displayName?: string }>({});

  const resetForm = () => {
    setDisplayName(profile.displayName || '');
    setSelectedCourses(profile.courses || []);
    setPreferredTimes(profile.studyPreferences?.preferredTimes || []);
    setStudyStyle(profile.studyPreferences?.studyStyle || 'QUIET_FOCUSED');
    setPreferredPace(profile.studyPreferences?.preferredPace || 'STANDARD_REGULAR');
    setSocialBio(profile.socialBio || '');
    setSelectedInterests(profile.socialInterests || []);
    setFieldErrors({});
  };

  const isDirty = Boolean(
    displayName !== (profile.displayName || '') ||
      socialBio !== (profile.socialBio || '') ||
      studyStyle !== (profile.studyPreferences?.studyStyle || 'QUIET_FOCUSED') ||
      preferredPace !== (profile.studyPreferences?.preferredPace || 'STANDARD_REGULAR') ||
      JSON.stringify(selectedCourses.map((c) => c.code).sort()) !==
        JSON.stringify((profile.courses || []).map((c) => c.code).sort()) ||
      JSON.stringify([...preferredTimes].sort()) !==
        JSON.stringify([...(profile.studyPreferences?.preferredTimes || [])].sort()) ||
      JSON.stringify(selectedInterests.map((i) => i.id).sort()) !==
        JSON.stringify((profile.socialInterests || []).map((i) => i.id).sort())
  );

  const handleSave = () => {
    const errors: { displayName?: string } = {};
    if (!displayName.trim()) {
      errors.displayName = 'Display name cannot be empty.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    updateProfileMutation.mutate(
      {
        displayName: displayName.trim(),
        courses: selectedCourses,
        studyPreferences: {
          studyStyle,
          preferredPace,
          preferredTimes,
        },
        socialBio: socialBio.trim() ? socialBio.trim() : undefined,
        socialInterests: selectedInterests,
      },
      {
        onSuccess: () => {
          addToast({
            type: 'success',
            title: 'Profile Saved',
            description: 'Your profile changes have been saved successfully.',
          });
        },
        onError: (err) => {
          addToast({
            type: 'error',
            title: 'Save Failed',
            description: err instanceof AppError ? err.message : 'Failed to save changes.',
          });
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
    <div className="space-y-6">
      {/* Section 1: Read-Only Academic Fixtures (Amendment 1) */}
      <Card variant="craft">
        <CardHeader>
          <CardTitle>Academic Enrollment Details</CardTitle>
          <CardDescription>
            Demo fixture data. Production credential source and edit policy remain unresolved (DEC-05).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="profile-email"
              label="Campus Email (Read-Only Demo Fixture)"
              value={profile.email}
              disabled
            />
            <Input
              id="profile-roll"
              label="Roll Number (Read-Only Demo Fixture)"
              value={profile.rollNumber}
              disabled
            />
            <Input
              id="profile-dept"
              label="Department (Read-Only Demo Fixture)"
              value={profile.department}
              disabled
            />
            <Input
              id="profile-degree"
              label="Degree & Year (Read-Only Demo Fixture)"
              value={`${profile.degree} (Year ${profile.year})`}
              disabled
            />
          </div>

          <div className="p-3 rounded-md bg-craft-surface border border-craft-border text-[11px] text-craft-muted flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-craft-ink">Protected Identity Invariant:</span>
              <p className="mt-0.5">
                Official academic fields cannot be altered from the client. Direct mutations targeting identity, role, or ownership fields are strictly rejected by the service adapter.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Editable Identity & Display Preferences */}
      <Card variant="craft">
        <CardHeader>
          <CardTitle>Personal & Academic Study Preferences</CardTitle>
          <CardDescription>
            Update your public display name, courses, study style, and availability windows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Input
              id="profile-display-name"
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              errorMessage={fieldErrors.displayName}
              placeholder="Your preferred name"
            />
            <p className="text-[11px] text-craft-subtle">
              Visible to other students across campus discovery feeds.
            </p>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-craft-border">
            <label className="block text-xs font-medium text-craft-ink">
              Enrolled Courses
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_COURSES.map((c) => {
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
          </div>

          <div className="space-y-1.5 pt-2 border-t border-craft-border">
            <label className="block text-xs font-medium text-craft-ink">
              Preferred Study Times
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-craft-border text-xs">
            <div>
              <label className="block text-[11px] text-craft-muted mb-1">Study Style</label>
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
              <label className="block text-[11px] text-craft-muted mb-1">Preferred Pace</label>
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
        </CardContent>
      </Card>

      {/* Section 3: Generic Social Preferences */}
      <Card variant="craft">
        <CardHeader>
          <CardTitle>Campus Social Bio & Interests</CardTitle>
          <CardDescription>
            Configure extracurricular tags and introductory biography.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="profile-social-bio" className="block text-xs font-medium text-craft-ink">
              Social Biography
            </label>
            <textarea
              id="profile-social-bio"
              rows={3}
              value={socialBio}
              onChange={(e) => setSocialBio(e.target.value)}
              placeholder="Share your campus activities, hobby clubs, or sports interests..."
              className="w-full p-2.5 rounded-lg bg-craft-surface border border-craft-border text-craft-ink text-xs focus:outline-none focus:ring-1 focus:ring-ember-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-craft-ink">
              Extracurricular Interest Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_TAGS.map((tag) => {
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
        <CardFooter className="flex justify-between items-center">
          <div>
            {isDirty && (
              <span className="text-xs text-amber-400 font-medium flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetForm}
              disabled={!isDirty || updateProfileMutation.isPending}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Cancel & Reset
            </Button>
            <Button
              variant="ember"
              size="sm"
              onClick={handleSave}
              disabled={!isDirty}
              isLoading={updateProfileMutation.isPending}
              leftIcon={<Save className="w-3.5 h-3.5" />}
            >
              Save Profile
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export const ProfilePage: React.FC = () => {
  const { data: profile, isLoading, isError, error } = usePrivateProfile();
  const { data: studyPreview } = usePublicStudyProfilePreview();
  const { data: socialPreview } = usePublicSocialProfilePreview();

  const [activeTab, setActiveTab] = useState<'EDIT' | 'PREVIEW'>('EDIT');

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs text-craft-muted">
        Loading student profile...
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="p-6 rounded-lg bg-red-950/30 border border-red-500/40 text-xs text-red-200">
        <p className="font-semibold">Unable to Load Profile</p>
        <p className="text-[11px] text-red-300 mt-1">
          {error instanceof AppError ? error.message : 'Please check your connection and sign-in status.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Student Profile"
        subtitle="Manage editable display information, academic preferences, and preview your public cards."
        breadcrumbs={[
          { label: 'Dashboard', href: '/app/dashboard' },
          { label: 'Profile', isCurrent: true },
        ]}
      />

      {/* Mode Tabs */}
      <div className="flex border-b border-craft-border gap-2 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('EDIT')}
          className={`px-4 py-2 font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'EDIT'
              ? 'border-ember-500 text-ember-400'
              : 'border-transparent text-craft-muted hover:text-craft-ink'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5" />
          <span>Edit Profile</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('PREVIEW')}
          className={`px-4 py-2 font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'PREVIEW'
              ? 'border-ember-500 text-ember-400'
              : 'border-transparent text-craft-muted hover:text-craft-ink'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Public Previews</span>
        </button>
      </div>

      {activeTab === 'EDIT' && (
        <ProfileEditForm key={profile.userId + (profile.displayName ?? '')} profile={profile} />
      )}

      {/* TAB 2: Self-Public Preview (Amendment 4) */}
      {activeTab === 'PREVIEW' && (
        <div className="space-y-6">
          <div className="p-3.5 rounded-lg bg-craft-surface border border-craft-border text-xs space-y-1">
            <span className="font-semibold text-craft-ink flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-ember-400" />
              Permission-Filtered Public Previews
            </span>
            <p className="text-craft-muted text-[11px] leading-relaxed">
              These views demonstrate how other authenticated students perceive your profile in public discovery feeds. Verified credentials (roll number, email, phone) and internal recommendation scores are strictly excluded.
            </p>
          </div>

          {/* Academic Study Public Card Preview */}
          <Card variant="craft">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Academic Study Card Preview</CardTitle>
                <Badge
                  variant={studyPreview?.isDiscoverable ? 'success' : 'outline'}
                  className="text-[10px]"
                >
                  {studyPreview?.isDiscoverable ? 'Active in Discovery' : 'Preview only — not currently discoverable'}
                </Badge>
              </div>
              <CardDescription>
                Card displayed to peers in course search results.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {studyPreview?.profile ? (
                <div className="p-4 rounded-lg bg-craft-base border border-craft-border space-y-2 text-xs">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm text-craft-ink">
                        {studyPreview.profile.displayName}
                      </p>
                      <p className="text-[11px] text-craft-muted">
                        {studyPreview.profile.department} • {studyPreview.profile.degree}
                      </p>
                    </div>
                    <Badge variant="mono">{studyPreview.profile.studyStyle}</Badge>
                  </div>

                  <div>
                    <span className="text-[11px] text-craft-subtle block">Enrolled Courses:</span>
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                      {studyPreview.profile.courses.map((c) => (
                        <Badge key={c.code} variant="mono">
                          {c.code}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-craft-subtle block">Preferred Times:</span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {studyPreview.profile.preferredTimes.map((t) => (
                        <span key={t} className="text-[10px] text-craft-muted bg-craft-surface px-2 py-0.5 rounded border border-craft-border">
                          {t.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-craft-muted">Preview unavailable.</p>
              )}
            </CardContent>
          </Card>

          {/* Campus Social Public Card Preview */}
          <Card variant="craft">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Campus Social Card Preview</CardTitle>
                <Badge
                  variant={socialPreview?.isDiscoverable ? 'success' : 'outline'}
                  className="text-[10px]"
                >
                  {socialPreview?.isDiscoverable ? 'Active in Discovery' : 'Preview only — not currently discoverable'}
                </Badge>
              </div>
              <CardDescription>
                Card displayed to peers in campus extracurricular directory.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {socialPreview?.profile ? (
                <div className="p-4 rounded-lg bg-craft-base border border-craft-border space-y-2 text-xs">
                  <div>
                    <p className="font-semibold text-sm text-craft-ink">
                      {socialPreview.profile.displayName}
                    </p>
                    <p className="text-[11px] text-craft-muted italic mt-0.5">
                      "{socialPreview.profile.bio || 'No public bio provided'}"
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] text-craft-subtle block">Interests:</span>
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                      {socialPreview.profile.interests.map((t) => (
                        <Badge key={t.id} variant="default">
                          {t.name}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="p-2 rounded bg-craft-surface border border-craft-border text-[10px] text-craft-muted flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Contact handles, phone numbers, and emails are strictly omitted.</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-craft-muted">Social preview unavailable.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
