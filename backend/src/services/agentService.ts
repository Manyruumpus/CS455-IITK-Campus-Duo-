import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { query } from '../config/db';
import { ActorContext, DomainError } from '../types';
import {
  ScoringEngine,
  CandidateSourceData,
  ViewerProfileData,
  CompatibilityScoreResult,
} from './scoringEngine';
import { getEnvConfig, LlmConfig } from '../config/env';
import { createHuggingFaceLlmClient } from './huggingFaceLlmClient';
import { createOllamaLlmClient } from './ollamaLlmClient';

export interface LlmCandidateInput {
  userId: string;
  displayName: string;
  score: number;
  groundedFacts: string[];
}

export interface LlmExplanationRequest {
  courseCode?: string;
  userPrompt?: string;
  candidates: LlmCandidateInput[];
}

export interface LlmCandidateExplanation {
  userId: string;
  explanation: string;
}

/**
 * Provider-neutral LLM client interface.
 */
export interface ILlmClient {
  generateExplanations(
    req: LlmExplanationRequest
  ): Promise<LlmCandidateExplanation[]>;
}

/**
 * Offline, deterministic template synthesizer (Default Fallback Client).
 * Formulates grounded explanations strictly from verified backend facts without network inference.
 */
export class TemplateLlmClient implements ILlmClient {
  async generateExplanations(
    req: LlmExplanationRequest
  ): Promise<LlmCandidateExplanation[]> {
    return req.candidates.map((c) => {
      let explanation = `Match score: ${c.score}/100.`;
      if (c.groundedFacts.length > 0) {
        explanation += ` Grounded compatibility: ${c.groundedFacts.join('; ')}.`;
      } else {
        explanation += ` General campus academic compatibility based on enrollment profile.`;
      }
      return {
        userId: c.userId,
        explanation,
      };
    });
  }
}

export interface AgentRecommendationItem {
  profile: {
    userId: string;
    displayName: string;
    department?: string;
    degree?: string;
    year?: number;
    studyStyle?: string;
    preferredPace?: string;
    courses?: any[];
    activeStatus?: string;
  };
  aiMatchScore: number;
  aiMatchReasons: string[];
  dataCompletenessScore: number;
  relationshipStatus: string;
  compatibilityBreakdown?: CompatibilityScoreResult;
}

export interface AgentMatchResult {
  queryId: string;
  status: 'COMPLETED' | 'FALLBACK';
  recommendations: AgentRecommendationItem[];
  suggestedAlternatives: AgentRecommendationItem[];
  fallbackReason?: string;
  generatedAt: string;
}

export class AgentService {
  private readonly scoringEngine = new ScoringEngine();
  private readonly candidatesSql: string;
  private readonly profileSql: string;
  private readonly primaryLlmClient?: ILlmClient;
  private readonly fallbackLlmClient: ILlmClient;
  private readonly llmConfigurationIssue?: string;

  constructor(
    primaryLlmClient?: ILlmClient,
    fallbackLlmClient: ILlmClient = new TemplateLlmClient(),
    llmConfig: LlmConfig = getEnvConfig().llm
  ) {
    this.fallbackLlmClient = fallbackLlmClient;
    if (primaryLlmClient) {
      this.primaryLlmClient = primaryLlmClient;
      this.llmConfigurationIssue = undefined;
    } else if (llmConfig.enabled) {
      if (llmConfig.provider === 'ollama') {
        this.primaryLlmClient = createOllamaLlmClient(llmConfig);
      } else {
        this.primaryLlmClient = createHuggingFaceLlmClient(llmConfig);
      }
      this.llmConfigurationIssue = llmConfig.configurationIssue ||
        (llmConfig.provider === 'huggingface' && !llmConfig.token ? 'Inference is enabled but HF_TOKEN is missing.' : undefined);
    } else {
      this.primaryLlmClient = undefined;
      this.llmConfigurationIssue = undefined;
    }

    const findDatabaseFile = (relPath: string): string => {
      const candidates = [
        path.resolve(process.cwd(), relPath),
        path.resolve(process.cwd(), '../', relPath),
        path.resolve(__dirname, '../../../', relPath),
        path.resolve(__dirname, '../../', relPath),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
      }
      throw new Error(`Could not find database query file: ${relPath}`);
    };

    this.candidatesSql = findDatabaseFile('database/queries/03_study_candidates.sql');
    this.profileSql = findDatabaseFile('database/queries/01_private_account_profile.sql');
  }

