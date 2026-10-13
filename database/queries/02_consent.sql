-- DB-06 query contract: independent consent retrieval.
-- Parameters: $1 uuid = authenticated actor; $2 text = exact mode STUDY or SOCIAL.
-- Authorization: backend must require actor session and validate mode; no cross-user reads.
-- Returns one row or zero rows. Empty means no current consent record.
-- Index: consent_record_eligibility_ix supports mode/has_consent/user_id filtering.
SELECT consent_id, user_id, mode, has_consent, consented_at, revoked_at, policy_version, updated_at
FROM campus_duo.consent_record
WHERE user_id = $1 AND mode = $2;
