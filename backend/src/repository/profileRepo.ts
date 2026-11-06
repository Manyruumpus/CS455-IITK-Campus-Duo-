import { PoolClient } from 'pg';
import { query, getClient } from '../config/db';
import {
  PrivateUserProfile,
  ProfileUpdateRequest,
  StudyPreferences,
  CourseEnrollment,
  SocialInterestTag,
  DomainError,
} from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface DbProfileRow {
  user_id: string;
  email: string;
  roll_number: string | null;
  display_name: string;
  department: string | null;
  degree: string | null;
  year: number | null;
  role: string;
  verification_status: string;
  is_onboarded: boolean;
  social_bio: string | null;
  study_goals: string | null;
  preferred_location: string | null;
  study_style: string | null;
  preferred_pace: string | null;
  profile_version: number | null;
  preferred_times: string[];
  courses: CourseEnrollment[];
  social_interests: SocialInterestTag[];
  consents: Record<string, { hasConsent: boolean; consentedAt?: string }>;
}

export class ProfileRepository {
  public async ensureStudentProfileRow(userId: string, client?: PoolClient): Promise<void> {
    const sql = `
      INSERT INTO campus_duo.student_profile (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING;
    `;
    if (client) {
      await client.query(sql, [userId]);
    } else {
      await query(sql, [userId]);
    }
  }

  public async findPrivateProfileRow(userId: string, client?: PoolClient): Promise<DbProfileRow | null> {
    const sql = `
      SELECT
          u.user_id,
          u.email,
          u.roll_number,
          u.display_name,
          u.department,
          u.degree,
          u.year,
          u.role,
          u.verification_status,
          (u.onboarding_status = 'COMPLETED') AS is_onboarded,
          p.social_bio,
          p.study_goals,
          p.preferred_location,
          p.study_style,
          p.preferred_pace,
          COALESCE(p.profile_version, 1) AS profile_version,
          COALESCE((
              SELECT jsonb_agg(pt.time_code ORDER BY pt.time_code)
              FROM campus_duo.profile_preferred_time pt
              WHERE pt.user_id = u.user_id
          ), '[]'::jsonb) AS preferred_times,
          COALESCE((
              SELECT jsonb_agg(
                  jsonb_build_object('courseId', c.course_id, 'code', c.code, 'name', c.name,
                                     'department', c.department)
                  ORDER BY c.code, c.course_id
              )
              FROM campus_duo.profile_course pc
              JOIN campus_duo.course c ON c.course_id = pc.course_id
              WHERE pc.user_id = u.user_id AND pc.enrollment_status = 'ACTIVE'
          ), '[]'::jsonb) AS courses,
          COALESCE((
              SELECT jsonb_agg(
                  jsonb_build_object('id', i.interest_id, 'interestId', i.interest_id, 'name', i.name,
                                     'category', i.category)
                  ORDER BY i.category, i.name, i.interest_id
              )
              FROM campus_duo.profile_interest pi
              JOIN campus_duo.social_interest i ON i.interest_id = pi.interest_id
              WHERE pi.user_id = u.user_id AND i.active
          ), '[]'::jsonb) AS social_interests,
          COALESCE((
              SELECT jsonb_object_agg(cr.mode, jsonb_build_object(
                  'hasConsent', cr.has_consent, 'consentedAt', cr.consented_at))
              FROM campus_duo.consent_record cr
              WHERE cr.user_id = u.user_id
          ), '{}'::jsonb) AS consents
      FROM campus_duo.user_account u
      LEFT JOIN campus_duo.student_profile p ON p.user_id = u.user_id
      WHERE u.user_id = $1
        AND u.account_status <> 'DEACTIVATED';
    `;
    const res = client ? await client.query<DbProfileRow>(sql, [userId]) : await query<DbProfileRow>(sql, [userId]);
    return res.rows[0] || null;
  }

