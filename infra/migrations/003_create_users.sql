-- Migration 003: Users table
-- Mirrors Supabase Auth users. Created via Supabase Admin API server-side only.
-- Clients NEVER insert directly into this table.

CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- References auth.users(id) in Supabase Auth
  auth_id     UUID UNIQUE NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  full_name   TEXT NOT NULL CHECK (char_length(full_name) >= 2),
  role        user_role NOT NULL,
  phone       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  -- Expo push notification token — updated at each login
  push_token  TEXT,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shared trigger function for updated_at — used by all tables
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_users_auth_id  ON users(auth_id);
CREATE INDEX idx_users_role     ON users(role);
CREATE INDEX idx_users_active   ON users(is_active) WHERE is_active = TRUE;
