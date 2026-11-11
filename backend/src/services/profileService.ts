import { getClient } from '../config/db';
import { ProfileRepository, DbProfileRow } from '../repository/profileRepo';
import {
  PrivateUserProfile,
  ProfileUpdateRequest,
  StudyStyle,
  TargetPace,
  PreferredStudyTime,
  DomainError,
} from '../types';

const PROTECTED_FIELDS = [
  'userId',
  'email',
  'rollNumber',
  'department',
  'degree',
  'year',
  'isOnboarded',
  'role',
  'studyConsent',
  'socialConsent',
];

const VALID_STYLES = new Set<string>(['QUIET_FOCUSED', 'DISCUSSION_HEAVY', 'PROBLEM_SOLVING', 'HYBRID']);
const VALID_PACES = new Set<string>(['AHEAD_OF_CLASS', 'STANDARD_REGULAR', 'EXAM_CRAMMING']);
const VALID_TIMES = new Set<string>(['MORNING', 'AFTERNOON', 'EVENING', 'LATE_NIGHT']);

export class ProfileService {
  private readonly repo: ProfileRepository;

  constructor(repo?: ProfileRepository) {
    this.repo = repo ?? new ProfileRepository();
  }

  private mapRowToPrivateProfile(row: DbProfileRow): PrivateUserProfile {
    const consents = row.consents || {};
    return {
      userId: row.user_id,
      email: row.email,
      rollNumber: row.roll_number || '210000',
      displayName: row.display_name,
      department: row.department || 'Engineering',
      degree: row.degree || 'B.Tech',
      year: row.year ?? 4,
      isOnboarded: row.is_onboarded === true,
      studyPreferences: {
        studyStyle: (row.study_style as StudyStyle) || 'QUIET_FOCUSED',
        preferredPace: (row.preferred_pace as TargetPace) || 'STANDARD_REGULAR',
        preferredTimes: Array.isArray(row.preferred_times) ? (row.preferred_times as PreferredStudyTime[]) : [],
        studyGoals: row.study_goals || '',
        preferredLocation: row.preferred_location || '',
      },
      courses: Array.isArray(row.courses) ? row.courses : [],
      socialBio: row.social_bio || '',
      socialInterests: Array.isArray(row.social_interests) ? row.social_interests : [],
      studyConsent: consents.STUDY || { hasConsent: false },
      socialConsent: consents.SOCIAL || { hasConsent: false },
    };
  }

  public async getProfile(userId: string): Promise<PrivateUserProfile> {
    let row = await this.repo.findPrivateProfileRow(userId);
    if (!row) {
      // Check if user account exists at all
      const client = await getClient();
      try {
        const uRes = await client.query(`SELECT user_id FROM campus_duo.user_account WHERE user_id = $1`, [userId]);
        if (uRes.rows.length === 0) {
          throw new DomainError('NOT_FOUND', 404, 'User identity record not found.');
        }
        await this.repo.ensureStudentProfileRow(userId, client);
      } finally {
        client.release();
      }
      row = await this.repo.findPrivateProfileRow(userId);
      if (!row) {
        throw new DomainError('NOT_FOUND', 404, 'User identity record not found.');
      }
    }
    return this.mapRowToPrivateProfile(row);
  }

