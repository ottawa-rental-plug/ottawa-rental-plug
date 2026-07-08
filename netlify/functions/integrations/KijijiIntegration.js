class KijijiIntegration {
  constructor() {
    // Kijiji credentials (for Apify actor to use)
    this.kijijiUsername = process.env.KIJIJI_USERNAME;
    this.kijijiPassword = process.env.KIJIJI_PASSWORD;

    // Apify configuration
    this.apifyApiToken = process.env.APIFY_API_TOKEN;
    this.apifyActorId = process.env.APIFY_KIJIJI_ACTOR_ID || 'apify/kijiji-post-lister';
    this.apifyBaseUrl = 'https://api.apify.com/v2';
    this.webhookSecret = process.env.KIJIJI_WEBHOOK_SECRET;

    // Retry configuration
    this.retryAttempts = parseInt(process.env.SYNDICATION_RETRY_ATTEMPTS || '3');
    this.retryDelayMs = parseInt(process.env.SYNDICATION_RETRY_DELAY_MS || '5000');
    this.jobPollIntervalMs = 2000; // Poll Apify job every 2 seconds
    this.jobTimeoutMs = 300000; // 5 minute timeout for job completion

    this.isConfigured = !!(this.kijijiUsername && this.kijijiPassword && this.apifyApiToken);
  }

  getApifyHeaders() {
    return {
      'Authorization': `Bearer ${this.apifyApiToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  async callApifyActor(input) {
    try {
      if (!this.isConfigured) {
        throw new Error('Kijiji/Apify not configured - requires KIJIJI_USERNAME, KIJIJI_PASSWORD, and APIFY_API_TOKEN');
      }

      console.log(`[Kijiji] Starting Apify actor: ${this.apifyActorId}`);

      // Call the actor
      const response = await fetch(
        `${this.apifyBaseUrl}/acts/${this.apifyActorId}/runs`,
        {
          method: 'POST',
          headers: this.getApifyHeaders(),
          body: JSON.stringify(input)
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Apify error: ${response.status} - ${error.message || response.statusText}`);
      }

      const runData = await response.json();
      const runId = runData.data.id;

      console.log(`[Kijiji] Apify job started: ${runId}`);

      // Wait for job completion
      const result = await this.waitForJobCompletion(runId);
      return result;
    } catch (error) {
      console.error('[Kijiji] Apify call failed:', error);
      throw error;
    }
  }

  async waitForJobCompletion(runId, pollCount = 0) {
    try {
      const response = await fetch(
        `${this.apifyBaseUrl}/runs/${runId}`,
        { headers: this.getApifyHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch run status: ${response.status}`);
      }

      const runData = await response.json();
      const status = runData.data.status;

      console.log(`[Kijiji] Job ${runId} status: ${status}`);

      // Job still running
      if (status === 'RUNNING' || status === 'READY') {
        if (pollCount * this.jobPollIntervalMs > this.jobTimeoutMs) {
          throw new Error(`Job timeout after ${this.jobTimeoutMs}ms`);
        }

        await this.sleep(this.jobPollIntervalMs);
        return this.waitForJobCompletion(runId, pollCount + 1);
      }

      // Job succeeded - fetch dataset
      if (status === 'SUCCEEDED') {
        const datasetId = runData.data.defaultDatasetId;
        const items = await this.getApifyDataset(datasetId);
        return {
          status: 'succeeded',
          runId,
          data: items
        };
      }

      // Job failed
      if (status === 'FAILED' || status === 'ABORTED') {
        throw new Error(`Apify job failed with status: ${status}`);
      }

      throw new Error(`Unknown job status: ${status}`);
    } catch (error) {
      console.error('[Kijiji] Error waiting for job completion:', error);
      throw error;
    }
  }

  async getApifyDataset(datasetId) {
    try {
      const response = await fetch(
        `${this.apifyBaseUrl}/datasets/${datasetId}/items`,
        { headers: this.getApifyHeaders() }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch dataset: ${response.status}`);
      }

      const data = await response.json();
      return data || [];
    } catch (error) {
      console.error('[Kijiji] Error fetching dataset:', error);
      throw error;
    }
  }

  async create(listing) {
    try {
      if (!this.isConfigured) {
        throw new Error('Kijiji not configured - requires KIJIJI_USERNAME, KIJIJI_PASSWORD, APIFY_API_TOKEN');
      }

      const payload = this.formatPayload(listing, 'create');

      console.log(`[Kijiji] Creating listing via Apify: ${listing.address}`);

      const input = {
        action: 'post',
        username: this.kijijiUsername,
        password: this.kijijiPassword,
        listings: [payload]
      };

      const result = await this.callApifyActor(input);

      if (!result.data || result.data.length === 0) {
        throw new Error('No listing created - Apify returned empty response');
      }

      const createdListing = result.data[0];
      const listingId = createdListing.kijiji_id || createdListing.listing_id;

      if (!listingId) {
        throw new Error('No listing ID in Apify response');
      }

      return {
        platform: 'kijiji',
        external_id: listingId,
        external_url: createdListing.url || this.buildKijijiUrl(listingId, listing),
        status: 'synced',
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('[Kijiji] Create failed:', error);
      throw error;
    }
  }

  async update(externalId, listing) {
    try {
      if (!this.isConfigured) {
        throw new Error('Kijiji not configured');
      }

      if (!externalId) {
        throw new Error('No external ID provided for update');
      }

      const payload = this.formatPayload(listing, 'update');
      payload.kijiji_id = externalId;

      console.log(`[Kijiji] Updating listing via Apify: ${externalId}`);

      const input = {
        action: 'update',
        username: this.kijijiUsername,
        password: this.kijijiPassword,
        listings: [payload]
      };

      const result = await this.callApifyActor(input);

      if (!result.data || result.data.length === 0) {
        throw new Error('Update failed - Apify returned empty response');
      }

      const updatedListing = result.data[0];

      return {
        platform: 'kijiji',
        external_id: externalId,
        external_url: updatedListing.url || this.buildKijijiUrl(externalId, listing),
        status: 'synced',
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('[Kijiji] Update failed:', error);
      throw error;
    }
  }

  async delete(externalId) {
    try {
      if (!this.isConfigured) {
        throw new Error('Kijiji not configured');
      }

      if (!externalId) {
        throw new Error('No external ID provided for deletion');
      }

      console.log(`[Kijiji] Deleting listing via Apify: ${externalId}`);

      const input = {
        action: 'delete',
        username: this.kijijiUsername,
        password: this.kijijiPassword,
        listing_ids: [externalId]
      };

      await this.callApifyActor(input);

      return {
        platform: 'kijiji',
        external_id: externalId,
        status: 'deleted',
        deleted_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('[Kijiji] Delete failed:', error);
      throw error;
    }
  }

  async getStatus(externalId) {
    try {
      if (!this.isConfigured) {
        throw new Error('Kijiji not configured');
      }

      if (!externalId) {
        throw new Error('No external ID provided');
      }

      console.log(`[Kijiji] Getting status for listing: ${externalId}`);

      const input = {
        action: 'get_status',
        username: this.kijijiUsername,
        password: this.kijijiPassword,
        listing_ids: [externalId]
      };

      const result = await this.callApifyActor(input);

      if (!result.data || result.data.length === 0) {
        throw new Error('Status check failed - Apify returned empty response');
      }

      const listing = result.data[0];

      return {
        external_id: externalId,
        status: listing.status || 'active',
        views: listing.view_count || 0,
        contacts: listing.contact_count || 0,
        last_updated: listing.updated_at,
        listing_url: listing.url || this.buildKijijiUrl(externalId)
      };
    } catch (error) {
      console.error('[Kijiji] Get status failed:', error);
      throw error;
    }
  }

  buildKijijiUrl(listingId, listing = null) {
    // Fallback URL construction if Apify doesn't return URL
    const type = listing?.type || 'rental-apartments';
    const neighbourhood = listing?.neighbourhood || 'ottawa';
    return `https://www.kijiji.ca/v-${type}/${neighbourhood}/${listingId}.html`;
  }

  formatPayload(listing, action = 'create') {
    const payload = {
      title: listing.title,
      description: listing.description,
      category: listing.category || 'real-estate-rental-apartments',
      price: listing.price,
      location: listing.neighbourhood,
      price_type: listing.price_type || 'fixed',
      details: {
        bedrooms: listing.beds,
        bathrooms: listing.baths,
        property_type: listing.type || 'apartment',
        furnished: false,
        lease_type: 'long_term'
      },
      images: (listing.photos || [])
        .sort((a, b) => a.display_order - b.display_order)
        .map(p => ({
          url: `${process.env.CDN_BASE_URL || 'https://cdn.ottawarentalplug.com'}/photos/${p.storage_path}`,
          alt_text: p.alt_text || listing.title
        })),
      contact: {
        name: 'Ottawa Rental Plug',
        email: process.env.ADMIN_EMAIL || 'contact@ottawarentalplug.com',
        phone: process.env.ORP_PHONE || ''
      },
      external_reference: listing.orp_unit_id,
      source_url: `https://ottawarentalplug.com/listing/${listing.orp_unit_id}`
    };

    return payload;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  verifyWebhookSignature(event) {
    // Kijiji doesn't currently support webhooks through official channels
    // Manual lead tracking via Kijiji dashboard is recommended
    console.log('[Kijiji] Note: Kijiji webhooks not available - use manual tracking');
    return false;
  }
}

module.exports = KijijiIntegration;
