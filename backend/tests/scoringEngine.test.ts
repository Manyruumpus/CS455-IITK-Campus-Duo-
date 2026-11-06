import { describe, it, expect } from 'vitest';
import { ScoringEngine, ViewerProfileData, CandidateSourceData } from '../src/services/scoringEngine';

describe('ScoringEngine — Matching Formula (35C + 25T + 20P + 10L + 10G) & Renormalization', () => {
  const engine = new ScoringEngine();

  const baseViewer: ViewerProfileData = {
    userId: 'viewer-uuid-1',
    displayName: 'Viewer Student',
    courses: [{ code: 'CS455' }, { code: 'MTH101' }],
    preferredTimes: ['MORNING', 'EVENING'],
    studyStyle: 'QUIET_FOCUSED',
    preferredPace: 'STANDARD_REGULAR',
    preferredLocation: 'LIBRARY_2F',
    studyGoals: 'Operating systems and distributed algorithms',
  };

  const perfectCandidate: CandidateSourceData = {
    user_id: 'candidate-uuid-1',
    display_name: 'Perfect Match Peer',
    courses: [{ code: 'CS455' }, { code: 'MTH101' }],
    preferred_times: ['MORNING', 'EVENING'],
    study_style: 'QUIET_FOCUSED',
    preferred_pace: 'STANDARD_REGULAR',
    preferred_location: 'LIBRARY_2F',
    study_goals: 'Operating systems and distributed algorithms',
    active_status: 'ACTIVE',
  };

  describe('1. Full Profile Compatibility (35C + 25T + 20P + 10L + 10G)', () => {
    it('produces score 100 and completeness 1.00 for identical profiles across all 6 factors', () => {
      const result = engine.calculateCompatibility(baseViewer, perfectCandidate);

      expect(result.activeBaseWeightTotal).toBe(100);
      expect(result.dataCompletenessScore).toBe(1.0);
      expect(result.overallScore).toBe(100);
      expect(result.omittedFactors).toHaveLength(0);

      // Verify base weights
      expect(result.factors.course.baseWeight).toBe(35);
      expect(result.factors.time.baseWeight).toBe(25);
      expect(result.factors.style?.baseWeight).toBe(10);
      expect(result.factors.pace?.baseWeight).toBe(10);
      expect(result.factors.location?.baseWeight).toBe(10);
      expect(result.factors.goals?.baseWeight).toBe(10);

      // Verify effective weights equal base weights when all 100 points active
      expect(result.factors.course.effectiveWeight).toBe(35);
      expect(result.factors.time.effectiveWeight).toBe(25);
      expect(result.factors.style?.effectiveWeight).toBe(10);
      expect(result.factors.pace?.effectiveWeight).toBe(10);
      expect(result.factors.location?.effectiveWeight).toBe(10);
      expect(result.factors.goals?.effectiveWeight).toBe(10);

      expect(result.groundedFacts).toContain('Identical study style: quiet focused');
      expect(result.groundedFacts).toContain('Aligned study pace: standard regular');
      expect(result.groundedFacts).toContain('Common study location preference');
      expect(result.groundedFacts).toContain('Academic goal compatibility');
    });
  });

  describe('2. Active Weight Renormalization When Optional Factors Are Omitted', () => {
    it('correctly renormalizes base weights when optional factors (P, L, G) are absent', () => {
      const minimalViewer: ViewerProfileData = {
        userId: 'viewer-min',
        displayName: 'Minimal Viewer',
        courses: [{ code: 'CS455' }],
        preferredTimes: ['EVENING'],
      };

      const minimalCandidate: CandidateSourceData = {
        user_id: 'candidate-min',
        display_name: 'Minimal Candidate',
        courses: [{ code: 'CS455' }],
        preferred_times: ['EVENING'],
        active_status: 'ACTIVE',
      };

      const result = engine.calculateCompatibility(minimalViewer, minimalCandidate);

      // Only Course (35) and Time (25) are active -> activeBaseWeightTotal = 60
      expect(result.activeBaseWeightTotal).toBe(60);
      expect(result.dataCompletenessScore).toBe(0.6);
      expect(result.omittedFactors).toEqual(['Study Style', 'Study Pace', 'Preferred Location', 'Study Goals']);

      // Renormalized effective weights must sum to 100%
      // Course: (35 / 60) * 100 = 58.3%
      // Time:   (25 / 60) * 100 = 41.7%
      expect(result.factors.course.effectiveWeight).toBeCloseTo(58.3, 1);
      expect(result.factors.time.effectiveWeight).toBeCloseTo(41.7, 1);
      expect(result.overallScore).toBe(100);
    });

    it('renormalizes partially when only some optional factors are provided', () => {
      const partialViewer: ViewerProfileData = {
        userId: 'viewer-partial',
        displayName: 'Partial Viewer',
        courses: [{ code: 'CS455' }],
        preferredTimes: ['EVENING'],
        studyStyle: 'QUIET_FOCUSED',
      };

      const partialCandidate: CandidateSourceData = {
        user_id: 'candidate-partial',
        display_name: 'Partial Candidate',
        courses: [{ code: 'CS455' }],
        preferred_times: ['EVENING'],
        study_style: 'QUIET_FOCUSED',
        active_status: 'ACTIVE',
      };

      const result = engine.calculateCompatibility(partialViewer, partialCandidate);

      // 35 (C) + 25 (T) + 10 (Style) = 70 active base weight
      expect(result.activeBaseWeightTotal).toBe(70);
      expect(result.dataCompletenessScore).toBe(0.7);

      // Effective weights: 35/70 = 50%, 25/70 = 35.7%, 10/70 = 14.3%
      expect(result.factors.course.effectiveWeight).toBe(50);
      expect(result.factors.time.effectiveWeight).toBeCloseTo(35.7, 1);
      expect(result.factors.style?.effectiveWeight).toBeCloseTo(14.3, 1);
    });
  });

  describe('3. Study Style as Soft Preference (Not a Hard Filter)', () => {
    it('treats different study styles as soft compatibility factors rather than disqualifying candidates', () => {
      const polarizedCandidate: CandidateSourceData = {
        ...perfectCandidate,
        study_style: 'DISCUSSION_HEAVY', // Polarized from QUIET_FOCUSED
      };

      const result = engine.calculateCompatibility(baseViewer, polarizedCandidate);

      // Candidate is NOT rejected; score reflects style divergence (0.3 norm * 10 = 3 pts vs 10 pts)
      expect(result.overallScore).toBe(93); // 35 + 25 + 3 + 10 + 10 + 10 = 93
      expect(result.factors.style?.normalizedScore).toBe(0.3);
      expect(result.factors.style?.explanation).toBe('Style: discussion heavy');
    });

    it('awards 0.8 compatibility score when either partner has HYBRID study style', () => {
      const hybridCandidate: CandidateSourceData = {
        ...perfectCandidate,
        study_style: 'HYBRID',
      };

      const result = engine.calculateCompatibility(baseViewer, hybridCandidate);
      expect(result.factors.style?.normalizedScore).toBe(0.8);
      expect(result.overallScore).toBe(98); // 35 + 25 + 8 + 10 + 10 + 10 = 98
    });
  });

  describe('4. Study Goal Jaccard Overlap and Mismatch Handling', () => {
    it('scores 0 on goals when user prompt and candidate goals share no vocabulary, reducing total score below 100', () => {
      const astronomyViewer: ViewerProfileData = {
        ...baseViewer,
        studyGoals: 'I want to study astronomy',
      };

      const mathCandidate: CandidateSourceData = {
        ...perfectCandidate,
        study_goals: 'Work through foundational mathematics',
      };

      const result = engine.calculateCompatibility(astronomyViewer, mathCandidate);

      // Goals have 0 keyword overlap -> goalsNorm = 0.0
      expect(result.factors.goals?.normalizedScore).toBe(0);
      expect(result.factors.goals?.weightedScore).toBe(0);
      expect(result.overallScore).toBe(90); // 35 + 25 + 10 + 10 + 10 + 0 = 90
      expect(result.groundedFacts).not.toContain('Academic goal compatibility');
    });

    it('computes positive Jaccard overlap when goals share keywords', () => {
      const algorithmsViewer: ViewerProfileData = {
        ...baseViewer,
        studyGoals: 'Graph algorithms and dynamic programming',
      };

      const candidateWithSharedGoals: CandidateSourceData = {
        ...perfectCandidate,
        study_goals: 'Advanced algorithms and competitive coding',
      };

      const result = engine.calculateCompatibility(algorithmsViewer, candidateWithSharedGoals);

      // Shared keyword: "algorithms"
      expect(result.factors.goals?.normalizedScore).toBeGreaterThan(0);
      expect(result.groundedFacts).toContain('Academic goal compatibility');
    });
  });
});
