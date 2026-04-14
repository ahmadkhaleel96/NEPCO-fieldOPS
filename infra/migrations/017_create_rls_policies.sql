-- Migration 017: Row-Level Security policies
-- RLS is the final enforcement layer — it cannot be bypassed by application bugs.
-- Every table has RLS enabled. The service role (used only by background jobs)
-- bypasses RLS by design; never expose the service role key to clients.

ALTER TABLE users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfc_tags           ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_permits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE permit_assets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE permit_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips              ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_locations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfc_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_inspections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_changes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_reports     ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_tasks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrity_alerts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_recipients  ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- Helper functions — extract claims from the JWT
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (auth.jwt() ->> 'role')::user_role
$$;

CREATE OR REPLACE FUNCTION get_my_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT (auth.jwt() ->> 'sub')::UUID
$$;

-- ----------------------------------------------------------------
-- USERS
-- ----------------------------------------------------------------
CREATE POLICY users_select ON users FOR SELECT
  USING (get_my_role() IN ('admin', 'engineer') OR id = get_my_id());

CREATE POLICY users_insert ON users FOR INSERT
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY users_update ON users FOR UPDATE
  USING  (get_my_role() = 'admin' OR id = get_my_id())
  WITH CHECK (get_my_role() = 'admin' OR id = get_my_id());

-- ----------------------------------------------------------------
-- ASSETS + VEHICLES (read by all authenticated; write by admin/engineer)
-- ----------------------------------------------------------------
CREATE POLICY assets_select   ON assets FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY assets_insert   ON assets FOR INSERT WITH CHECK (get_my_role() IN ('admin','engineer'));
CREATE POLICY assets_update   ON assets FOR UPDATE USING (get_my_role() IN ('admin','engineer'));

CREATE POLICY vehicles_select ON vehicles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY vehicles_insert ON vehicles FOR INSERT WITH CHECK (get_my_role() IN ('admin','engineer'));
CREATE POLICY vehicles_update ON vehicles FOR UPDATE USING (get_my_role() IN ('admin','engineer'));

-- ----------------------------------------------------------------
-- NFC TAGS (admin only for write; authenticated for read)
-- ----------------------------------------------------------------
CREATE POLICY nfc_tags_select ON nfc_tags FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY nfc_tags_insert ON nfc_tags FOR INSERT WITH CHECK (get_my_role() = 'admin');
CREATE POLICY nfc_tags_update ON nfc_tags FOR UPDATE USING (get_my_role() = 'admin');

-- ----------------------------------------------------------------
-- WORK PERMITS
-- Engineers: SELECT all, INSERT, UPDATE their own
-- Team members: SELECT only permits they are on
-- ----------------------------------------------------------------
CREATE POLICY permits_select ON work_permits FOR SELECT
  USING (
    get_my_role() IN ('admin', 'engineer')
    OR id IN (SELECT permit_id FROM permit_members WHERE user_id = get_my_id())
  );

CREATE POLICY permits_insert ON work_permits FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'engineer'));

CREATE POLICY permits_update ON work_permits FOR UPDATE
  USING (
    get_my_role() = 'admin'
    OR (get_my_role() = 'engineer' AND engineer_id = get_my_id())
  );

-- ----------------------------------------------------------------
-- PERMIT MEMBERS
-- ----------------------------------------------------------------
CREATE POLICY pm_select ON permit_members FOR SELECT
  USING (get_my_role() IN ('admin','engineer') OR user_id = get_my_id());

CREATE POLICY pm_insert ON permit_members FOR INSERT
  WITH CHECK (get_my_role() IN ('admin','engineer'));

CREATE POLICY pm_update ON permit_members FOR UPDATE
  USING (get_my_role() IN ('admin','engineer') OR user_id = get_my_id());

-- ----------------------------------------------------------------
-- TRIPS
-- ----------------------------------------------------------------
CREATE POLICY trips_select ON trips FOR SELECT
  USING (
    get_my_role() IN ('admin', 'engineer')
    OR driver_id = get_my_id()
    OR permit_id IN (SELECT permit_id FROM permit_members WHERE user_id = get_my_id())
  );

CREATE POLICY trips_insert ON trips FOR INSERT
  WITH CHECK (driver_id = get_my_id() OR get_my_role() IN ('admin','engineer'));

-- ----------------------------------------------------------------
-- ASSET HISTORY — SELECT only; no write from application code
-- ----------------------------------------------------------------
CREATE POLICY asset_history_select ON asset_history FOR SELECT
  USING (auth.role() = 'authenticated');

-- ----------------------------------------------------------------
-- NFC EVENTS — SELECT own events; INSERT own; no UPDATE/DELETE (trigger blocks it)
-- ----------------------------------------------------------------
CREATE POLICY nfc_events_select ON nfc_events FOR SELECT
  USING (get_my_role() IN ('admin','engineer') OR user_id = get_my_id());

CREATE POLICY nfc_events_insert ON nfc_events FOR INSERT
  WITH CHECK (user_id = get_my_id() OR get_my_role() = 'admin');

-- ----------------------------------------------------------------
-- REPORTS — SELECT for engineer/admin; INSERT via service role only
-- ----------------------------------------------------------------
CREATE POLICY reports_select ON reports FOR SELECT
  USING (get_my_role() IN ('admin', 'engineer'));

-- No INSERT policy for anon/user roles — service role bypasses RLS

-- ----------------------------------------------------------------
-- INTEGRITY ALERTS — admin only
-- ----------------------------------------------------------------
CREATE POLICY integrity_alerts_select ON integrity_alerts FOR SELECT
  USING (get_my_role() = 'admin');
