SET LOCAL search_path = campus_duo, public;

-- 1. Table for storing cryptographic password hashes
CREATE TABLE IF NOT EXISTS campus_duo.auth_credential (
    user_id uuid PRIMARY KEY REFERENCES campus_duo.user_account (user_id) ON DELETE CASCADE,
    password_hash text NOT NULL,
    algorithm text NOT NULL DEFAULT 'scrypt',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Table for server-side auth sessions (Bearer tokens)
CREATE TABLE IF NOT EXISTS campus_duo.auth_session (
    session_token text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES campus_duo.user_account (user_id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'ROLE_STUDENT',
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_session_user_id_ix ON campus_duo.auth_session (user_id);
CREATE INDEX IF NOT EXISTS auth_session_expires_at_ix ON campus_duo.auth_session (expires_at);

-- 3. Stored function for secure student registration with SECURITY DEFINER
-- Enforces least-privilege ROLE_STUDENT and @iitk.ac.in domain invariant
DROP FUNCTION IF EXISTS campus_duo.register_student(text, text, text);
CREATE OR REPLACE FUNCTION campus_duo.register_student(
    p_email text,
    p_display_name text,
    p_password_hash text
) RETURNS TABLE (
    out_user_id uuid,
    out_email text,
    out_display_name text,
    out_role text,
    out_verification_status text,
    out_account_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = campus_duo, public
AS $$
DECLARE
    v_user_id uuid;
    v_clean_email text := lower(btrim(p_email));
    v_sam_id uuid := '00000000-0000-0000-0000-00000000d502'::uuid;
    v_user_a uuid;
    v_user_b uuid;
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

    -- Insert least-privileged active verified student account
    INSERT INTO campus_duo.user_account (
        user_id, identity_subject, email, display_name,
        role, verification_status, verified_at,
        onboarding_status, account_status, created_at, updated_at
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
        clock_timestamp(),
        clock_timestamp()
    );

    -- Insert credentials
    INSERT INTO campus_duo.auth_credential (
        user_id, password_hash, algorithm, created_at, updated_at
    ) VALUES (
        v_user_id, p_password_hash, 'scrypt', clock_timestamp(), clock_timestamp()
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

    -- Create mutual STUDY connection with seed student Sam so new student can immediately reserve tables
    IF EXISTS (SELECT 1 FROM campus_duo.user_account WHERE user_id = v_sam_id) THEN
        IF v_user_id < v_sam_id THEN
            v_user_a := v_user_id;
            v_user_b := v_sam_id;
        ELSE
            v_user_a := v_sam_id;
            v_user_b := v_user_id;
        END IF;

        INSERT INTO campus_duo.connection (
            user_a_id, user_b_id, mode, status, note
        ) VALUES (
            v_user_a, v_user_b, 'STUDY', 'MUTUAL_CONNECTED', 'Auto-paired demo connection for booking'
        );
    END IF;

    RETURN QUERY
    SELECT u.user_id, u.email, u.display_name, u.role, u.verification_status, u.account_status
      FROM campus_duo.user_account u
     WHERE u.user_id = v_user_id;
END;
$$;

-- 5. Privileges for campus_duo_app
GRANT EXECUTE ON FUNCTION campus_duo.register_student(text, text, text) TO campus_duo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON campus_duo.auth_credential TO campus_duo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON campus_duo.auth_session TO campus_duo_app;
