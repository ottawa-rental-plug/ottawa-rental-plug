-- Migration 003: Add Performance Indexes for Syndication System
-- Description: Creates additional indexes to optimize syndication queries
-- Created: 2026-07-07
-- Status: Ready for Production

-- Composite index for syndication status checks
CREATE INDEX idx_syndication_platforms_unit_status ON syndication_platforms(unit_id, status)
  WHERE status != 'paused';  -- Quickly find units needing sync

-- Index for pending syncs (used by sync job)
CREATE INDEX idx_syndication_platforms_pending ON syndication_platforms(platform, status)
  WHERE status = 'pending';

-- Index for failed syncs (used by retry job)
CREATE INDEX idx_syndication_platforms_failed ON syndication_platforms(platform, last_sync_at DESC)
  WHERE status = 'failed';

-- Index for recent changes (used by webhook handlers)
CREATE INDEX idx_syndication_history_recent ON syndication_history(unit_id, platform, created_at DESC);

-- Index for audit queries (used by dashboard)
CREATE INDEX idx_syndication_history_by_platform ON syndication_history(platform, created_at DESC);

-- Index for photos queries
CREATE INDEX idx_photos_unit_primary ON photos(unit_id)
  WHERE is_primary = true;  -- Quick lookup of primary photo per unit

-- Composite index for photo gallery (common query pattern)
CREATE INDEX idx_photos_unit_order_created ON photos(unit_id, display_order ASC, created_at DESC);

-- Index for storage cleanup (used by maintenance jobs)
CREATE INDEX idx_photos_older_than ON photos(created_at)
  WHERE created_at < now() - interval '90 days';

-- Verify indexes were created
-- SELECT indexname FROM pg_indexes
-- WHERE tablename IN ('photos', 'syndication_configs', 'syndication_platforms', 'syndication_history', 'units')
-- ORDER BY tablename, indexname;

-- Check index sizes and usage
-- SELECT
--   schemaname,
--   tablename,
--   indexname,
--   pg_size_pretty(pg_relation_size(indexrelid)) as size
-- FROM pg_stat_user_indexes
-- WHERE tablename IN ('photos', 'syndication_platforms', 'syndication_history')
-- ORDER BY pg_relation_size(indexrelid) DESC;
