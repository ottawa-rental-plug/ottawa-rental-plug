class AirbnbIntegration {
  constructor() {
    this.apiKey = process.env.AIRBNB_API_KEY;
    this.clientId = process.env.AIRBNB_CLIENT_ID;
    this.baseUrl = process.env.AIRBNB_API_URL || 'https://api.airbnb.com/v2';
    this.webhookSecret = process.env.AIRBNB_WEBHOOK_SECRET;
    this.retryAttempts = parseInt(process.env.SYNDICATION_RETRY_ATTEMPTS || '3');
    this.retryDelayMs = parseInt(process.env.SYNDICATION_RETRY_DELAY_MS || '5000');
    this.isConfigured = !!(this.apiKey && this.clientId);
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Airbnb-Client-ID': this.clientId
    };
  }

  async request(method, path, body = null, attempt = 1) {
    try {
      if (!this.isConfigured) {
        throw new Error('Airbnb API not configured - requires partnership approval');
      }

      const url = `${this.baseUrl}${path}`;
      const options = {
        method,
        headers: this.getHeaders()
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      console.log(`[Airbnb] ${method} ${path} (attempt ${attempt}/${this.retryAttempts})`);

      const response = await fetch(url, options);

      // Handle rate limiting
      if (response.status === 429) {
        if (attempt < this.retryAttempts) {
          const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
          console.log(`[Airbnb] Rate limited, retrying after ${delay}ms`);
          await this.sleep(delay);
          return this.request(method, path, body, attempt + 1);
        }
        throw new Error(`Rate limited after ${this.retryAttempts} attempts`);
      }

      // Handle server errors
      if (response.status >= 500 && attempt < this.retryAttempts) {
        const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
        console.log(`[Airbnb] Server error ${response.status}, retrying after ${delay}ms`);
        await this.sleep(delay);
        return this.request(method, path, body, attempt + 1);
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error(`[Airbnb] Error ${response.status}:`, data);
        throw new Error(
          data.error_message ||
          data.message ||
          `API error: ${response.status} ${response.statusText}`
        );
      }

      return data;
    } catch (error) {
      console.error(`[Airbnb] Request failed:`, error.message);
      throw error;
    }
  }

  async create(listing) {
    try {
      if (!this.isConfigured) {
        throw new Error('Airbnb API not configured');
      }

      const payload = this.formatPayload(listing);

      console.log(`[Airbnb] Creating listing: ${listing.address}`);

      const response = await this.request('POST', '/listings', payload);

      if (!response.id) {
        throw new Error('No listing ID returned from API');
      }

      return {
        platform: 'airbnb',
        external_id: response.id,
        external_url: `https://www.airbnb.ca/rooms/${response.id}`,
        status: 'synced',
        created_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('[Airbnb] Create failed:', error);
      throw error;
    }
  }

  async update(externalId, listing) {
    try {
      if (!this.isConfigured) {
        throw new Error('Airbnb API not configured');
      }

      if (!externalId) {
        throw new Error('No external ID provided for update');
      }

      const payload = this.formatPayload(listing);

      console.log(`[Airbnb] Updating listing: ${externalId}`);

      const response = await this.request('PUT', `/listings/${externalId}`, payload);

      return {
        platform: 'airbnb',
        external_id: externalId,
        external_url: `https://www.airbnb.ca/rooms/${externalId}`,
        status: 'synced',
        updated_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('[Airbnb] Update failed:', error);
      throw error;
    }
  }

  async delete(externalId) {
    try {
      if (!this.isConfigured) {
        throw new Error('Airbnb API not configured');
      }

      if (!externalId) {
        throw new Error('No external ID provided for deletion');
      }

      console.log(`[Airbnb] Deleting listing: ${externalId}`);

      await this.request('DELETE', `/listings/${externalId}`);

      return {
        platform: 'airbnb',
        external_id: externalId,
        status: 'deleted',
        deleted_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('[Airbnb] Delete failed:', error);
      throw error;
    }
  }

  async getStatus(externalId) {
    try {
      if (!this.isConfigured) {
        throw new Error('Airbnb API not configured');
      }

      if (!externalId) {
        throw new Error('No external ID provided');
      }

      console.log(`[Airbnb] Getting status for listing: ${externalId}`);

      const response = await this.request('GET', `/listings/${externalId}`);

      return {
        external_id: externalId,
        status: response.listing_state || 'active',
        instant_bookable: response.instant_bookable || false,
        reviews_count: response.review_count || 0,
        review_rating: response.rating || 0,
        last_updated: response.updated_at,
        listing_url: `https://www.airbnb.ca/rooms/${externalId}`
      };
    } catch (error) {
      console.error('[Airbnb] Get status failed:', error);
      throw error;
    }
  }

  async updateAvailability(externalId, availabilityData) {
    try {
      if (!this.isConfigured) {
        throw new Error('Airbnb API not configured');
      }

      console.log(`[Airbnb] Updating availability for ${externalId}`);

      const response = await this.request(
        'PUT',
        `/listings/${externalId}/availability`,
        availabilityData
      );

      return response;
    } catch (error) {
      console.error('[Airbnb] Update availability failed:', error);
      throw error;
    }
  }

  formatPayload(listing) {
    // Note: Primary photo MUST be first for Airbnb
    const photos = (listing.photos || [])
      .sort((a, b) => {
        if (a.is_primary) return -1;
        if (b.is_primary) return 1;
        return a.display_order - b.display_order;
      })
      .map(p => ({
        url: `${process.env.CDN_BASE_URL || 'https://cdn.ottawarentalplug.com'}/photos/${p.storage_path}`,
        caption: p.alt_text || listing.title
      }));

    return {
      name: listing.title,
      description: listing.description,
      address: {
        street: listing.address,
        city: 'Ottawa',
        state: 'ON',
        country: 'CA'
      },
      price: listing.price,
      price_currency: 'CAD',
      listing_type: listing.listing_type || 'entire_home',
      room_type: listing.room_type || 'Entire home/apt',
      accommodates: listing.accommodates || Math.ceil((listing.beds || 1) * 2),
      bedrooms: listing.beds,
      beds: listing.beds,
      bathrooms: listing.baths,
      amenities: this.getAmenities(listing),
      photos: photos,
      house_rules: 'Please treat the property with respect. No smoking or pets unless agreed.',
      neighbourhood_overview: listing.neighbourhood,
      checkin_time: '16:00',
      checkout_time: '11:00',
      minimum_nights: 1,
      maximum_nights: 365,
      cancellation_policy: 'moderate',
      external_reference: listing.orp_unit_id,
      source_url: `https://ottawarentalplug.com/listing/${listing.orp_unit_id}`
    };
  }

  getAmenities(listing) {
    const amenities = [];

    // Basic amenities based on listing type
    if (listing.type === 'apartment' || listing.type === 'condo') {
      amenities.push('Wifi', 'Kitchen', 'Heating', 'Essentials');
    }

    if (listing.type === 'house') {
      amenities.push('Wifi', 'Kitchen', 'Washer', 'Dryer', 'Heating', 'Parking', 'Essentials');
    }

    return amenities;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  verifyWebhookSignature(event) {
    if (!this.webhookSecret) {
      console.warn('[Airbnb] Webhook secret not configured');
      return false;
    }

    const crypto = require('crypto');
    const signature = event.headers['x-airbnb-signature'];
    const timestamp = event.headers['x-airbnb-timestamp'];
    const nonce = event.headers['x-airbnb-nonce'];
    const body = event.body;

    if (!signature || !timestamp || !nonce) {
      console.warn('[Airbnb] Missing webhook headers');
      return false;
    }

    // Construct the signed content: timestamp.nonce.body
    const message = `${timestamp}.${nonce}.${body}`;
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

module.exports = AirbnbIntegration;
