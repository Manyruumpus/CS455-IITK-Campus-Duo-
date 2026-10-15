/**
 * Deterministic Compatibility Scoring Engine
 * Implements the IITK CS455 Campus Duo matching formula:
 *   35C + 25T + 20P + 10L + 10G
 *
 * Grounded in:
 * - 01-requirements-and-use-cases.md (Section 5, Scoring contract)
 * - D2_implementation_plan.txt (Section E)
 * - 02-architecture-and-design.md (Section 4)
 */

export interface ProfileCourseInfo {
  courseId?: string;
  code: string;
  name?: string;
}

export interface CandidateSourceData {
  user_id: string;
  display_name: string;
  department?: string;
  degree?: string;
  year?: number;
  study_style?: string | null;
  preferred_pace?: string | null;
  study_goals?: string | null;
  preferred_location?: string | null;
  preferred_times?: string[] | null;
  courses?: ProfileCourseInfo[] | null;
  active_status?: string;
}

export interface ViewerProfileData {
  userId: string;
  displayName: string;
  studyStyle?: string | null;
  preferredPace?: string | null;
  studyGoals?: string | null;
  preferredLocation?: string | null;
  preferredTimes?: string[] | null;
  courses?: ProfileCourseInfo[] | null;
}

export interface FactorContribution {
  name: string;
  baseWeight: number;
  effectiveWeight: number; // Renormalized active weight
  normalizedScore: number; // 0.00 - 1.00
  weightedScore: number;   // effectiveWeight * normalizedScore
  explanation: string;
}

export interface CompatibilityScoreResult {
  overallScore: number; // 0 - 100 integer
  unroundedScore: number;
  activeBaseWeightTotal: number; // 60 - 100
  dataCompletenessScore: number; // 0.60 - 1.00
  groundedFacts: string[];
  omittedFactors: string[];
  factors: {
    course: FactorContribution;
    time: FactorContribution;
    style?: FactorContribution;
    pace?: FactorContribution;
    location?: FactorContribution;
    goals?: FactorContribution;
  };
}

