class RealtorCaIntegration {
  constructor() {
    // OAuth credentials (from Realtor.ca DDF registration)
    this.clientId = process.env.REALTOR_CA_CLIENT_ID;
    this.clientSecret = process.env.REALTOR_CA_CLIENT_SECRET;

    // API configuration
    this.tokenUrl = 'https://identity.crea.ca/connect/token';
    this.baseUrl = process.env.REALTOR_CA_API_URL || 'https://ddfapi.realtor.ca';
    this.webhookSecret = process.env.REALTOR_CA_WEBHOOK_SECRET;

    // Retry configuration
    this.retryAttempts = parseInt(process.env.SYNDICATION_RETRY_ATTEMPTS || '3');
    this.retryDelayMs = parseInt(process.env.SYNDICATION_RETRY_DELAY_MS || '5000');

    // Token cache
    this.accessToken = null;
    this.tokenExpiresAt = null;

    this.isConfigured = !!(this.clientId && this.clientSecret);
  }

  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt - 60000) {
      console.log('[RealtorCa] Using cached access token');
      return this.accessToken;
    }

    try {
      console.log('[RealtorCa] Requesting new access token');

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: 'DDFApi_Read'
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Token request failed: ${response.status} - ${error.error_description || error.message || response.statusText}`);
      }

      const data = await response.json();

      if (!data.access_token) {
        throw new Error('No access token in response');
      }

      // Cache token with 1-minute buffer before expiry
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);

      console.log(`[RealtorCa] Token acquired, expires in ${data.expires_in}s`);
      return this.accessToken;
    } catch (error) {
      console.error('[RealtorCa] Token request error:', error);
      throw error;
    }
  }

  async getHeaders() {
    const token = await this.getAccessToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  async request(method, path, body = null, attempt = 1) {
    try {
      if (!this.isConfigured) {
        throw new Error('Realtor.ca not configured - requires REALTOR_CA_CLIENT_ID and REALTOR_CA_CLIENT_SECRET');
      }

      const url = `${this.baseUrl}${path}`;
      const headers = await this.getHeaders();
      const options = {
        method,
        headers
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      console.log(`[RealtorCa] ${method} ${path} (attempt ${attempt}/${this.retryAttempts})`);

      const response = await fetch(url, options);

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          console.log(`[RealtorCa] Rate limited, retrying after ${delay}ms`);
          await this.sleep(delay);
          return this.request(method, path, body, attempt + 1);
        }
        throw new Error(`Rate limited after ${this.retryAttempts} attempts`);
      }

      // Handle server errors with retry
      if (response.status >= 500 && attempt < this.retryAttempts) {
        const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
        console.log(`[RealtorCa] Server error ${response.status}, retrying after ${delay}ms`);
        await this.sleep(delay);
        return this.request(method, path, body, attempt + 1);
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error(`[RealtorCa] Error ${response.status}:`, data);
        throw new Error(
          data.error?.message ||
          data.message ||
          `API error: ${response.status} ${response.statusText}`
        );
      }

      return data;
    } catch (error) {
      console.error(`[RealtorCa] Request failed:`, error.message);
      throw error;
    }
  }

  async create(listing) {
    try {
      if (!this.apiKey) {
        throw new Error('Realtor.ca API key not configured');
      }

      // Format listing for Realtor.ca
      const payload = this.formatPayload(listing);

      console.log(`[RealtorCa] Creating listing: ${listing.address}`);

      const response = await this.request('POST', '/listings', payload);

      if (!response.id) {
        throw new Error('No listing ID returned from API');
      }

      return {
        platform: 'realtor_ca',
        external_id: response.id,
        external_url: `https://www.realtor.ca/listing/${response.id}`,
        status: 'synced',
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('[RealtorCa] Create failed:', error);
      throw error;
    }
  }

  async update(externalId, listing) {
    try {
      if (!this.apiKey) {
        throw new Error('Realtor.ca API key not configured');
      }

      if (!externalId) {
        throw new Error('No external ID provided for update');
      }

      const payload = this.formatPayload(listing);

      console.log(`[RealtorCa] Updating listing: ${externalId}`);

      const response = await this.request('PUT', `/listings/${externalId}`, payload);

      return {
        platform: 'realtor_ca',
        external_id: externalId,
        external_url: `https://www.realtor.ca/listing/${externalId}`,
        status: 'synced',
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('[RealtorCa] Update failed:', error);
      throw error;
    }
  }

  async delete(externalId) {
    try {
      if (!this.apiKey) {
        throw new Error('Realtor.ca API key not configured');
      }

      if (!externalId) {
        throw new Error('No external ID provided for deletion');
      }

      console.log(`[RealtorCa] Deleting listing: ${externalId}`);

      await this.request('DELETE', `/listings/${externalId}`);

      return {
        platform: 'realtor_ca',
        external_id: externalId,
        status: 'deleted',
        deleted_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('[RealtorCa] Delete failed:', error);
      throw error;
    }
  }

  async getStatus(externalId) {
    try {
      if (!this.apiKey) {
        throw new Error('Realtor.ca API key not configured');
      }

      if (!externalId) {
        throw new Error('No external ID provided');
      }

      console.log(`[RealtorCa] Getting status for listing: ${externalId}`);

      const response = await this.request('GET', `/listings/${externalId}/status`);

      return {
        external_id: externalId,
        status: response.status || 'active',
        views: response.view_count || 0,
        inquiries: response.inquiry_count || 0,
        last_updated: response.updated_at,
        listing_url: `https://www.realtor.ca/listing/${externalId}`
      };
    } catch (error) {
      console.error('[RealtorCa] Get status failed:', error);
      throw error;
    }
  }

  formatPayload(listing) {
    return {
      title: listing.title,
      description: listing.description,
      address: listing.address,
      neighbourhood: listing.neighbourhood,
      price: listing.price,
      bedrooms: listing.beds,
      bathrooms: listing.baths,
      property_type: listing.property_type || this.mapPropertyType(listing.type),
      listing_type: listing.listing_type || 'Rental',
      mls_source: listing.mls_source || 'ORP',
      photos: (listing.photos || []).map(p => ({
        url: `${process.env.CDN_BASE_URL || 'https://cdn.ottawarentalplug.com'}/photos/${p.storage_path}`,
        alt_text: p.alt_text || listing.title,
        is_primary: p.is_primary || false
      })),
      external_reference: listing.orp_unit_id,
      source_url: `https://ottawarentalplug.com/listing/${listing.orp_unit_id}`
    };
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

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  verifyWebhookSignature(event) {
    if (!this.webhookSecret) {
      console.warn('[RealtorCa] Webhook secret not configured');
      return false;
    }

    const crypto = require('crypto');
    const signature = event.headers['x-realtor-signature'];
    const timestamp = event.headers['x-realtor-timestamp'];
    const body = event.body;

    if (!signature || !timestamp) {
      console.warn('[RealtorCa] Missing webhook headers');
      return false;
    }

    // Construct the signed content
    const message = `${timestamp}${body}`;
    const hash = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(message)
      .digest('hex');

    try {
      return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}

module.exports = RealtorCaIntegration;
