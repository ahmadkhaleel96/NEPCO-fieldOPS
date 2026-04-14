-- Migration 016: Reports + integrity infrastructure

CREATE TABLE reports (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cadence      report_cadence NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end   TIMESTAMPTZ NOT NULL,
  -- Aggregated payload — source of truth for all three copies (PDF, JSON, CSV)
  data         JSONB NOT NULL,
  -- SHA-256 of canonical JSON payload; computed server-side with crypto.createHash
  sha256       TEXT NOT NULL,
  -- PDF URL in Cloudflare R2 (reports/{year}/{cadence}/RPT-{id}.pdf)
  pdf_url      TEXT,
  csv_sent_at  TIMESTAMPTZ,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A period can only appear once per cadence
  UNIQUE(cadence, period_start, period_end)
);

-- Integrity alerts — created by weekly verification job when hash mismatch detected
CREATE TABLE integrity_alerts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id   UUID NOT NULL REFERENCES reports(id),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stored_hash TEXT NOT NULL,
  actual_hash TEXT NOT NULL,
  resolved    BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id)
);

-- Report distribution recipients (no hardcoded email addresses)
CREATE TABLE report_recipients (
  id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cadence report_cadence NOT NULL,
  email   TEXT NOT NULL,
  UNIQUE(cadence, email)
);

CREATE INDEX idx_reports_cadence ON reports(cadence);
CREATE INDEX idx_reports_period  ON reports(period_start, period_end);