export class ScoringEngine {
  /**
   * Computes the deterministic compatibility score between a viewer and an eligible candidate.
   * Baseline Weights:
   *   C = 35 (Course overlap Jaccard)
   *   T = 25 (Weekly time slot overlap / min availability set size)
   *   P = 20 (Study style 10 + pace 10 agreement)
   *   L = 10 (Preferred location match)
   *   G = 10 (Study goals match)
   *
   * Renormalization:
   *   score = 100 * Σ(weight_i * factor_i for available i) / Σ(weight_i for available i)
   */
  public calculateCompatibility(
    viewer: ViewerProfileData,
    candidate: CandidateSourceData
  ): CompatibilityScoreResult {
    const groundedFacts: string[] = [];
    const omittedFactors: string[] = [];

    // --- Factor 1: Course Overlap (C = 35, Always active) ---
    const viewerCourses = new Set(
      (viewer.courses || []).map((c) => c.code.trim().toUpperCase())
    );
    const candidateCourses = new Set(
      (candidate.courses || []).map((c) => c.code.trim().toUpperCase())
    );

    const sharedCourses: string[] = [];
    for (const c of viewerCourses) {
      if (candidateCourses.has(c)) {
        sharedCourses.push(c);
      }
    }

    const unionCourses = new Set([...viewerCourses, ...candidateCourses]);
    const courseNorm =
      unionCourses.size > 0 ? sharedCourses.length / unionCourses.size : 0.0;

    if (sharedCourses.length > 0) {
      groundedFacts.push(`Shared courses: ${sharedCourses.join(', ')}`);
    }

    // --- Factor 2: Time Availability (T = 25, Always active) ---
    const viewerTimes = new Set(viewer.preferredTimes || []);
    const candidateTimes = new Set(candidate.preferred_times || []);

    const sharedTimes: string[] = [];
    for (const t of viewerTimes) {
      if (candidateTimes.has(t)) {
        sharedTimes.push(t);
      }
    }

    const minTimesSize = Math.min(viewerTimes.size, candidateTimes.size);
    const timeNorm =
      minTimesSize > 0 ? sharedTimes.length / minTimesSize : 0.0;

    if (sharedTimes.length > 0) {
      groundedFacts.push(
        `Overlapping study slots: ${sharedTimes.map((t) => t.toLowerCase()).join(', ')}`
      );
    }

    // --- Factor 3: Study Style (Base weight 10, Optional) ---
    const viewerStyle = viewer.studyStyle?.trim();
    const candidateStyle = candidate.study_style?.trim();
    const hasStyle = Boolean(viewerStyle && candidateStyle);
    let styleNorm = 0.0;

    if (hasStyle) {
      if (viewerStyle!.toUpperCase() === candidateStyle!.toUpperCase()) {
        styleNorm = 1.0;
        groundedFacts.push(
          `Identical study style: ${candidateStyle!.toLowerCase().replace(/_/g, ' ')}`
        );
      } else {
        styleNorm = 0.3; // Adjacent/compatible style
        groundedFacts.push(
          `Study style: ${candidateStyle!.toLowerCase().replace(/_/g, ' ')}`
        );
      }
    } else {
      omittedFactors.push('Study Style');
    }

    // --- Factor 4: Study Pace (Base weight 10, Optional) ---
    const viewerPace = viewer.preferredPace?.trim();
    const candidatePace = candidate.preferred_pace?.trim();
    const hasPace = Boolean(viewerPace && candidatePace);
    let paceNorm = 0.0;

    if (hasPace) {
      if (viewerPace!.toUpperCase() === candidatePace!.toUpperCase()) {
        paceNorm = 1.0;
        groundedFacts.push(
          `Aligned study pace: ${candidatePace!.toLowerCase().replace(/_/g, ' ')}`
        );
      } else {
        paceNorm = 0.4;
        groundedFacts.push(
          `Study pace: ${candidatePace!.toLowerCase().replace(/_/g, ' ')}`
        );
      }
    } else {
      omittedFactors.push('Study Pace');
    }

    // --- Factor 5: Preferred Location (Base weight 10, Optional) ---
    const viewerLoc = viewer.preferredLocation?.trim();
    const candidateLoc = candidate.preferred_location?.trim();
    const hasLocation = Boolean(viewerLoc && candidateLoc);
    let locNorm = 0.0;

    if (hasLocation) {
      if (viewerLoc!.toUpperCase() === candidateLoc!.toUpperCase()) {
        locNorm = 1.0;
        groundedFacts.push(`Common preferred location: ${candidateLoc}`);
      } else {
        locNorm = 0.4;
      }
    } else {
      omittedFactors.push('Preferred Location');
    }

    // --- Factor 6: Study Goals (Base weight 10, Optional) ---
    const viewerGoals = viewer.studyGoals?.trim();
    const candidateGoals = candidate.study_goals?.trim();
    const hasGoals = Boolean(viewerGoals && candidateGoals);
    let goalsNorm = 0.0;

    if (hasGoals) {
      if (viewerGoals!.trim().toLowerCase() === candidateGoals!.trim().toLowerCase()) {
        goalsNorm = 1.0;
      } else {
        const vWords = new Set(viewerGoals!.toLowerCase().split(/\s+/).filter(Boolean));
        const cWords = new Set(candidateGoals!.toLowerCase().split(/\s+/).filter(Boolean));
        let common = 0;
        for (const w of vWords) if (cWords.has(w)) common++;
        const union = new Set([...vWords, ...cWords]).size;
        goalsNorm = union > 0 ? Math.max(0.4, common / union) : 0.8;
      }
      groundedFacts.push(`Active academic goal: ${candidateGoals}`);
    } else {
      omittedFactors.push('Study Goals');
    }

    // --- Renormalization Computation ---
    const activeBaseWeightTotal =
      35 +
      25 +
      (hasStyle ? 10 : 0) +
      (hasPace ? 10 : 0) +
      (hasLocation ? 10 : 0) +
      (hasGoals ? 10 : 0);

    const dataCompletenessScore = Number(
      (activeBaseWeightTotal / 100).toFixed(2)
    );

    const createFactor = (
      name: string,
      baseWeight: number,
      normalizedScore: number,
      explanation: string
    ): FactorContribution => {
      const effectiveWeight = (baseWeight / activeBaseWeightTotal) * 100;
      const weightedScore = Number(
        ((effectiveWeight * normalizedScore)).toFixed(1)
      );
      return {
        name,
        baseWeight,
        effectiveWeight: Number(effectiveWeight.toFixed(1)),
        normalizedScore: Number(normalizedScore.toFixed(2)),
        weightedScore,
        explanation,
      };
    };

    const courseFactor = createFactor(
      'Course Overlap',
      35,
      courseNorm,
      sharedCourses.length > 0
        ? `Shared courses: ${sharedCourses.join(', ')}`
        : 'No shared enrolled courses'
    );

    const timeFactor = createFactor(
      'Time Availability',
      25,
      timeNorm,
      sharedTimes.length > 0
        ? `Overlapping study slots: ${sharedTimes.join(', ')}`
        : 'No overlapping weekly study windows'
    );

    const styleFactor = hasStyle
      ? createFactor(
          'Study Style',
          10,
          styleNorm,
          `Style: ${candidateStyle!.toLowerCase().replace(/_/g, ' ')}`
        )
      : undefined;

    const paceFactor = hasPace
      ? createFactor(
          'Study Pace',
          10,
          paceNorm,
          `Pace: ${candidatePace!.toLowerCase().replace(/_/g, ' ')}`
        )
      : undefined;

    const locationFactor = hasLocation
      ? createFactor(
          'Preferred Location',
          10,
          locNorm,
          `Location: ${candidateLoc}`
        )
      : undefined;

    const goalsFactor = hasGoals
      ? createFactor(
          'Study Goals',
          10,
          goalsNorm,
          `Goal: ${candidateGoals}`
        )
      : undefined;

    const activeWeightedSum =
      35 * courseNorm +
      25 * timeNorm +
      (hasStyle ? 10 * styleNorm : 0) +
      (hasPace ? 10 * paceNorm : 0) +
      (hasLocation ? 10 * locNorm : 0) +
      (hasGoals ? 10 * goalsNorm : 0);

    const unroundedScore =
      (activeWeightedSum / activeBaseWeightTotal) * 100;
    const overallScore = Math.min(
      100,
      Math.max(0, Math.round(unroundedScore))
    );

    return {
      overallScore,
      unroundedScore,
      activeBaseWeightTotal,
      dataCompletenessScore,
      groundedFacts,
      omittedFactors,
      factors: {
        course: courseFactor,
        time: timeFactor,
        style: styleFactor,
        pace: paceFactor,
        location: locationFactor,
        goals: goalsFactor,
      },
    };
  }
}