  /**
   * Allow-Listed Read Tool 1: Query eligible study candidates from PostgreSQL.
   * Strictly read-only; automatically excludes self, blocked users, opted-out accounts, and inactive accounts.
   */
  public async tool_get_eligible_candidates(
    viewerId: string,
    courseCode: string | null = null,
    limit: number = 10
  ): Promise<CandidateSourceData[]> {
    const clampedLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    const res = await query<CandidateSourceData>(this.candidatesSql, [
      viewerId,
      courseCode,
      null, // study_style
      null, // preferred_pace
      null, // search_term
      clampedLimit,
      null, // last_user_id cursor
    ]);
    return res.rows;
  }

  /**
   * Allow-Listed Read Tool 2: Load viewer private profile for matching baseline.
   */
  public async tool_get_viewer_profile(
    viewerId: string
  ): Promise<ViewerProfileData | null> {
    const res = await query<any>(this.profileSql, [viewerId]);
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      userId: r.user_id,
      displayName: r.display_name,
      studyStyle: r.study_style,
      preferredPace: r.preferred_pace,
      studyGoals: r.study_goals,
      preferredLocation: r.preferred_location,
      preferredTimes: r.preferred_times,
      courses: r.courses,
    };
  }

  /**
   * Validates that LLM-generated explanations do not hallucinate facts outside the approved grounded candidate facts.
   */
  private validateGrounding(
    explanations: LlmCandidateExplanation[],
    candidateMap: Map<string, { groundedFacts: string[]; displayName: string }>,
    userPrompt?: string
  ): boolean {
    const connectiveWords = new Set([
      'a', 'about', 'and', 'are', 'based', 'because', 'candidate', 'compatible',
      'for', 'has', 'have', 'is', 'match', 'matches', 'of', 'on', 'partner',
      'compatibility', 'grounded',
      'score', 'shared', 'shows', 'study', 'the', 'this', 'with', 'you',
      // Standard grammatical connectives, pronouns, and inflectional forms
      'in', 'an', 'to', 'as', 'by', 'that', 'which', 'scored', 'both', 'also',
      'aligns', 'align', 'well', 'requirement', 'requirements', 'environment',
      'course', 'courses', 'profile', 'eligible', 'studies', 'studying', 'student', 'students',
      'they', 'their', 'them', 'he', 'she', 'his', 'her',
      'interested', 'interest', 'interests', 'prefer', 'prefers', 'preferred',
      'support', 'peer', 'peers', 'can', 'will', 'session', 'sessions',
      'same', 'good', 'however', 'while', 'might', 'not', 'perfectly', 'could', 'create',
      'dynamic', 'making', 'who', 'but', 's', 'so', 'academic', 'goal', 'goals',
      'pace', 'style', 'class', 'ahead', 'standard', 'regular', 'focused', 'quiet', 'heavy', 'discussion',
      'share', 'result', 'results', 'high', 'strong', 'excellent', 'same',
    ]);
    const promptVocabulary = userPrompt
      ? (userPrompt.toLowerCase().match(/[a-z0-9]+/g) || [])
      : [];

    for (const exp of explanations) {
      const meta = candidateMap.get(exp.userId);
      if (!meta) return false; // Mentioned unknown candidate
      if (typeof exp.explanation !== 'string' || exp.explanation.length > 500) {
        return false;
      }

      // Simple hallucination guard: check for invented course codes or claims
      const forbiddenHallucinations = ['CS999', 'MTH999', 'admin', 'password', 'token'];
      for (const forbidden of forbiddenHallucinations) {
        if (exp.explanation.toLowerCase().includes(forbidden.toLowerCase())) {
          return false;
        }
      }

      const groundedVocabulary = new Set([
        ...(meta.groundedFacts.join(' ').toLowerCase().match(/[a-z0-9]+/g) || []),
        ...promptVocabulary,
      ]);
      const claims = exp.explanation.toLowerCase().match(/[a-z0-9]+/g) || [];
      if (
        claims.length === 0 ||
        claims.some(
          (word) =>
            !connectiveWords.has(word) &&
            !groundedVocabulary.has(word) &&
            !/^\d+$/.test(word)
        )
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Main Agent Recommendation Entrypoint
   * Executes bounded read-only pipeline:
   *  1. Authenticate caller & check STUDY consent
   *  2. Execute allow-listed read tools
   *  3. Calculate deterministic 35C+25T+20P+10L+10G scores
   *  4. Synthesize explanations via ILlmClient or Fallback
   *  5. Validate grounded outputs server-side
   */
  public async recommend(
    actor: ActorContext,
    options: {
      courseCode?: string;
      prompt?: string;
      limit?: number;
    }
  ): Promise<AgentMatchResult> {
    const queryId = crypto.randomUUID();
    const limit = options.limit || 10;
    const requestedCourseValue = options.courseCode?.trim() || '';
    const requestedCourse =
      requestedCourseValue.toUpperCase() === 'ALL' ? null : requestedCourseValue || null;

    // 1. Fetch viewer profile (checks active STUDY consent via 03_study_candidates.sql)
    const viewerProfile = await this.tool_get_viewer_profile(actor.userId);
    if (!viewerProfile) {
      throw new DomainError(
        'FORBIDDEN',
        403,
        'Viewer must have an active student profile with STUDY consent.'
      );
    }

    const effectiveViewer: ViewerProfileData = {
      ...viewerProfile,
      studyGoals: options.prompt?.trim() || viewerProfile.studyGoals,
    };

    // 2. Query candidates using allow-listed tool
    const candidateRows = await this.tool_get_eligible_candidates(
      actor.userId,
      requestedCourse,
      limit
    );

    // If exact course matches are empty and a course was requested, fetch broader alternatives
    let alternativeRows: CandidateSourceData[] = [];
    if (candidateRows.length === 0 && requestedCourse) {
      alternativeRows = await this.tool_get_eligible_candidates(
        actor.userId,
        null, // all courses
        limit
      );
    }

    // Helper to score and format candidate items
    const scoreCandidates = (
      rows: CandidateSourceData[]
    ): {
      items: AgentRecommendationItem[];
      llmInputs: LlmCandidateInput[];
      metaMap: Map<string, { groundedFacts: string[]; displayName: string }>;
    } => {
      const items: AgentRecommendationItem[] = [];
      const llmInputs: LlmCandidateInput[] = [];
      const metaMap = new Map<
        string,
        { groundedFacts: string[]; displayName: string }
      >();

      for (const c of rows) {
        const scoreResult = this.scoringEngine.calculateCompatibility(
          effectiveViewer,
          c
        );

        metaMap.set(c.user_id, {
          groundedFacts: scoreResult.groundedFacts,
          displayName: c.display_name,
        });

        llmInputs.push({
          userId: c.user_id,
          displayName: c.display_name,
          score: scoreResult.overallScore,
          groundedFacts: scoreResult.groundedFacts,
        });

        items.push({
          profile: {
            userId: c.user_id,
            displayName: c.display_name,
            department: c.department,
            degree: c.degree,
            year: c.year,
            studyStyle: c.study_style || undefined,
            preferredPace: c.preferred_pace || undefined,
            courses: c.courses || [],
            activeStatus: c.active_status,
          },
          aiMatchScore: scoreResult.overallScore,
          aiMatchReasons: scoreResult.groundedFacts,
          dataCompletenessScore: scoreResult.dataCompletenessScore,
          relationshipStatus: 'NONE',
          compatibilityBreakdown: scoreResult,
        });
      }

      // Sort by deterministic unrounded score descending
      items.sort(
        (a, b) =>
          (b.compatibilityBreakdown?.unroundedScore || b.aiMatchScore) -
          (a.compatibilityBreakdown?.unroundedScore || a.aiMatchScore)
      );

      return { items, llmInputs, metaMap };
    };

    const scoredPrimary = scoreCandidates(candidateRows);
    const scoredAlternatives = scoreCandidates(alternativeRows);

    // If no eligible candidates exist, return clean empty result without calling inference provider
    if (scoredPrimary.llmInputs.length + scoredAlternatives.llmInputs.length === 0) {
      return {
        queryId,
        status: 'COMPLETED',
        recommendations: [],
        suggestedAlternatives: [],
        generatedAt: new Date().toISOString(),
      };
    }

    // 4. LLM Explanation / Fallback
    let status: 'COMPLETED' | 'FALLBACK' = 'COMPLETED';
    let fallbackReason: string | undefined;

    const isLlmConfigured = Boolean(this.primaryLlmClient);
    let clientToUse: ILlmClient = this.primaryLlmClient || this.fallbackLlmClient;

    try {
      if (!isLlmConfigured) {
        status = 'FALLBACK';
        fallbackReason = this.llmConfigurationIssue ||
          'Inference provider offline. Deterministic algorithm recommendations provided.';
        clientToUse = this.fallbackLlmClient;
      }

      const explanations = await clientToUse.generateExplanations({
        courseCode: requestedCourse || undefined,
        userPrompt: options.prompt,
        candidates: scoredPrimary.llmInputs.concat(
          scoredAlternatives.llmInputs
        ),
      });

      // Grounding validation check
      const combinedMetaMap = new Map([
        ...scoredPrimary.metaMap,
        ...scoredAlternatives.metaMap,
      ]);

      const isGrounded = this.validateGrounding(
        explanations,
        combinedMetaMap,
        options.prompt
      );

      if (!isGrounded) {
        // Hallucination detected: revert to deterministic fallback
        status = 'FALLBACK';
        fallbackReason =
          'Model explanations failed grounding validation. Deterministic recommendations provided.';
        const fallbackExps =
          await this.fallbackLlmClient.generateExplanations({
            courseCode: requestedCourse || undefined,
            userPrompt: options.prompt,
            candidates: scoredPrimary.llmInputs.concat(
              scoredAlternatives.llmInputs
            ),
          });
        this.attachExplanations(
          scoredPrimary.items,
          fallbackExps
        );
        this.attachExplanations(
          scoredAlternatives.items,
          fallbackExps
        );
      } else {
        this.attachExplanations(scoredPrimary.items, explanations);
        this.attachExplanations(
          scoredAlternatives.items,
          explanations
        );
      }
    } catch (err: any) {
      // Graceful outage fallback on network failure, timeout, or parsing error
      status = 'FALLBACK';
      fallbackReason =
        'Inference provider offline. Deterministic algorithm recommendations provided.';

      const fallbackExps =
        await this.fallbackLlmClient.generateExplanations({
          courseCode: requestedCourse || undefined,
          userPrompt: options.prompt,
          candidates: scoredPrimary.llmInputs.concat(
            scoredAlternatives.llmInputs
          ),
        });

      this.attachExplanations(scoredPrimary.items, fallbackExps);
      this.attachExplanations(scoredAlternatives.items, fallbackExps);
    }

    return {
      queryId,
      status,
      recommendations: scoredPrimary.items,
      suggestedAlternatives: scoredAlternatives.items,
      fallbackReason,
      generatedAt: new Date().toISOString(),
    };
  }

  private attachExplanations(
    items: AgentRecommendationItem[],
    explanations: LlmCandidateExplanation[]
  ): void {
    const expMap = new Map(explanations.map((e) => [e.userId, e.explanation]));
    for (const item of items) {
      const exp = expMap.get(item.profile.userId);
      if (exp && !item.aiMatchReasons.includes(exp)) {
        item.aiMatchReasons.unshift(exp);
      }
    }
  }
}
