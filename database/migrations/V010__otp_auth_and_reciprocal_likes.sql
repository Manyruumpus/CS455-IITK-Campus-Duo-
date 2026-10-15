SET LOCAL search_path = campus_duo, public;

-- 1. Table for storing OTP challenges for registration and login
CREATE TABLE IF NOT EXISTS campus_duo.otp_challenge (
    challenge_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    email text NOT NULL,
    otp_hash text NOT NULL,
    purpose text NOT NULL,
    display_name text,
    attempts integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 3,
    expires_at timestamptz NOT NULL,
    verified_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT otp_challenge_purpose_ck CHECK (purpose IN ('REGISTRATION', 'LOGIN')),
    CONSTRAINT otp_challenge_attempts_ck CHECK (attempts >= 0 AND attempts <= max_attempts)
);

CREATE INDEX IF NOT EXISTS otp_challenge_email_purpose_ix
    ON campus_duo.otp_challenge (lower(email), purpose, expires_at);

-- 2. Add login tracking columns to user_account for authentic first-login experience
ALTER TABLE campus_duo.user_account
    ADD COLUMN IF NOT EXISTS login_count integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- 3. Stored function for student registration upon verified OTP (SECURITY DEFINER)
-- Removes automatic connection to Sam so fresh students start with zero unearned connections.
CREATE OR REPLACE FUNCTION campus_duo.register_verified_student(
    p_email text,
    p_display_name text
) RETURNS TABLE (
    out_user_id uuid,
    out_email text,
    out_display_name text,
    out_role text,
    out_verification_status text,
    out_account_status text,
    out_is_first_login boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = campus_duo, pg_temp
AS $$
DECLARE
    v_user_id uuid;
    v_clean_email text := lower(btrim(p_email));
BEGIN
    -- Strict domain check: must end with @iitk.ac.in and have no lookalike or subdomains
    IF v_clean_email NOT LIKE '%@iitk.ac.in'
       OR v_clean_email LIKE '%@iitk.ac.in.%'
       OR v_clean_email LIKE '%@%.iitk.ac.in'
       OR split_part(v_clean_email, '@', 1) = ''
       OR split_part(v_clean_email, '@', 2) <> 'iitk.ac.in' THEN
        RAISE EXCEPTION 'Registration requires an allowed @iitk.ac.in email address' USING ERRCODE = '22000';
    END IF;

    -- Enforce uniqueness
    IF EXISTS (SELECT 1 FROM campus_duo.user_account u WHERE lower(u.email) = v_clean_email) THEN
        RAISE EXCEPTION 'An account with this email address already exists' USING ERRCODE = '23505';
    END IF;

    v_user_id := pg_catalog.gen_random_uuid();

    -- Insert verified student account with first login recorded
    INSERT INTO campus_duo.user_account (
        user_id, identity_subject, email, display_name,
        role, verification_status, verified_at,
        onboarding_status, account_status,
        login_count, last_login_at,
        created_at, updated_at
    ) VALUES (
        v_user_id,
        'local-iitk-' || v_user_id,
        v_clean_email,
        btrim(p_display_name),
        'ROLE_STUDENT',
        'VERIFIED',
        clock_timestamp(),
        'COMPLETED',
        'ACTIVE',
        1,
        clock_timestamp(),
        clock_timestamp(),
        clock_timestamp()
    );

    -- Insert baseline student profile
    INSERT INTO campus_duo.student_profile (
        user_id, social_bio, study_goals, study_style, preferred_pace
    ) VALUES (
        v_user_id,
        'IITK Student',
        'Collaborative study and course revision',
        'PROBLEM_SOLVING',
        'STANDARD_REGULAR'
    );

    -- Insert active study consent
    INSERT INTO campus_duo.consent_record (
        user_id, mode, has_consent, consented_at, policy_version
    ) VALUES (
        v_user_id, 'STUDY', true, clock_timestamp(), '1.0'
    );

    -- Note: NO automatic mutual connection is created.
    -- Mutual connections are formed strictly upon reciprocal likes via record_discovery_action.

    RETURN QUERY
    SELECT u.user_id, u.email, u.display_name, u.role, u.verification_status, u.account_status, true AS out_is_first_login
      FROM campus_duo.user_account u
     WHERE u.user_id = v_user_id;
END;
$$;

-- 4. Transactional discovery action recording and reciprocal like detection
CREATE OR REPLACE FUNCTION campus_duo.record_discovery_action(
    p_actor_id uuid,
    p_target_id uuid,
    p_mode text,
    p_action_type text
) RETURNS TABLE (
    out_action_id uuid,
    out_actor_id uuid,
    out_target_id uuid,
    out_mode text,
    out_action_type text,
    out_relationship_status text,
    out_connection_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = campus_duo, pg_temp
AS $$
DECLARE
    v_action_id uuid;
    v_conn_id uuid := NULL;
    v_rel_status text := 'NONE';
    v_reciprocal_exists boolean := false;
    v_user_a uuid;
    v_user_b uuid;
BEGIN
    -- Self-action validation
    IF p_actor_id = p_target_id THEN
        RAISE EXCEPTION 'Cannot perform discovery action on yourself' USING ERRCODE = '22000';
    END IF;

    -- Mode validation
    IF p_mode NOT IN ('STUDY', 'SOCIAL') THEN
        RAISE EXCEPTION 'Invalid mode. Must be STUDY or SOCIAL' USING ERRCODE = '22000';
    END IF;

    -- Action type validation
    IF p_action_type NOT IN ('LIKE', 'PASS', 'HIDE') THEN
        RAISE EXCEPTION 'Invalid action type. Must be LIKE, PASS, or HIDE' USING ERRCODE = '22000';
    END IF;

    -- Check if either user blocks the other
    IF EXISTS (
        SELECT 1 FROM campus_duo.block
        WHERE active = true
          AND (
            (actor_user_id = p_actor_id AND target_user_id = p_target_id)
            OR
            (actor_user_id = p_target_id AND target_user_id = p_actor_id)
          )
    ) THEN
        RAISE EXCEPTION 'Active block exists between participants' USING ERRCODE = '22000';
    END IF;

    -- Persist directional discovery action
    INSERT INTO campus_duo.discovery_action (
        actor_user_id, target_user_id, mode, action_type, updated_at
    ) VALUES (
        p_actor_id, p_target_id, p_mode, p_action_type, clock_timestamp()
    )
    ON CONFLICT (actor_user_id, target_user_id, mode)
    DO UPDATE SET action_type = EXCLUDED.action_type, updated_at = clock_timestamp()
    RETURNING action_id INTO v_action_id;

    -- For LIKE in STUDY mode, evaluate reciprocal like
    IF p_action_type = 'LIKE' AND p_mode = 'STUDY' THEN
        SELECT EXISTS (
            SELECT 1 FROM campus_duo.discovery_action
            WHERE actor_user_id = p_target_id
              AND target_user_id = p_actor_id
              AND mode = 'STUDY'
              AND action_type = 'LIKE'
        ) INTO v_reciprocal_exists;

        IF v_reciprocal_exists THEN
            -- Deterministic canonical pair ordering
            v_user_a := LEAST(p_actor_id, p_target_id);
            v_user_b := GREATEST(p_actor_id, p_target_id);

            INSERT INTO campus_duo.connection (
                user_a_id, user_b_id, mode, status, note, updated_at
            ) VALUES (
                v_user_a, v_user_b, 'STUDY', 'MUTUAL_CONNECTED', 'Formed via mutual STUDY likes', clock_timestamp()
            )
            ON CONFLICT (user_a_id, user_b_id, mode)
            DO UPDATE SET status = 'MUTUAL_CONNECTED', updated_at = clock_timestamp()
            RETURNING connection_id INTO v_conn_id;

            v_rel_status := 'MUTUAL_CONNECTED';
        ELSE
            v_rel_status := 'LIKE_SENT';
        END IF;
    ELSIF p_action_type = 'LIKE' AND p_mode = 'SOCIAL' THEN
        -- Check reciprocal for social
        SELECT EXISTS (
            SELECT 1 FROM campus_duo.discovery_action
            WHERE actor_user_id = p_target_id
              AND target_user_id = p_actor_id
              AND mode = 'SOCIAL'
              AND action_type = 'LIKE'
        ) INTO v_reciprocal_exists;

        IF v_reciprocal_exists THEN
            v_user_a := LEAST(p_actor_id, p_target_id);
            v_user_b := GREATEST(p_actor_id, p_target_id);

            INSERT INTO campus_duo.connection (
                user_a_id, user_b_id, mode, status, note, updated_at
            ) VALUES (
                v_user_a, v_user_b, 'SOCIAL', 'MUTUAL_CONNECTED', 'Formed via mutual SOCIAL likes', clock_timestamp()
            )
            ON CONFLICT (user_a_id, user_b_id, mode)
            DO UPDATE SET status = 'MUTUAL_CONNECTED', updated_at = clock_timestamp()
            RETURNING connection_id INTO v_conn_id;

            v_rel_status := 'MUTUAL_CONNECTED';
        ELSE
            v_rel_status := 'LIKE_SENT';
        END IF;
    ELSE
        v_rel_status := 'NONE';
    END IF;

    RETURN QUERY
    SELECT v_action_id, p_actor_id, p_target_id, p_mode, p_action_type, v_rel_status, v_conn_id;
END;
$$;

-- 5. Runtime permissions for application role campus_duo_app
GRANT SELECT, INSERT, UPDATE, DELETE ON campus_duo.otp_challenge TO campus_duo_app;
GRANT SELECT (login_count, last_login_at) ON campus_duo.user_account TO campus_duo_app;
GRANT UPDATE (login_count, last_login_at) ON campus_duo.user_account TO campus_duo_app;
GRANT EXECUTE ON FUNCTION campus_duo.register_verified_student(text, text) TO campus_duo_app;
GRANT EXECUTE ON FUNCTION campus_duo.record_discovery_action(uuid, uuid, text, text) TO campus_duo_app;
