-- DB-06 query contract: private account/profile retrieval.
-- Driver/prepared-statement template; not a standalone psql script.
-- Parameters: $1 uuid = authenticated actor user_id.
-- Authorization: backend derives $1 from validated server session; caller input is not authentication.
-- Returns one row or zero rows. Identity/provider fields are intentionally excluded.
-- Mapping: user_id/display_name/department/degree/year -> private profile; profile fields -> studyPreferences;
-- courses/interests are aggregated to prevent join multiplication.
-- Indexes: user_account PK; student_profile PK; profile_course PK and profile_course_course_user_ix;
-- profile_interest PK and profile_interest_interest_user_ix; course PK; social_interest PK.
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
    p.profile_version,
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
            jsonb_build_object('interestId', i.interest_id, 'name', i.name,
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
JOIN campus_duo.student_profile p ON p.user_id = u.user_id
WHERE u.user_id = $1
  AND u.account_status <> 'DEACTIVATED';
