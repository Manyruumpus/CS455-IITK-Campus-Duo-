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
}
