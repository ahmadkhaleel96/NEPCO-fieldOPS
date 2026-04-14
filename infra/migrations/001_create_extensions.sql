-- Migration 001: Enable required PostgreSQL extensions
-- Must run before any other migration.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "postgis";      -- geometry types for GPS storage
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- gen_random_bytes() for passwords
