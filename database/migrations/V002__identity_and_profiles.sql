SET LOCAL search_path = campus_duo, public;

CREATE TABLE campus_duo.user_account (
    user_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    identity_subject text NOT NULL,
    email text,
    roll_number text,
    department text,
    degree text,
    year smallint,
    display_name text,
    role text NOT NULL DEFAULT 'ROLE_STUDENT',
    verification_status text NOT NULL DEFAULT 'UNVERIFIED',
    verified_at timestamptz,
    onboarding_status text NOT NULL DEFAULT 'INCOMPLETE',
    account_status text NOT NULL DEFAULT 'ACTIVE',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT user_account_identity_subject_not_blank_ck CHECK (
        length(btrim(identity_subject)) > 0
    ),
    CONSTRAINT user_account_identity_subject_uk UNIQUE (identity_subject),
    CONSTRAINT user_account_role_ck CHECK (role IN ('ROLE_STUDENT', 'ROLE_ADMIN')),
    CONSTRAINT user_account_verification_status_ck CHECK (
        verification_status IN ('UNVERIFIED', 'VERIFIED')
    ),
    CONSTRAINT user_account_onboarding_status_ck CHECK (
        onboarding_status IN ('INCOMPLETE', 'COMPLETED')
    ),
    CONSTRAINT user_account_status_ck CHECK (
        account_status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED')
    ),
    CONSTRAINT user_account_year_ck CHECK (year IS NULL OR year BETWEEN 0 AND 100),
    CONSTRAINT user_account_verified_at_ck CHECK (
        verification_status = 'VERIFIED' OR verified_at IS NULL
    )
);

CREATE UNIQUE INDEX user_account_email_ci_uk
    ON campus_duo.user_account (lower(email))
    WHERE email IS NOT NULL;

CREATE UNIQUE INDEX user_account_roll_number_uk
    ON campus_duo.user_account (roll_number)
    WHERE roll_number IS NOT NULL;

CREATE INDEX user_account_status_role_ix
    ON campus_duo.user_account (account_status, role);

CREATE TABLE campus_duo.student_profile (
    user_id uuid PRIMARY KEY,
    social_bio text,
    study_goals text,
    preferred_location text,
    study_style text,
    preferred_pace text,
    profile_version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT student_profile_user_fk
        FOREIGN KEY (user_id) REFERENCES campus_duo.user_account (user_id)
        ON DELETE RESTRICT,
    CONSTRAINT student_profile_version_ck CHECK (profile_version > 0),
    CONSTRAINT student_profile_style_ck CHECK (
        study_style IS NULL OR study_style IN (
            'QUIET_FOCUSED', 'DISCUSSION_HEAVY', 'PROBLEM_SOLVING', 'HYBRID'
        )
    ),
    CONSTRAINT student_profile_pace_ck CHECK (
        preferred_pace IS NULL OR preferred_pace IN (
            'AHEAD_OF_CLASS', 'STANDARD_REGULAR', 'EXAM_CRAMMING'
        )
    )
);

CREATE TABLE campus_duo.profile_preferred_time (
    user_id uuid NOT NULL,
    time_code text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, time_code),
    CONSTRAINT profile_preferred_time_user_fk
        FOREIGN KEY (user_id) REFERENCES campus_duo.student_profile (user_id)
        ON DELETE CASCADE,
    CONSTRAINT profile_preferred_time_code_ck CHECK (
        time_code IN ('MORNING', 'AFTERNOON', 'EVENING', 'LATE_NIGHT')
    )
);

CREATE INDEX profile_preferred_time_code_user_ix
    ON campus_duo.profile_preferred_time (time_code, user_id);

CREATE TABLE campus_duo.course (
    course_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    code text NOT NULL,
    name text NOT NULL,
    department text NOT NULL,
    instructor text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT course_code_not_blank_ck CHECK (length(btrim(code)) > 0),
    CONSTRAINT course_name_not_blank_ck CHECK (length(btrim(name)) > 0),
    CONSTRAINT course_department_not_blank_ck CHECK (length(btrim(department)) > 0)
);

CREATE UNIQUE INDEX course_code_ci_uk
    ON campus_duo.course (lower(code));

CREATE INDEX course_active_name_ix
    ON campus_duo.course (active, lower(name));

CREATE TABLE campus_duo.profile_course (
    user_id uuid NOT NULL,
    course_id uuid NOT NULL,
    enrolled_at timestamptz NOT NULL DEFAULT now(),
    enrollment_status text NOT NULL DEFAULT 'ACTIVE',
    PRIMARY KEY (user_id, course_id),
    CONSTRAINT profile_course_user_fk
        FOREIGN KEY (user_id) REFERENCES campus_duo.student_profile (user_id)
        ON DELETE CASCADE,
    CONSTRAINT profile_course_course_fk
        FOREIGN KEY (course_id) REFERENCES campus_duo.course (course_id)
        ON DELETE RESTRICT,
    CONSTRAINT profile_course_status_ck CHECK (
        enrollment_status IN ('ACTIVE', 'INACTIVE')
    )
);

CREATE INDEX profile_course_course_user_ix
    ON campus_duo.profile_course (course_id, user_id);

CREATE TABLE campus_duo.social_interest (
    interest_id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    name text NOT NULL,
    category text NOT NULL,
    description text,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT social_interest_name_not_blank_ck CHECK (length(btrim(name)) > 0),
    CONSTRAINT social_interest_category_ck CHECK (
        category IN ('TECH_ACADEMIC', 'CULTURAL_ARTS', 'SPORTS_FITNESS', 'CAMPUS_LIFE')
    )
);

CREATE UNIQUE INDEX social_interest_category_name_ci_uk
    ON campus_duo.social_interest (category, lower(name));

CREATE INDEX social_interest_active_category_ix
    ON campus_duo.social_interest (active, category);

CREATE TABLE campus_duo.profile_interest (
    user_id uuid NOT NULL,
    interest_id uuid NOT NULL,
    selected_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, interest_id),
    CONSTRAINT profile_interest_user_fk
        FOREIGN KEY (user_id) REFERENCES campus_duo.student_profile (user_id)
        ON DELETE CASCADE,
    CONSTRAINT profile_interest_interest_fk
        FOREIGN KEY (interest_id) REFERENCES campus_duo.social_interest (interest_id)
        ON DELETE RESTRICT
);

CREATE INDEX profile_interest_interest_user_ix
    ON campus_duo.profile_interest (interest_id, user_id);
