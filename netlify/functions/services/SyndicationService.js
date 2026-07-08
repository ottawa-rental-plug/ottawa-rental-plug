const { supabase } = require('../utils/supabase');
const RealtorCaIntegration = require('../integrations/RealtorCaIntegration');
const KijijiIntegration = require('../integrations/KijijiIntegration');
const AirbnbIntegration = require('../integrations/AirbnbIntegration');

class SyndicationService {
  constructor() {
    this.platforms = {
      realtor_ca: new RealtorCaIntegration(),
      kijiji: new KijijiIntegration(),
      airbnb: new AirbnbIntegration()
    };
  }

  async syncListing(unitId, platforms = ['realtor_ca', 'kijiji']) {
    try {
      console.log(`[Syndication] Starting sync for unit ${unitId} to platforms: ${platforms.join(', ')}`);

      // Get unit data with photos
      const unit = await this.getUnitWithPhotos(unitId);
      if (!unit) {
        throw new Error(`Unit ${unitId} not found`);
      }

      // Check syndication config
      const config = await this.getSyndicationConfig(unitId);
      if (!config.enabled) {
        throw new Error('Syndication disabled for this unit');
      }

      // Validate we have photos
      if (!unit.photos || unit.photos.length === 0) {
        throw new Error('Cannot syndicate: no photos uploaded yet');
      }

      // Sync to each platform
      const results = {};
      for (const platform of platforms) {
        if (!this.platforms[platform]) {
          results[platform] = { error: `Unknown platform: ${platform}`, status: 'failed' };
          continue;
        }

        try {
          const startTime = Date.now();
          results[platform] = await this.syncToPlatform(unit, platform);
          const duration = Date.now() - startTime;

          // Record success
          await this.recordSyncHistory(unitId, platform, 'synced', {
            external_id: results[platform].external_id,
            external_url: results[platform].external_url,
            duration_ms: duration
          });

          console.log(`[Syndication] Successfully synced to ${platform} in ${duration}ms`);
        } catch (err) {
          results[platform] = { error: err.message, status: 'failed' };

          // Record failure
          await this.recordSyncHistory(unitId, platform, 'error', {
            error_message: err.message,
            error_stack: err.stack
          });

          console.error(`[Syndication] Failed to sync to ${platform}:`, err.message);
        }
      }

      return results;
    } catch (error) {
      console.error('[Syndication] Fatal error during sync:', error);
      throw error;
    }
  }

  async syncToPlatform(unit, platform) {
    const integration = this.platforms[platform];
    if (!integration) throw new Error(`Unknown platform: ${platform}`);

    // Check if already synced
    const existing = await this.getPlatformRecord(unit.id, platform);

    const payload = this.formatListing(unit, platform);

    let result;
    if (existing && existing.external_id) {
      // Update existing listing
      result = await integration.update(existing.external_id, payload);
      // Update platform record
      await this.updatePlatformRecord(unit.id, platform, result);
    } else {
      // Create new listing
      result = await integration.create(payload);
      // Create platform record
      await this.createPlatformRecord(unit.id, platform, result);
    }

    return result;
  }

