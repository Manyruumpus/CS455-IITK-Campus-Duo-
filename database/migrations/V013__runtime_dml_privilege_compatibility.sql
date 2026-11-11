SET LOCAL search_path = campus_duo, public;

-- PostgreSQL requires relation-level DML privileges for the conflict-handling
-- statements used by the runtime. These grants do not grant SELECT access.
GRANT INSERT, UPDATE ON campus_duo.consent_record TO campus_duo_app;
GRANT INSERT ON campus_duo.consent_history TO campus_duo_app;
GRANT INSERT, UPDATE ON campus_duo.block TO campus_duo_app;
GRANT INSERT ON campus_duo.moderation_report TO campus_duo_app;
GRANT INSERT ON campus_duo.audit_event TO campus_duo_app;
