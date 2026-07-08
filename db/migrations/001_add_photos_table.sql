-- Migration 001: Add Photos Table for Property Listings
-- Description: Creates the photos table to store property images with Supabase Storage integration
-- Created: 2026-07-07
-- Status: Ready for Production

-- Create photos table
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL,

  -- File Storage References
  storage_path TEXT NOT NULL,        -- Path in Supabase Storage: units/[unit_id]/[filename]
  thumbnail_path TEXT,                -- Path to generated thumbnail

  -- Metadata
  alt_text TEXT,                      -- Accessibility text for screen readers
  display_order SMALLINT DEFAULT 0,  -- Sort order for photo gallery
  is_primary BOOLEAN DEFAULT false,   -- Flag for listing hero image

  -- Timestamps
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  -- Constraints
  CONSTRAINT fk_photos_unit
    FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE,
  CONSTRAINT ck_display_order
    CHECK (display_order >= 0),
  CONSTRAINT ck_storage_path_not_empty
    CHECK (storage_path IS NOT NULL AND storage_path != '')
);

-- Create indexes for performance
CREATE INDEX idx_photos_unit_id ON photos(unit_id);
CREATE INDEX idx_photos_order ON photos(unit_id, display_order);
CREATE INDEX idx_photos_is_primary ON photos(unit_id, is_primary);

-- Enable Row Level Security
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admin has full access
CREATE POLICY admin_photos ON photos
  USING (auth.jwt() ->> 'email' = 'cyrilrentsottawa@gmail.com');

-- RLS Policy: Landlords can manage photos for their own units
CREATE POLICY landlord_photos ON photos
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

-- RLS Policy: Public can view photos for available units
CREATE POLICY public_photos ON photos
  FOR SELECT USING (unit_id IN (
    SELECT id FROM units WHERE status = 'available'
  ));

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_photos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER photos_updated_at_trigger
BEFORE UPDATE ON photos
FOR EACH ROW
EXECUTE FUNCTION update_photos_updated_at();

-- Verification queries (run after migration)
-- SELECT COUNT(*) FROM photos;  -- Should be 0
-- SELECT * FROM information_schema.tables WHERE table_name = 'photos';  -- Should exist
-- SELECT * FROM information_schema.table_constraints WHERE table_name = 'photos';  -- Check constraints