  public async updateDisplayName(client: PoolClient, userId: string, displayName: string): Promise<void> {
    await client.query(
      `UPDATE campus_duo.user_account
       SET display_name = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [displayName, userId]
    );
  }

  public async upsertStudentProfile(
    client: PoolClient,
    userId: string,
    data: {
      socialBio: string | null;
      studyGoals: string | null;
      preferredLocation: string | null;
      studyStyle: string | null;
      preferredPace: string | null;
    }
  ): Promise<void> {
    await client.query(
      `INSERT INTO campus_duo.student_profile (
         user_id, social_bio, study_goals, preferred_location, study_style, preferred_pace
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id) DO UPDATE SET
         social_bio = EXCLUDED.social_bio,
         study_goals = EXCLUDED.study_goals,
         preferred_location = EXCLUDED.preferred_location,
         study_style = EXCLUDED.study_style,
         preferred_pace = EXCLUDED.preferred_pace,
         profile_version = campus_duo.student_profile.profile_version + 1,
         updated_at = NOW();`,
      [userId, data.socialBio, data.studyGoals, data.preferredLocation, data.studyStyle, data.preferredPace]
    );
  }

  public async updatePreferredTimes(client: PoolClient, userId: string, times: string[]): Promise<void> {
    await client.query(`DELETE FROM campus_duo.profile_preferred_time WHERE user_id = $1`, [userId]);
    for (const timeCode of times) {
      await client.query(
        `INSERT INTO campus_duo.profile_preferred_time (user_id, time_code)
         VALUES ($1, $2)
         ON CONFLICT (user_id, time_code) DO NOTHING`,
        [userId, timeCode]
      );
    }
  }

  public async updateCourses(client: PoolClient, userId: string, courses: CourseEnrollment[]): Promise<void> {
    await client.query(`DELETE FROM campus_duo.profile_course WHERE user_id = $1`, [userId]);
    for (const course of courses) {
      const code = course.code ? course.code.trim() : '';
      const courseIdUuid = course.courseId && UUID_REGEX.test(course.courseId) ? course.courseId : null;
      if (!code && !courseIdUuid) continue;

      const courseRes = await client.query<{ course_id: string }>(
        `SELECT course_id FROM campus_duo.course
         WHERE ($1::uuid IS NOT NULL AND course_id = $1::uuid)
            OR ($2 <> '' AND (lower(code) = lower($2) OR lower(code) = lower('DB05-' || $2) OR lower('DB05-' || code) = lower($2)))
         LIMIT 1`,
        [courseIdUuid, code]
      );

      if (courseRes.rows.length > 0) {
        await client.query(
          `INSERT INTO campus_duo.profile_course (user_id, course_id, enrollment_status)
           VALUES ($1, $2, 'ACTIVE')
           ON CONFLICT (user_id, course_id) DO NOTHING`,
          [userId, courseRes.rows[0].course_id]
        );
      }
    }
  }

  public async updateSocialInterests(client: PoolClient, userId: string, interests: SocialInterestTag[]): Promise<void> {
    await client.query(`DELETE FROM campus_duo.profile_interest WHERE user_id = $1`, [userId]);
    for (const interest of interests) {
      const name = interest.name ? interest.name.trim() : '';
      const idStr = interest.id || interest.interestId || '';
      const interestUuid = UUID_REGEX.test(idStr) ? idStr : null;
      if (!name && !interestUuid) continue;

      const interestRes = await client.query<{ interest_id: string }>(
        `SELECT interest_id FROM campus_duo.social_interest
         WHERE ($1::uuid IS NOT NULL AND interest_id = $1::uuid)
            OR ($2 <> '' AND lower(name) = lower($2))
         LIMIT 1`,
        [interestUuid, name]
      );

      if (interestRes.rows.length > 0) {
        await client.query(
          `INSERT INTO campus_duo.profile_interest (user_id, interest_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, interest_id) DO NOTHING`,
          [userId, interestRes.rows[0].interest_id]
        );
      }
    }
  }
}
