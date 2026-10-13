-- DB-06 query contract: bounded study candidate source data.
-- Parameters: $1 uuid viewer; $2 text course_code nullable; $3 text study_style nullable;
-- $4 text preferred_pace nullable; $5 text search_term nullable; $6 integer limit (1..50);
-- $7 uuid last_user_id nullable UUID-only source-page cursor.
-- Authorization: backend must validate viewer and require active STUDY consent.
-- Consent/block filtering: candidate STUDY consent, active account/profile, no active block either direction,
-- no self, and no HIDE/PASS action for the applicable discovery policy.
-- Scoring: return source fields only. The approved demo formula (35C+25T+20P+10L+10G)
-- remains backend-owned; this query does not invent or persist a score.
-- Ordering: UUID order is a source-page order only, not global compatibility ranking.
-- Indexes: consent_record_eligibility_ix, block_active_pair_uk, discovery_action_actor_mode_type_ix,
-- profile_course_course_user_ix, profile_preferred_time_code_user_ix, user_account PK.
SELECT
    candidate.user_id,
    candidate.display_name,
    candidate.department,
    candidate.degree,
    candidate.year,
    candidate.study_style,
    candidate.preferred_pace,
    candidate.study_goals,
    candidate.preferred_location,
    candidate.preferred_times,
    candidate.courses,
    candidate.account_status AS active_status
FROM (
    SELECT
        u.user_id,
        u.display_name,
        u.department,
        u.degree,
        u.year,
        u.account_status,
        p.study_style,
        p.preferred_pace,
        COALESCE((
            SELECT jsonb_agg(pt.time_code ORDER BY pt.time_code)
            FROM campus_duo.profile_preferred_time pt
            WHERE pt.user_id = u.user_id
        ), '[]'::jsonb) AS preferred_times,
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object('courseId', c.course_id, 'code', c.code, 'name', c.name)
                             ORDER BY c.code, c.course_id)
            FROM campus_duo.profile_course pc
            JOIN campus_duo.course c ON c.course_id = pc.course_id
            WHERE pc.user_id = u.user_id AND pc.enrollment_status = 'ACTIVE'
        ), '[]'::jsonb) AS courses
        , p.study_goals
        , p.preferred_location
    FROM campus_duo.user_account u
    JOIN campus_duo.student_profile p ON p.user_id = u.user_id
    JOIN campus_duo.consent_record consent
      ON consent.user_id = u.user_id AND consent.mode = 'STUDY' AND consent.has_consent
    WHERE $6 BETWEEN 1 AND 50
      AND EXISTS (
          SELECT 1 FROM campus_duo.user_account viewer
          JOIN campus_duo.consent_record viewer_consent
            ON viewer_consent.user_id = viewer.user_id
           AND viewer_consent.mode = 'STUDY'
           AND viewer_consent.has_consent
          WHERE viewer.user_id = $1 AND viewer.account_status = 'ACTIVE'
      )
      AND u.user_id <> $1
      AND u.account_status = 'ACTIVE'
      AND ($2::text IS NULL OR EXISTS (
          SELECT 1 FROM campus_duo.profile_course pc
          JOIN campus_duo.course c ON c.course_id = pc.course_id
          WHERE pc.user_id = u.user_id AND pc.enrollment_status = 'ACTIVE'
            AND lower(c.code) = lower($2)
      ))
      AND ($3::text IS NULL OR p.study_style = $3)
      AND ($4::text IS NULL OR p.preferred_pace = $4)
      AND ($5::text IS NULL OR lower(u.display_name) LIKE '%' || lower($5) || '%')
      AND NOT EXISTS (
          SELECT 1 FROM campus_duo.block b
          WHERE b.active
            AND ((b.actor_user_id = $1 AND b.target_user_id = u.user_id)
              OR (b.actor_user_id = u.user_id AND b.target_user_id = $1))
      )
      AND NOT EXISTS (
          SELECT 1 FROM campus_duo.discovery_action a
          WHERE a.actor_user_id = $1 AND a.target_user_id = u.user_id
            AND a.mode = 'STUDY' AND a.action_type IN ('PASS', 'HIDE')
      )
) candidate
WHERE ($7::uuid IS NULL OR candidate.user_id > $7)
ORDER BY candidate.user_id
LIMIT CASE
    WHEN $6::integer BETWEEN 1 AND 50 THEN $6::integer
    ELSE 0
END;
