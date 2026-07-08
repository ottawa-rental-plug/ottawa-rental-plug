-- Migration 002: Add Syndication Tables for Multi-Platform Publishing
-- Description: Creates tables to manage listing syndication across Realtor.ca, Kijiji, and other platforms
-- Created: 2026-07-07
-- Status: Ready for Production

-- Create syndication_configs table (master switch per unit)
CREATE TABLE syndication_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL UNIQUE,

  -- Master Settings
  enabled BOOLEAN DEFAULT true,       -- Enable/disable all syndication for this unit

  -- Metadata
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  -- Constraints
  CONSTRAINT fk_syndication_config_unit
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
);

CREATE INDEX idx_syndication_configs_unit_id ON syndication_configs(unit_id);
CREATE INDEX idx_syndication_configs_enabled ON syndication_configs(enabled);

-- Create syndication_platforms table (per-platform details)
CREATE TABLE syndication_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL,

  -- Platform Information
  platform TEXT NOT NULL,             -- "realtor_ca", "kijiji", "airbnb"
  external_id TEXT,                   -- Platform's unique listing ID
  external_url TEXT,                  -- Direct link to listing on platform

  -- Sync Status
  status TEXT NOT NULL DEFAULT 'pending',  -- "pending", "synced", "failed", "paused"
  last_sync_at TIMESTAMP,
  next_sync_at TIMESTAMP,
  last_error TEXT,                    -- Error message if status = 'failed'

  -- Metadata
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  -- Constraints
  CONSTRAINT fk_syndication_platforms_unit
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
  CONSTRAINT ck_platform_name
    CHECK (platform IN ('realtor_ca', 'kijiji', 'airbnb')),
  CONSTRAINT ck_status
    CHECK (status IN ('pending', 'synced', 'failed', 'paused')),
  CONSTRAINT ck_no_duplicate_platforms
    UNIQUE (unit_id, platform)
);

CREATE INDEX idx_syndication_platforms_unit_id ON syndication_platforms(unit_id);
CREATE INDEX idx_syndication_platforms_platform ON syndication_platforms(platform);
CREATE INDEX idx_syndication_platforms_status ON syndication_platforms(status);
CREATE INDEX idx_syndication_platforms_last_sync ON syndication_platforms(last_sync_at);
CREATE INDEX idx_syndication_platforms_next_sync ON syndication_platforms(next_sync_at);

-- Create syndication_history table (audit trail)
CREATE TABLE syndication_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL,
  platform TEXT NOT NULL,

  -- Action Details
  action TEXT NOT NULL,               -- "created", "updated", "deleted", "error", "synced"
  details JSONB,                      -- JSON payload: {status, external_id, error, duration_ms, ...}

  -- Metadata
  created_at TIMESTAMP DEFAULT now(),

  -- Constraints
  CONSTRAINT fk_syndication_history_unit
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
  CONSTRAINT ck_syndication_action
    CHECK (action IN ('created', 'updated', 'deleted', 'error', 'synced'))
);

CREATE INDEX idx_syndication_history_unit_id ON syndication_history(unit_id);
CREATE INDEX idx_syndication_history_platform ON syndication_history(platform);
CREATE INDEX idx_syndication_history_action ON syndication_history(action);
CREATE INDEX idx_syndication_history_created ON syndication_history(created_at);

-- Enable Row Level Security
ALTER TABLE syndication_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndication_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndication_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for syndication_configs
CREATE POLICY admin_syndication_configs ON syndication_configs
  USING (auth.jwt() ->> 'email' = 'cyrilrentsottawa@gmail.com');

CREATE POLICY landlord_syndication_configs ON syndication_configs
  USING (unit_id IN (
    SELECT u.id FROM units u
    JOIN landlords l ON u.landlord_id = l.id
    WHERE l.auth_user_id = auth.uid()
  ))
  WITH CHECK (unit_id IN (
    SELECT u.id FROM units u
    JOIN landlords l ON u.landlord_id = l.id
    WHERE l.auth_user_id = auth.uid()
  ));

-- RLS Policies for syndication_platforms
CREATE POLICY admin_syndication_platforms ON syndication_platforms
  USING (auth.jwt() ->> 'email' = 'cyrilrentsottawa@gmail.com');

CREATE POLICY landlord_syndication_platforms ON syndication_platforms
  USING (unit_id IN (
    SELECT u.id FROM units u
    JOIN landlords l ON u.landlord_id = l.id
    WHERE l.auth_user_id = auth.uid()
  ))
  WITH CHECK (unit_id IN (
    SELECT u.id FROM units u
    JOIN landlords l ON u.landlord_id = l.id
    WHERE l.auth_user_id = auth.uid()
  ));

-- RLS Policies for syndication_history
CREATE POLICY admin_syndication_history ON syndication_history
  USING (auth.jwt() ->> 'email' = 'cyrilrentsottawa@gmail.com');

CREATE POLICY landlord_syndication_history ON syndication_history
  USING (unit_id IN (
    SELECT u.id FROM units u
    JOIN landlords l ON u.landlord_id = l.id
    WHERE l.auth_user_id = auth.uid()
  ));

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_syndication_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER syndication_configs_updated_at_trigger
BEFORE UPDATE ON syndication_configs
FOR EACH ROW
EXECUTE FUNCTION update_syndication_configs_updated_at();

CREATE OR REPLACE FUNCTION update_syndication_platforms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER syndication_platforms_updated_at_trigger
BEFORE UPDATE ON syndication_platforms
FOR EACH ROW
EXECUTE FUNCTION update_syndication_platforms_updated_at();

-- Create view: active_syndications (listings currently syndicating)
CREATE VIEW active_syndications AS
SELECT
  sp.id,
  sp.unit_id,
  u.address,
  u.price,
  sp.platform,
  sp.status,
  sp.external_id,
  sp.external_url,
  sp.last_sync_at,
  sc.enabled
FROM syndication_platforms sp
JOIN units u ON sp.unit_id = u.id
JOIN syndication_configs sc ON u.id = sc.unit_id
WHERE sc.enabled = true
ORDER BY sp.updated_at DESC;

-- Verification queries (run after migration)
-- SELECT COUNT(*) FROM syndication_configs;  -- Should be 0
-- SELECT COUNT(*) FROM syndication_platforms;  -- Should be 0
-- SELECT COUNT(*) FROM syndication_history;  -- Should be 0
-- SELECT * FROM active_syndications;  -- Should be empty
