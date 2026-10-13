-- DB-06 query contract: bounded social candidate source data.
-- Parameters: $1 uuid viewer; $2 text interest_name nullable; $3 text search_term nullable;
-- $4 integer limit (1..50); $5 uuid last_user_id nullable UUID-only source-page cursor.
-- Authorization: active SOCIAL consent is required; backend derives viewer from session.
-- Privacy: only public social fields are returned; no email, roll number, schedules, reports, or settings.
-- Consent/block filtering and HIDE/PASS filtering are mode-specific. Scoring/shared interests remain backend-derived
-- from returned interests; no fabricated affinity is generated here.
-- Ordering is a UUID source-page order, not global compatibility ranking.
-- Indexes: consent_record_eligibility_ix, social_interest_active_category_ix,
-- profile_interest_interest_user_ix, block_active_pair_uk, discovery_action_actor_mode_type_ix.
SELECT
    u.user_id,
    u.display_name,
    p.social_bio AS bio,
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object('interestId', i.interest_id, 'name', i.name, 'category', i.category)
                         ORDER BY i.category, i.name, i.interest_id)
        FROM campus_duo.profile_interest pi
        JOIN campus_duo.social_interest i ON i.interest_id = pi.interest_id
        WHERE pi.user_id = u.user_id AND i.active
    ), '[]'::jsonb) AS interests
FROM campus_duo.user_account u
JOIN campus_duo.student_profile p ON p.user_id = u.user_id
JOIN campus_duo.consent_record consent
  ON consent.user_id = u.user_id AND consent.mode = 'SOCIAL' AND consent.has_consent
WHERE u.user_id <> $1
  AND $4 BETWEEN 1 AND 50
  AND EXISTS (
      SELECT 1 FROM campus_duo.user_account viewer
      JOIN campus_duo.consent_record viewer_consent
        ON viewer_consent.user_id = viewer.user_id
       AND viewer_consent.mode = 'SOCIAL'
       AND viewer_consent.has_consent
      WHERE viewer.user_id = $1 AND viewer.account_status = 'ACTIVE'
  )
  AND u.account_status = 'ACTIVE'
  AND ($2::text IS NULL OR EXISTS (
      SELECT 1 FROM campus_duo.profile_interest pi
      JOIN campus_duo.social_interest i ON i.interest_id = pi.interest_id
      WHERE pi.user_id = u.user_id AND i.active AND lower(i.name) = lower($2)
  ))
  AND ($3::text IS NULL OR lower(u.display_name) LIKE '%' || lower($3) || '%')
  AND NOT EXISTS (
      SELECT 1 FROM campus_duo.block b
      WHERE b.active
        AND ((b.actor_user_id = $1 AND b.target_user_id = u.user_id)
          OR (b.actor_user_id = u.user_id AND b.target_user_id = $1))
  )
  AND NOT EXISTS (
      SELECT 1 FROM campus_duo.discovery_action a
      WHERE a.actor_user_id = $1 AND a.target_user_id = u.user_id
        AND a.mode = 'SOCIAL' AND a.action_type IN ('PASS', 'HIDE')
  )
  AND ($5::uuid IS NULL OR u.user_id > $5)
ORDER BY u.user_id
LIMIT CASE
    WHEN $4::integer BETWEEN 1 AND 50 THEN $4::integer
    ELSE 0
END;
