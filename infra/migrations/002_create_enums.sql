-- Migration 002: Create all application enumerations
-- Enums enforce valid values at the database layer — not just in application code.

CREATE TYPE user_role AS ENUM (
  'admin',
  'engineer',
  'team_leader',
  'technician',
  'driver'
);

-- Extensible: add new types with ALTER TYPE ... ADD VALUE
CREATE TYPE asset_type AS ENUM (
  'hv_tower',
  'substation',
  'switchgear',
  'cable_joint',
  'distribution_cabinet'
);

CREATE TYPE nfc_tag_status AS ENUM (
  'provisioned', -- Tag written but not yet field-mounted
  'active',      -- Mounted and confirmed by field technician
  'inactive',    -- Decommissioned
  'replaced'     -- Superseded by a new tag (replaced_by FK points to replacement)
);

CREATE TYPE work_permit_status AS ENUM (
  'draft',       -- Engineer is building the permit
  'issued',      -- Issued to team, awaiting acceptance
  'active',      -- Vehicle NFC scan confirmed; team on-site
  'completed',   -- Return NFC scan received; all data sealed
  'incomplete',  -- Trip ended without all inspections submitted
  'suspended',   -- Safety hazard reported; requires engineer re-activation
  'withdrawn'    -- Permit cancelled before trip started
);

CREATE TYPE work_permit_type AS ENUM (
  'maintenance',
  'inspection',
  'emergency',
  'installation'
);

CREATE TYPE nfc_event_type AS ENUM (
  'vehicle_start',     -- Driver scans vehicle tag to start trip
  'site_arrival',      -- Team scans asset tag on arrival
  'trip_end',          -- Driver scans vehicle tag to close trip
  'permit_withdrawal'  -- Permit withdrawn; logged for audit
);

CREATE TYPE inspection_status AS ENUM (
  'open',       -- Not yet submitted
  'pending',    -- Submitted, awaiting engineer approval
  'incomplete', -- Submitted with an incomplete reason
  'deferred'    -- Engineer granted deferral; follow_up_task created
);

CREATE TYPE incomplete_reason AS ENUM (
  'device_failure',
  'safety_hazard',      -- Triggers safety_reports flow + permit suspension
  'access_restricted',
  'equipment_missing'
);

CREATE TYPE approval_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

CREATE TYPE report_cadence AS ENUM (
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'bi_yearly',
  'yearly'
);
