-- Campus Duo — Deliverable 2 / 3 Migration V011: Admin Inventory Management Permissions
-- Grants necessary permissions to campus_duo_app to manage study locations, tables, and slots.

SET LOCAL search_path = campus_duo, public;

-- Grant table-level permissions to runtime role campus_duo_app
GRANT SELECT, INSERT, UPDATE, DELETE ON campus_duo.study_location TO campus_duo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON campus_duo.study_table TO campus_duo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON campus_duo.study_slot TO campus_duo_app;