  async getUnitWithPhotos(unitId) {
    try {
      const { data, error } = await supabase
        .from('units')
        .select(`
          id,
          beds,
          baths,
          type,
          price,
          address,
          neighbourhood,
          description,
          status,
          photos:photos(id, storage_path, thumbnail_path, alt_text, display_order, is_primary)
        `)
        .eq('id', unitId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[Syndication] Error fetching unit:', error);
      throw error;
    }
  }

  async getSyndicationConfig(unitId) {
    try {
      const { data, error } = await supabase
        .from('syndication_configs')
        .select('*')
        .eq('unit_id', unitId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      // Create default config if missing
      if (!data) {
        const { data: created, error: createError } = await supabase
          .from('syndication_configs')
          .insert([{ unit_id: unitId, enabled: true }])
          .select()
          .single();

        if (createError) throw createError;
        return created;
      }

      return data;
    } catch (error) {
      console.error('[Syndication] Error getting syndication config:', error);
      throw error;
    }
  }

  async getPlatformRecord(unitId, platform) {
    try {
      const { data, error } = await supabase
        .from('syndication_platforms')
        .select('*')
        .eq('unit_id', unitId)
        .eq('platform', platform)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error(`[Syndication] Error fetching platform record for ${platform}:`, error);
      return null;
    }
  }

  async createPlatformRecord(unitId, platform, result) {
    try {
      const { error } = await supabase
        .from('syndication_platforms')
        .insert([{
          unit_id: unitId,
          platform,
          external_id: result.external_id,
          external_url: result.external_url,
          status: 'synced',
          last_sync_at: new Date().toISOString()
        }]);

      if (error) throw error;
    } catch (error) {
      console.error(`[Syndication] Error creating platform record for ${platform}:`, error);
      throw error;
    }
  }

  async updatePlatformRecord(unitId, platform, result) {
    try {
      const { error } = await supabase
        .from('syndication_platforms')
        .update({
          external_url: result.external_url,
          status: 'synced',
          last_sync_at: new Date().toISOString(),
          last_error: null
        })
        .eq('unit_id', unitId)
        .eq('platform', platform);

      if (error) throw error;
    } catch (error) {
      console.error(`[Syndication] Error updating platform record for ${platform}:`, error);
      throw error;
    }
  }

  async recordSyncHistory(unitId, platform, action, details) {
    try {
      const { error } = await supabase
        .from('syndication_history')
        .insert([{
          unit_id: unitId,
          platform,
          action,
          details: details || {}
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('[Syndication] Error recording sync history:', error);
      // Don't throw - history logging failure shouldn't stop the sync
    }
  }

  formatListing(unit, platform) {
    const photoUrls = (unit.photos || [])
      .sort((a, b) => a.display_order - b.display_order)
      .map(p => ({
        storage_path: p.storage_path,
        thumbnail_path: p.thumbnail_path,
        alt_text: p.alt_text || `Photo for ${unit.address}`,
        is_primary: p.is_primary
      }));

    const base = {
      title: `${unit.beds}bed, ${unit.baths}bath ${unit.type || 'apartment'}`,
      description: unit.description || '',
      beds: unit.beds,
      baths: unit.baths,
      type: unit.type || 'apartment',
      price: unit.price,
      address: unit.address,
      neighbourhood: unit.neighbourhood,
      photos: photoUrls,
      orp_unit_id: unit.id,
      orp_source: 'ottawarentalplug.com'
    };

    // Platform-specific formatting
    if (platform === 'realtor_ca') {
      return {
        ...base,
        property_type: this.mapPropertyType(unit.type),
        mls_source: 'ORP',
        listing_type: 'Rental'
      };
    }

    if (platform === 'kijiji') {
      return {
        ...base,
        category: 'real-estate-rental-apartments',
        location: unit.neighbourhood,
        price_type: 'fixed'
      };
    }

    if (platform === 'airbnb') {
      return {
        ...base,
        listing_type: 'entire_home',
        room_type: 'Entire home/apt',
        accommodates: Math.ceil((unit.beds || 1) * 2)
      };
    }

    return base;
  }

  mapPropertyType(type) {
    const mapping = {
      'apartment': 'Apartment',
      'condo': 'Condo',
      'townhouse': 'Townhouse',
      'house': 'Single Family',
      'bachelor': 'Apartment',
      'studio': 'Apartment'
    };
    return mapping[type?.toLowerCase()] || 'Apartment';
  }

  async getSyndicationStatus(unitId) {
    try {
      const { data, error } = await supabase
        .from('syndication_platforms')
        .select('platform, status, external_id, external_url, last_sync_at, last_error')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[Syndication] Error fetching syndication status:', error);
      throw error;
    }
  }

  async getSyncHistory(unitId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('syndication_history')
        .select('*')
        .eq('unit_id', unitId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[Syndication] Error fetching sync history:', error);
      throw error;
    }
  }

  async deleteListing(unitId, platforms = ['realtor_ca', 'kijiji']) {
    try {
      console.log(`[Syndication] Deleting listing ${unitId} from platforms: ${platforms.join(', ')}`);

      const results = {};
      for (const platform of platforms) {
        try {
          const record = await this.getPlatformRecord(unitId, platform);
          if (!record || !record.external_id) {
            results[platform] = { status: 'not_synced' };
            continue;
          }

          const integration = this.platforms[platform];
          if (!integration) {
            results[platform] = { error: `Unknown platform: ${platform}` };
            continue;
          }

          await integration.delete(record.external_id);
          results[platform] = { status: 'deleted' };

          // Record deletion
          await this.recordSyncHistory(unitId, platform, 'deleted', {
            external_id: record.external_id
          });

          console.log(`[Syndication] Successfully deleted from ${platform}`);
        } catch (err) {
          results[platform] = { error: err.message, status: 'delete_failed' };
          console.error(`[Syndication] Failed to delete from ${platform}:`, err.message);
        }
      }

      return results;
    } catch (error) {
      console.error('[Syndication] Fatal error during deletion:', error);
      throw error;
    }
  }
}

module.exports = SyndicationService;
