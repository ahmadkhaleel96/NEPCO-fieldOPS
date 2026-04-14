-- Migration 008: Permit team members

CREATE TABLE permit_members (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  permit_id         UUID NOT NULL REFERENCES work_permits(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id),
  -- Set when biometric confirmation received (expo-local-authentication)
  accepted_at       TIMESTAMPTZ,
  withdrawn_at      TIMESTAMPTZ,
  withdrawal_reason TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(permit_id, user_id)
);

-- Prevent adding members once a permit becomes active
CREATE OR REPLACE FUNCTION prevent_member_addition_on_active_permit()
RETURNS TRIGGER AS $$
DECLARE
  v_status work_permit_status;
BEGIN
  SELECT status INTO v_status FROM work_permits WHERE id = NEW.permit_id;
  IF v_status IN ('active', 'completed') THEN
    RAISE EXCEPTION 'Cannot add members to a permit with status: %', v_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER permit_members_lock_on_active
  BEFORE INSERT ON permit_members
  FOR EACH ROW EXECUTE FUNCTION prevent_member_addition_on_active_permit();

CREATE INDEX idx_permit_members_permit ON permit_members(permit_id);
CREATE INDEX idx_permit_members_user   ON permit_members(user_id);