  public async updateProfile(userId: string, update: ProfileUpdateRequest): Promise<PrivateUserProfile> {
    const rawReq = update as Record<string, unknown>;
    for (const field of PROTECTED_FIELDS) {
      if (rawReq[field] !== undefined) {
        throw new DomainError(
          'VALIDATION_ERROR',
          400,
          `Cannot modify protected identity or metadata field '${field}'. Identity fields are read-only demo fixtures.`
        );
      }
    }

    if (update.displayName !== undefined) {
      if (typeof update.displayName !== 'string' || update.displayName.trim().length === 0) {
        throw new DomainError('VALIDATION_ERROR', 400, 'Display name cannot be empty.');
      }
    }

    if (update.studyPreferences?.studyStyle !== undefined) {
      if (!VALID_STYLES.has(update.studyPreferences.studyStyle)) {
        throw new DomainError('VALIDATION_ERROR', 400, `Invalid study style: ${update.studyPreferences.studyStyle}`);
      }
    }

    if (update.studyPreferences?.preferredPace !== undefined) {
      if (!VALID_PACES.has(update.studyPreferences.preferredPace)) {
        throw new DomainError('VALIDATION_ERROR', 400, `Invalid preferred pace: ${update.studyPreferences.preferredPace}`);
      }
    }

    if (update.studyPreferences?.preferredTimes !== undefined) {
      if (!Array.isArray(update.studyPreferences.preferredTimes)) {
        throw new DomainError('VALIDATION_ERROR', 400, 'Preferred times must be an array.');
      }
      for (const time of update.studyPreferences.preferredTimes) {
        if (!VALID_TIMES.has(time)) {
          throw new DomainError('VALIDATION_ERROR', 400, `Invalid preferred study time: ${time}`);
        }
      }
    }

    const client = await getClient();
    try {
      await client.query('BEGIN;');

      // Verify user exists and lock student_profile row
      const uRes = await client.query<{ user_id: string }>(
        `SELECT user_id FROM campus_duo.user_account WHERE user_id = $1`,
        [userId]
      );
      if (uRes.rows.length === 0) {
        throw new DomainError('NOT_FOUND', 404, 'User identity record not found.');
      }

      await this.repo.ensureStudentProfileRow(userId, client);

      const pRes = await client.query<{
        social_bio: string | null;
        study_goals: string | null;
        preferred_location: string | null;
        study_style: string | null;
        preferred_pace: string | null;
      }>(
        `SELECT social_bio, study_goals, preferred_location, study_style, preferred_pace
         FROM campus_duo.student_profile
         WHERE user_id = $1
         FOR UPDATE`,
        [userId]
      );

      const current = pRes.rows[0] || {
        social_bio: null,
        study_goals: null,
        preferred_location: null,
        study_style: 'QUIET_FOCUSED',
        preferred_pace: 'STANDARD_REGULAR',
      };

      if (update.displayName !== undefined) {
        await this.repo.updateDisplayName(client, userId, update.displayName.trim());
      }

      const mergedBio =
        update.socialBio !== undefined
          ? update.socialBio.trim() ? update.socialBio.trim() : null
          : current.social_bio;

      const mergedGoals =
        update.studyPreferences?.studyGoals !== undefined
          ? update.studyPreferences.studyGoals.trim() ? update.studyPreferences.studyGoals.trim() : null
          : current.study_goals;

      const mergedLocation =
        update.studyPreferences?.preferredLocation !== undefined
          ? update.studyPreferences.preferredLocation.trim() ? update.studyPreferences.preferredLocation.trim() : null
          : current.preferred_location;

      const mergedStyle =
        update.studyPreferences?.studyStyle !== undefined
          ? update.studyPreferences.studyStyle
          : current.study_style ?? 'QUIET_FOCUSED';

      const mergedPace =
        update.studyPreferences?.preferredPace !== undefined
          ? update.studyPreferences.preferredPace
          : current.preferred_pace ?? 'STANDARD_REGULAR';

      await this.repo.upsertStudentProfile(client, userId, {
        socialBio: mergedBio,
        studyGoals: mergedGoals,
        preferredLocation: mergedLocation,
        studyStyle: mergedStyle,
        preferredPace: mergedPace,
      });

      if (update.studyPreferences?.preferredTimes !== undefined) {
        await this.repo.updatePreferredTimes(client, userId, update.studyPreferences.preferredTimes);
      }

      if (update.courses !== undefined) {
        await this.repo.updateCourses(client, userId, update.courses);
      }

      if (update.socialInterests !== undefined) {
        await this.repo.updateSocialInterests(client, userId, update.socialInterests);
      }

      await client.query('COMMIT;');
    } catch (err) {
      await client.query('ROLLBACK;');
      throw err;
    } finally {
      client.release();
    }

    return this.getProfile(userId);
  }

  public async updateConsent(
    userId: string,
    mode: 'STUDY' | 'SOCIAL',
    hasConsent: boolean
  ): Promise<{ hasConsent: boolean; consentedAt?: string }> {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const current = await client.query<{ has_consent: boolean; consented_at: string | null }>(
        `SELECT has_consent, consented_at
           FROM campus_duo.consent_record
          WHERE user_id = $1 AND mode = $2`,
        [userId, mode]
      );
      const previous = current.rows[0];
      const now = new Date();
      const result = await client.query<{ has_consent: boolean; consented_at: string | null }>(
        `INSERT INTO campus_duo.consent_record
          (user_id, mode, has_consent, consented_at, revoked_at, policy_version, updated_at)
         VALUES ($1, $2, $3, CASE WHEN $3 THEN COALESCE($4, now()) ELSE $4 END,
                 CASE WHEN $3 THEN NULL ELSE CASE WHEN $4 IS NULL THEN now() ELSE now() END END,
                 'MVP-1', now())
         ON CONFLICT (user_id, mode) DO UPDATE
           SET has_consent = EXCLUDED.has_consent,
               consented_at = CASE WHEN EXCLUDED.has_consent THEN COALESCE(campus_duo.consent_record.consented_at, EXCLUDED.consented_at) ELSE campus_duo.consent_record.consented_at END,
               revoked_at = CASE WHEN EXCLUDED.has_consent THEN NULL ELSE now() END,
               policy_version = EXCLUDED.policy_version,
               updated_at = now()
         RETURNING has_consent, consented_at`,
        [userId, mode, hasConsent, previous?.consented_at ?? null]
      );
      const updated = result.rows[0];
      await client.query(
        `INSERT INTO campus_duo.consent_history
          (user_id, mode, event_type, has_consent, policy_version, source)
         VALUES ($1, $2, $3, $4, 'MVP-1', 'USER_SETTINGS')`,
        [userId, mode, previous ? (previous.has_consent === hasConsent ? 'UPDATED' : hasConsent ? 'GRANTED' : 'REVOKED') : hasConsent ? 'GRANTED' : 'REVOKED', hasConsent]
      );
      await client.query(
        `INSERT INTO campus_duo.audit_event
          (actor_user_id, actor_role, action, target_type, target_id, outcome, safe_reason)
         VALUES ($1, 'ROLE_STUDENT', $2, 'CONSENT', $1, 'SUCCESS', $3)`,
        [userId, `${mode}_CONSENT_${hasConsent ? 'GRANTED' : 'REVOKED'}`, `User ${hasConsent ? 'granted' : 'revoked'} ${mode.toLowerCase()} consent`]
      );
      await client.query('COMMIT');
      return {
        hasConsent: Boolean(updated.has_consent),
        consentedAt: updated.consented_at ? new Date(updated.consented_at).toISOString() : undefined,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
