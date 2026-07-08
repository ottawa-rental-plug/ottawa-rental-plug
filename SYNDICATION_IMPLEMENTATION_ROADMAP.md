# Rental Listing Syndication - Implementation Roadmap
## Phase 14: From Discovery to Syndicated Listings

**Project Scope:** Add multi-platform listing syndication to ORP  
**Timeline:** 6-8 weeks  
**Status:** READY FOR APPROVAL  
**Lead Engineer:** Cyril Babalola

---

## PROJECT OVERVIEW

### Success Criteria
- ✅ Photos uploaded and served via CDN
- ✅ Listings syndicated to Realtor.ca
- ✅ Listings syndicated to Kijiji
- ✅ Real-time sync from ORP → platforms
- ✅ Zero data loss on sync failures
- ✅ <3 second photo load time (CDN)
- ✅ 100% uptime during syndication

### Business Impact
- **Reach:** 5-10x more renters
- **Conversion:** Higher application volume from syndicated channels
- **Marketing:** Listings appear where renters search
- **Operations:** Automated sync (no manual uploads)

### Architecture Overview

```
ORP Database (Units + Photos)
    ↓
Syndication API Layer
    ├─ Realtor.ca Integration
    ├─ Kijiji Integration
    ├─ Airbnb Integration (later)
    └─ Other Platforms (future)
    ↓
External Platforms
    ├─ Realtor.ca ← 40% of market
    ├─ Kijiji ← 30% of market
    └─ Others ← 30% of market
```

---

## MILESTONE BREAKDOWN

### MILESTONE 1: Foundation Setup (Week 1)
**Objective:** Prepare database and infrastructure  
**Deliverables:** Schema, migrations, configuration  
**Testing:** Database integrity tests

#### 1.1 Database Schema Migration
**Task:** Add new tables and columns

**Files to Create:**
- `db/migrations/001_add_photos_table.sql`
- `db/migrations/002_add_syndication_tables.sql`
- `db/migrations/003_add_indexes.sql`

**SQL to Create:**

```sql
-- Migration 001: Photos Table
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id),
  
  -- File Storage
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  
  -- Metadata
  alt_text TEXT,
  display_order SMALLINT DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- Indexes
  CONSTRAINT fk_photos_unit FOREIGN KEY (unit_id) 
    REFERENCES units(id) ON DELETE CASCADE,
  INDEX idx_photos_unit_id (unit_id),
  INDEX idx_photos_order (unit_id, display_order)
);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admin full, Landlord own
CREATE POLICY landlord_photos ON photos
  USING (unit_id IN (
    SELECT id FROM units 
    WHERE landlord_id IN (
      SELECT id FROM landlords WHERE auth_user_id = auth.uid()
    )
  ));

-- Migration 002: Syndication Tables
CREATE TABLE syndication_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id),
  
  -- Settings
  enabled BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT fk_syndication_unit FOREIGN KEY (unit_id)
    REFERENCES units(id) ON DELETE CASCADE,
  UNIQUE(unit_id)
);

CREATE TABLE syndication_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id),
  
  -- Platform Info
  platform TEXT NOT NULL,  -- "realtor_ca", "kijiji", "airbnb"
  external_id TEXT,
  external_url TEXT,
  
  -- Sync Status
  status TEXT DEFAULT 'pending',  -- "pending", "synced", "failed"
  last_sync_at TIMESTAMP,
  last_error TEXT,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT fk_platform_unit FOREIGN KEY (unit_id)
    REFERENCES units(id) ON DELETE CASCADE,
  CONSTRAINT ck_platform_name CHECK (platform IN ('realtor_ca', 'kijiji', 'airbnb')),
  UNIQUE(unit_id, platform),
  INDEX idx_platform_status (status),
  INDEX idx_platform_last_sync (last_sync_at)
);

CREATE TABLE syndication_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id),
  platform TEXT NOT NULL,
  
  -- Action
  action TEXT,  -- "created", "updated", "deleted", "error"
  details JSONB,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT now(),
  
  CONSTRAINT fk_history_unit FOREIGN KEY (unit_id)
    REFERENCES units(id) ON DELETE CASCADE,
  INDEX idx_history_unit_platform (unit_id, platform),
  INDEX idx_history_created (created_at)
);

-- Migration 003: Performance Indexes
CREATE INDEX idx_units_photos_count ON units 
  USING (id) WHERE status = 'available';
  
CREATE INDEX idx_syndication_pending ON syndication_platforms
  WHERE status = 'pending';
```

**Testing:**
- [ ] Run migrations against staging database
- [ ] Verify all tables created
- [ ] Test RLS policies
- [ ] Verify indexes created
- [ ] No data loss

**Acceptance Criteria:**
- ✅ All migrations execute without errors
- ✅ RLS policies enforced correctly
- ✅ Indexes improve query performance
- ✅ Rollback works (test migration down)

---

#### 1.2 Configuration & Environment Setup
**Task:** Add configuration for syndication

**File to Create:** `.env.example` and update

```bash
# Syndication Platform Credentials
REALTOR_CA_API_KEY=...
REALTOR_CA_CLIENT_ID=...
REALTOR_CA_API_URL=https://api.realtor.ca/v1

KIJIJI_API_KEY=...
KIJIJI_API_URL=https://api.kijiji.ca/v1

# Storage & CDN
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ZONE_ID=...
CLOUDFLARE_ACCOUNT_ID=...
CDN_BASE_URL=https://cdn.ottawarentalplug.com

# Image Processing
IMAGE_MAX_SIZE=10485760  # 10MB
IMAGE_FORMATS=jpg,jpeg,png,webp
IMAGE_QUALITY=85
THUMBNAIL_WIDTH=300
THUMBNAIL_HEIGHT=225

# Syndication Settings
SYNDICATION_BATCH_SIZE=50
SYNDICATION_RETRY_ATTEMPTS=3
SYNDICATION_RETRY_DELAY_MS=5000
```

**Testing:**
- [ ] Verify environment variables load correctly
- [ ] Test with invalid values (should fail gracefully)
- [ ] Verify secrets not logged

**Acceptance Criteria:**
- ✅ Config loaded from environment
- ✅ All required vars present
- ✅ No secrets in code

---

### MILESTONE 2: Photo System (Weeks 2-3)
**Objective:** Upload, store, and serve photos  
**Deliverables:** Upload UI, storage integration, CDN setup  
**Testing:** Integration tests with real file uploads

#### 2.1 Supabase Storage Setup
**Task:** Configure Supabase Storage bucket

**Steps:**
1. Create bucket in Supabase console
2. Set bucket to public (enable CDN)
3. Configure CORS
4. Add RLS policies
5. Test file upload/download

**Supabase Console Tasks:**
- [ ] Create `photos` bucket
- [ ] Enable public access
- [ ] Configure CORS for ottawarentalplug.com
- [ ] Set upload limit to 10MB
- [ ] Enable versioning (for rollback)

**SQL (RLS for Storage):**
```sql
CREATE POLICY "Landlord can upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'photos' AND
    (storage.foldername(name))[1] = (
      SELECT id::text FROM landlords 
      WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Public read photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'photos');
```

**Testing:**
- [ ] Upload file via Supabase SDK
- [ ] Verify file stored in correct folder
- [ ] Verify RLS prevents unauthorized access
- [ ] Verify public URL works
- [ ] Test large file (>5MB)
- [ ] Test invalid formats

**Acceptance Criteria:**
- ✅ Files upload to correct location
- ✅ Public URL accessible
- ✅ Storage quota monitored
- ✅ No unauthorized access

---

#### 2.2 Photo Upload Component
**Task:** Build UI for uploading photos

**File to Create:** `/js/components/PhotoUploader.js`

```javascript
class PhotoUploader {
  constructor(containerId, supabaseClient) {
    this.container = document.getElementById(containerId);
    this.supabase = supabaseClient;
    this.files = [];
    this.uploadInProgress = false;
  }

  init() {
    this.render();
    this.attachEventListeners();
  }

  render() {
    this.container.innerHTML = `
      <div class="photo-uploader">
        <div class="upload-area" id="uploadArea">
          <svg>...</svg>
          <p>Drag photos here or click to browse</p>
          <input type="file" id="fileInput" multiple accept="image/*">
        </div>
        <div class="photo-preview" id="photoPreview"></div>
        <button id="uploadBtn" disabled>Upload Photos</button>
        <div id="uploadProgress"></div>
      </div>
    `;
  }

  attachEventListeners() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    const uploadBtn = document.getElementById('uploadBtn');

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => e.preventDefault());
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      this.handleFiles(e.dataTransfer.files);
    });

    // Click to upload
    fileInput.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
    });

    // Upload button
    uploadBtn.addEventListener('click', () => this.uploadFiles());
  }

  handleFiles(fileList) {
    this.files = Array.from(fileList).filter(f => {
      if (!f.type.startsWith('image/')) {
        alert('Only images allowed');
        return false;
      }
      if (f.size > 10 * 1024 * 1024) {
        alert('File too large (max 10MB)');
        return false;
      }
      return true;
    });

    this.renderPreview();
  }

  renderPreview() {
    const preview = document.getElementById('photoPreview');
    preview.innerHTML = this.files.map((f, i) => `
      <div class="preview-item">
        <img src="${URL.createObjectURL(f)}" alt="Preview">
        <button data-index="${i}">Remove</button>
      </div>
    `).join('');

    preview.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.files.splice(e.target.dataset.index, 1);
        this.renderPreview();
      });
    });

    document.getElementById('uploadBtn').disabled = this.files.length === 0;
  }

  async uploadFiles() {
    if (this.uploadInProgress) return;
    this.uploadInProgress = true;

    const progressDiv = document.getElementById('uploadProgress');
    let completed = 0;

    for (const file of this.files) {
      try {
        const path = `${this.unitId}/${Date.now()}_${file.name}`;
        
        const { data, error } = await this.supabase.storage
          .from('photos')
          .upload(path, file);

        if (error) throw error;

        await this.optimizeImage(path);
        
        completed++;
        progressDiv.innerText = `${completed}/${this.files.length} uploaded`;
      } catch (error) {
        console.error('Upload failed:', error);
        progressDiv.innerText = `Error: ${error.message}`;
      }
    }

    this.files = [];
    this.renderPreview();
    this.uploadInProgress = false;
  }

  async optimizeImage(storagePath) {
    // Call Netlify Function to optimize
    const response = await fetch('/.netlify/functions/optimize-image', {
      method: 'POST',
      body: JSON.stringify({ storagePath })
    });

    if (!response.ok) throw new Error('Optimization failed');
    return response.json();
  }
}
```

**Testing:**
- [ ] Upload single photo
- [ ] Upload multiple photos
- [ ] Drag and drop
- [ ] Cancel upload
- [ ] Invalid file type rejection
- [ ] File too large rejection
- [ ] Progress tracking
- [ ] Error handling

**Acceptance Criteria:**
- ✅ Photos upload successfully
- ✅ Progress visible to user
- ✅ Error messages clear
- ✅ No duplicates

---

#### 2.3 Image Optimization Pipeline
**Task:** Build serverless function to optimize images

**File to Create:** `/netlify/functions/optimize-image.js`

```javascript
const { supabase } = require('../utils/supabase');
const sharp = require('sharp');  // Add to package.json

exports.handler = async (event) => {
  try {
    const { storagePath } = JSON.parse(event.body);

    // Download from storage
    const { data, error } = await supabase.storage
      .from('photos')
      .download(storagePath);

    if (error) throw error;

    const imageBuffer = await data.arrayBuffer();

    // Optimize: Resize, compress, convert to WebP
    const optimized = await sharp(Buffer.from(imageBuffer))
      .resize(1920, 1440, { max: true, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    // Generate thumbnail
    const thumbnail = await sharp(Buffer.from(imageBuffer))
      .resize(300, 225, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    // Upload optimized versions
    const ext = '.webp';
    const optimizedPath = storagePath.replace(/\.\w+$/, `_opt${ext}`);
    const thumbnailPath = storagePath.replace(/\.\w+$/, `_thumb${ext}`);

    await Promise.all([
      supabase.storage.from('photos').upload(optimizedPath, optimized, {
        cacheControl: '31536000', // 1 year
        upsert: true
      }),
      supabase.storage.from('photos').upload(thumbnailPath, thumbnail, {
        cacheControl: '31536000',
        upsert: true
      })
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify({
        original: storagePath,
        optimized: optimizedPath,
        thumbnail: thumbnailPath
      })
    };
  } catch (error) {
    console.error('Optimization error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

**Testing:**
- [ ] Optimize JPEG (should convert to WebP)
- [ ] Optimize PNG (should convert to WebP)
- [ ] Optimize WebP (should recompress)
- [ ] Large image (>5MB) optimization
- [ ] Verify file sizes reduced
- [ ] Verify quality acceptable
- [ ] Thumbnail dimensions correct

**Acceptance Criteria:**
- ✅ File size reduced 25-35%
- ✅ Image quality acceptable
- ✅ WebP format generated
- ✅ Thumbnails generated
- ✅ Fast (<5 seconds)

---

#### 2.4 Cloudflare CDN Setup
**Task:** Configure CDN for photo delivery

**Steps:**
1. Create Cloudflare account (if not exists)
2. Add zone for ottawarentalplug.com
3. Configure cache rules
4. Enable image optimization
5. Test delivery

**Cloudflare Configuration:**
- [ ] Zone added to Cloudflare
- [ ] Nameservers updated (if using Cloudflare DNS)
- [ ] Cache Level: Cache Everything
- [ ] Cache TTL: 31,536,000 (1 year for optimized)
- [ ] Browser Cache TTL: 30 days
- [ ] Minimum TLS: 1.2
- [ ] HTTP/2 enabled
- [ ] Brotli compression enabled

**Configuration Code:**
```javascript
// /js/utils/cdn.js
export const CDN = {
  baseUrl: 'https://cdn.ottawarentalplug.com',
  
  photo: (storagePath) => {
    // Convert storage path to CDN URL
    return `${CDN.baseUrl}/photos/${storagePath}_opt.webp`;
  },
  
  thumbnail: (storagePath) => {
    return `${CDN.baseUrl}/photos/${storagePath}_thumb.webp`;
  },
  
  // Cache headers
  cacheHeaders: {
    photo: 'max-age=31536000, immutable',
    thumbnail: 'max-age=31536000, immutable',
    listing: 'max-age=3600, public'
  }
};
```

**Testing:**
- [ ] Photo served via CDN
- [ ] Load time <3 seconds
- [ ] Caching works (second load faster)
- [ ] Global CDN edge activated
- [ ] Image formats optimized

**Acceptance Criteria:**
- ✅ CDN serving photos
- ✅ Cache headers set
- ✅ Load time <3 seconds
- ✅ Global availability

---

#### 2.5 Landlord Dashboard Photo UI
**Task:** Integrate photo uploader into landlord dashboard

**File to Update:** `/landlord.html`

**Components:**
1. Photo management panel in unit detail
2. Upload area (drag & drop)
3. Photo gallery (reorderable)
4. Delete button
5. Primary photo selector

**HTML to Add:**
```html
<div id="unit-photos-section">
  <h3>Property Photos</h3>
  
  <!-- Upload Area -->
  <div id="photoUploader"></div>
  
  <!-- Photo Gallery -->
  <div id="photoGallery">
    <div class="photo-grid">
      <!-- Photos render here -->
    </div>
  </div>
  
  <!-- Upload Status -->
  <div id="uploadStatus"></div>
</div>
```

**JavaScript:**
```javascript
// Initialize photo uploader
const uploader = new PhotoUploader('photoUploader', supabaseClient);
uploader.unitId = currentUnitId;
uploader.init();

// Listen for uploads
uploader.on('success', (photo) => {
  refreshPhotoGallery(currentUnitId);
});
```

**Testing:**
- [ ] Upload photos to existing unit
- [ ] Photos display in gallery
- [ ] Photos appear in listings
- [ ] Reorder photos
- [ ] Delete photo
- [ ] Set primary photo
- [ ] Multiple units have separate photo sets

**Acceptance Criteria:**
- ✅ Photos upload and display
- ✅ Photos appear on public listings
- ✅ Can manage photos
- ✅ No data loss

---

### MILESTONE 3: Syndication API (Weeks 4-5)
**Objective:** Build API endpoints for syndicating listings  
**Deliverables:** Syndication service, API endpoints  
**Testing:** API integration tests

#### 3.1 Syndication Service Class
**Task:** Build core syndication logic

**File to Create:** `/netlify/functions/services/SyndicationService.js`

```javascript
const { supabase } = require('../utils/supabase');

class SyndicationService {
  constructor() {
    this.platforms = {
      realtor_ca: new RealtorCaIntegration(),
      kijiji: new KijijiIntegration(),
      // airbnb: new AirbnbIntegration()
    };
  }

  async syncListing(unitId, platforms = ['realtor_ca', 'kijiji']) {
    try {
      // Get unit data with photos
      const unit = await this.getUnitWithPhotos(unitId);
      
      if (!unit) throw new Error('Unit not found');
      if (!unit.photos || unit.photos.length === 0) {
        throw new Error('No photos - cannot syndicate');
      }

      // Check syndication config
      const config = await this.getSyndicationConfig(unitId);
      if (!config.enabled) throw new Error('Syndication disabled');

      // Sync to each platform
      const results = {};
      for (const platform of platforms) {
        try {
          results[platform] = await this.syncToPlatform(
            unit, 
            platform
          );
        } catch (err) {
          results[platform] = { error: err.message };
        }
      }

      return results;
    } catch (error) {
      console.error('Syndication error:', error);
      throw error;
    }
  }

  async syncToPlatform(unit, platform) {
    const integration = this.platforms[platform];
    if (!integration) throw new Error(`Unknown platform: ${platform}`);

    // Check if already synced
    const existing = await this.getPlatformRecord(unit.id, platform);

    const payload = this.formatListing(unit, platform);

    if (existing && existing.external_id) {
      // Update existing
      return integration.update(existing.external_id, payload);
    } else {
      // Create new
      return integration.create(payload);
    }
  }

  async getUnitWithPhotos(unitId) {
    const { data, error } = await supabase
      .from('units')
      .select(`
        *,
        photos:photos(*)
      `)
      .eq('id', unitId)
      .single();

    if (error) throw error;
    return data;
  }

  async getSyndicationConfig(unitId) {
    const { data, error } = await supabase
      .from('syndication_configs')
      .select('*')
      .eq('unit_id', unitId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    // Create default config if missing
    if (!data) {
      const { data: created } = await supabase
        .from('syndication_configs')
        .insert([{ unit_id: unitId, enabled: true }])
        .select()
        .single();
      return created;
    }

    return data;
  }

  async getPlatformRecord(unitId, platform) {
    const { data } = await supabase
      .from('syndication_platforms')
      .select('*')
      .eq('unit_id', unitId)
      .eq('platform', platform)
      .single();

    return data;
  }

  formatListing(unit, platform) {
    const base = {
      title: `${unit.beds}bed, ${unit.baths}bath apartment`,
      description: unit.description,
      beds: unit.beds,
      baths: unit.baths,
      price: unit.price,
      address: unit.address,
      photos: unit.photos.map(p => ({
        url: `https://cdn.ottawarentalplug.com/${p.storage_path}`,
        alt: p.alt_text
      }))
    };

    // Platform-specific formatting
    if (platform === 'realtor_ca') {
      return {
        ...base,
        type: this.mapPropertyType(unit.type),
        mls_source: 'ORP'
      };
    }

    if (platform === 'kijiji') {
      return {
        ...base,
        category: 'rental-apartments',
        location: unit.neighbourhood
      };
    }

    return base;
  }

  mapPropertyType(orpType) {
    const mapping = {
      'apartment': 'Apartment',
      'townhouse': 'Townhouse',
      'house': 'Single Family',
      'condo': 'Condo'
    };
    return mapping[orpType] || 'Apartment';
  }

  async recordSyncHistory(unitId, platform, action, details) {
    await supabase
      .from('syndication_history')
      .insert([{
        unit_id: unitId,
        platform,
        action,
        details
      }]);
  }
}

module.exports = SyndicationService;
```

**Testing:**
- [ ] getUnitWithPhotos returns unit with photos
- [ ] formatListing generates correct payload
- [ ] mapPropertyType works for all types
- [ ] getSyndicationConfig creates default if missing
- [ ] Error handling for missing unit
- [ ] Error handling for disabled syndication

**Acceptance Criteria:**
- ✅ Service initializes correctly
- ✅ All methods work
- ✅ Error handling works
- ✅ Data formatted correctly

---

#### 3.2 Platform Integrations
**Task:** Build Realtor.ca and Kijiji integrations

**File to Create:** `/netlify/functions/integrations/RealtorCaIntegration.js`

```javascript
class RealtorCaIntegration {
  constructor(apiKey = process.env.REALTOR_CA_API_KEY) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.realtor.ca/v1';
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async create(listing) {
    const response = await fetch(`${this.baseUrl}/listings`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(listing)
    });

    if (!response.ok) {
      throw new Error(`Realtor.ca error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      platform: 'realtor_ca',
      external_id: data.id,
      external_url: data.listing_url,
      status: 'synced'
    };
  }

  async update(externalId, listing) {
    const response = await fetch(
      `${this.baseUrl}/listings/${externalId}`,
      {
        method: 'PUT',
        headers: this.headers,
        body: JSON.stringify(listing)
      }
    );

    if (!response.ok) {
      throw new Error(`Realtor.ca error: ${response.statusText}`);
    }

    return {
      platform: 'realtor_ca',
      external_id: externalId,
      status: 'synced'
    };
  }

  async delete(externalId) {
    const response = await fetch(
      `${this.baseUrl}/listings/${externalId}`,
      {
        method: 'DELETE',
        headers: this.headers
      }
    );

    if (!response.ok) {
      throw new Error(`Realtor.ca error: ${response.statusText}`);
    }

    return { platform: 'realtor_ca', status: 'deleted' };
  }

  async getStatus(externalId) {
    const response = await fetch(
      `${this.baseUrl}/listings/${externalId}`,
      { headers: this.headers }
    );

    if (!response.ok) {
      throw new Error(`Realtor.ca error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      external_id: externalId,
      status: data.status,
      views: data.view_count,
      last_updated: data.updated_at
    };
  }
}

module.exports = RealtorCaIntegration;
```

**Similar File:** `/netlify/functions/integrations/KijijiIntegration.js` (same pattern)

**Testing:**
- [ ] Create listing on Realtor.ca (use sandbox API)
- [ ] Update listing
- [ ] Delete listing
- [ ] Get listing status
- [ ] Error handling for invalid credentials
- [ ] Error handling for API rate limits
- [ ] Error handling for network issues

**Acceptance Criteria:**
- ✅ Can create/update/delete on platforms
- ✅ Error messages clear
- ✅ Retries on failure
- ✅ Rate limits respected

---

#### 3.3 Syndication API Endpoints
**Task:** Build REST endpoints for syndication

**File to Create:** `/netlify/functions/syndicate.js`

```javascript
const SyndicationService = require('./services/SyndicationService');
const { verifyAuth } = require('./utils/supabase');

const syndication = new SyndicationService();

exports.handler = async (event) => {
  try {
    const user = await verifyAuth(event);
    if (!user) return { statusCode: 401 };

    const { httpMethod, path, body } = event;
    const pathParts = path.split('/');

    // POST /syndicate (Sync a listing)
    if (httpMethod === 'POST' && pathParts[2] === 'syndicate') {
      return handleSync(user, JSON.parse(body), event);
    }

    // GET /syndicate/:unitId/status (Get sync status)
    if (httpMethod === 'GET' && pathParts.length > 3) {
      return handleStatus(user, pathParts[3]);
    }

    return { statusCode: 404 };
  } catch (error) {
    console.error('Syndication error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function handleSync(user, data, event) {
  const { unitId, platforms = ['realtor_ca', 'kijiji'] } = data;

  // Verify user owns unit
  const unit = await verifyUnitOwnership(user, unitId);
  if (!unit) return { statusCode: 403 };

  // Sync to platforms
  const results = await syndication.syncListing(unitId, platforms);

  // Record history
  for (const [platform, result] of Object.entries(results)) {
    await syndication.recordSyncHistory(
      unitId,
      platform,
      result.error ? 'error' : 'created',
      result
    );
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      unitId,
      results,
      timestamp: new Date().toISOString()
    })
  };
}

async function handleStatus(user, unitId) {
  const statuses = await getSyndicationStatuses(unitId);
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      unitId,
      platforms: statuses
    })
  };
}

async function verifyUnitOwnership(user, unitId) {
  const landlord = await getLandlordByAuthUser(user.id);
  if (!landlord) return null;

  const { data } = await supabase
    .from('units')
    .select('*')
    .eq('id', unitId)
    .eq('landlord_id', landlord.id)
    .single();

  return data;
}

async function getSyndicationStatuses(unitId) {
  const { data } = await supabase
    .from('syndication_platforms')
    .select('platform, status, external_id, last_sync_at')
    .eq('unit_id', unitId);

  return data || [];
}

async function getLandlordByAuthUser(userId) {
  const { data } = await supabase
    .from('landlords')
    .select('*')
    .eq('auth_user_id', userId)
    .single();

  return data;
}
```

**Testing:**
- [ ] POST /syndicate creates listings on platforms
- [ ] GET /syndicate/:unitId/status returns correct status
- [ ] Authorization verified
- [ ] Unit ownership verified
- [ ] Error handling for missing unit
- [ ] Error handling for platform errors
- [ ] Concurrent syncs handled

**Acceptance Criteria:**
- ✅ API endpoints work
- ✅ Authorization enforced
- ✅ Listings synced correctly
- ✅ Errors handled gracefully

---

### MILESTONE 4: Realtor.ca Integration (Week 6)
**Objective:** Syndicate listings to Canada's largest real estate platform  
**Deliverables:** Full Realtor.ca integration, automated sync  
**Testing:** End-to-end Realtor.ca sync

#### 4.1 Realtor.ca API Connection
**Task:** Connect to Realtor.ca production API

**Steps:**
1. Register ORP as application developer with Realtor.ca
2. Get API credentials
3. Set environment variables
4. Test API connection
5. Verify sandbox environment works

**Documentation Reference:**
- Realtor.ca API Docs: https://developer.realtor.ca/
- Required fields for listings (address, price, beds, baths, photos)
- Photo upload process
- Rate limiting (requests/minute)

**Testing Checklist:**
- [ ] API credentials working
- [ ] Can authenticate
- [ ] Can create test listing
- [ ] Photos upload correctly
- [ ] Can update listing
- [ ] Can delete listing

**Acceptance Criteria:**
- ✅ Connected to Realtor.ca
- ✅ Can CRUD listings
- ✅ Photos included
- ✅ Fields mapped correctly

---

#### 4.2 Webhook Handler for Realtor.ca
**Task:** Receive webhook updates from Realtor.ca

**File to Create:** `/netlify/functions/realtor-ca-webhook.js`

```javascript
const crypto = require('crypto');

exports.handler = async (event) => {
  try {
    // Verify webhook signature
    if (!verifyRealtorWebhookSignature(event)) {
      return { statusCode: 403, body: 'Invalid signature' };
    }

    const data = JSON.parse(event.body);
    const { listing_id, action, updated_fields } = data;

    console.log(`Realtor.ca webhook: ${action} on listing ${listing_id}`);

    // Handle different actions
    if (action === 'listing_viewed') {
      await recordListing View(listing_id, data.view_count);
    }

    if (action === 'listing_contacted') {
      await recordLead(listing_id, data.inquirer);
    }

    if (action === 'listing_removed') {
      await archiveListing(listing_id);
    }

    return { statusCode: 200, body: 'Webhook processed' };
  } catch (error) {
    console.error('Webhook error:', error);
    return { statusCode: 500, body: error.message };
  }
};

function verifyRealtorWebhookSignature(event) {
  const signature = event.headers['x-realtor-signature'];
  const timestamp = event.headers['x-realtor-timestamp'];
  const secret = process.env.REALTOR_CA_WEBHOOK_SECRET;

  const message = `${timestamp}${event.body}`;
  const hash = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  return crypto.timingSafeEqual(hash, signature);
}
```

**Testing:**
- [ ] Webhook signature verification works
- [ ] Webhook processing works
- [ ] View counts tracked
- [ ] Leads recorded

**Acceptance Criteria:**
- ✅ Webhooks received and processed
- ✅ Leads tracked
- ✅ Signature verified

---

#### 4.3 Dashboard Display of Syndication Status
**Task:** Show syndication status in landlord dashboard

**UI Updates to:** `/landlord.html`

```html
<!-- Syndication Status Card -->
<div id="syndication-status" class="card">
  <h3>Listing Syndication</h3>
  
  <div class="syndication-platforms">
    <!-- Realtor.ca -->
    <div class="platform-item" id="platform-realtor_ca">
      <span class="platform-name">Realtor.ca</span>
      <span class="platform-status"></span>
      <span class="platform-url" style="display:none;"></span>
      <button class="sync-btn" data-platform="realtor_ca">Sync Now</button>
    </div>
    
    <!-- Kijiji -->
    <div class="platform-item" id="platform-kijiji">
      <span class="platform-name">Kijiji</span>
      <span class="platform-status"></span>
      <span class="platform-url" style="display:none;"></span>
      <button class="sync-btn" data-platform="kijiji">Sync Now</button>
    </div>
  </div>
  
  <div id="sync-history"></div>
</div>
```

**JavaScript:**
```javascript
async function loadSyndicationStatus(unitId) {
  const response = await fetch(
    `/.netlify/functions/syndicate/${unitId}/status`
  );

  if (!response.ok) return;

  const { platforms } = await response.json();

  for (const platform of platforms) {
    updatePlatformStatus(platform);
  }
}

function updatePlatformStatus(platform) {
  const item = document.getElementById(`platform-${platform.platform}`);
  const statusSpan = item.querySelector('.platform-status');
  const urlSpan = item.querySelector('.platform-url');

  if (platform.status === 'synced') {
    statusSpan.className = 'status-badge status-success';
    statusSpan.textContent = 'Synced';
    if (platform.external_url) {
      urlSpan.style.display = 'inline';
      urlSpan.href = platform.external_url;
      urlSpan.textContent = 'View listing';
    }
  } else if (platform.status === 'pending') {
    statusSpan.className = 'status-badge status-pending';
    statusSpan.textContent = 'Pending';
  } else if (platform.status === 'failed') {
    statusSpan.className = 'status-badge status-error';
    statusSpan.textContent = 'Failed';
  }
}

// Sync button handlers
document.querySelectorAll('.sync-btn').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    const platform = e.target.dataset.platform;
    e.target.disabled = true;
    e.target.textContent = 'Syncing...';

    try {
      const response = await fetch('/.netlify/functions/syndicate', {
        method: 'POST',
        body: JSON.stringify({
          unitId: currentUnitId,
          platforms: [platform]
        })
      });

      const { results } = await response.json();
      loadSyndicationStatus(currentUnitId);
    } catch (error) {
      alert(`Sync failed: ${error.message}`);
    } finally {
      e.target.disabled = false;
      e.target.textContent = 'Sync Now';
    }
  });
});
```

**Testing:**
- [ ] Status loads correctly
- [ ] Sync button works
- [ ] Status updates after sync
- [ ] External URLs work
- [ ] Error states display

**Acceptance Criteria:**
- ✅ Status displayed
- ✅ Sync button functional
- ✅ Links to external listings work

---

### MILESTONE 5: Kijiji Integration (Week 7)
**Objective:** Syndicate to Canada's largest classified platform  
**Deliverables:** Kijiji integration, automated sync  
**Testing:** End-to-end Kijiji sync

#### 5.1-5.2 Kijiji API Connection & Dashboard
**Task:** Similar to Realtor.ca (see Milestone 4 for pattern)

**Key Differences:**
- Different API endpoints
- Different required fields
- Different photo format
- Different webhook structure

**Testing:**
- [ ] Can create listing on Kijiji
- [ ] Photos upload correctly
- [ ] Can update/delete
- [ ] Webhooks work

**Acceptance Criteria:**
- ✅ Kijiji integration working
- ✅ Listings syndicated
- ✅ Status displayed

---

### MILESTONE 6: Testing & Monitoring (Week 8)
**Objective:** Ensure syndication system is robust  
**Deliverables:** Tests, monitoring, documentation  
**Testing:** Full integration and stress testing

#### 6.1 Integration Tests
**File to Create:** `/tests/syndication.test.js`

```javascript
describe('Syndication Service', () => {
  let syndication;

  beforeEach(() => {
    syndication = new SyndicationService();
  });

  test('should sync listing to Realtor.ca', async () => {
    const result = await syndication.syncToPlatform(mockUnit, 'realtor_ca');
    expect(result.external_id).toBeTruthy();
    expect(result.status).toBe('synced');
  });

  test('should sync listing to Kijiji', async () => {
    const result = await syndication.syncToPlatform(mockUnit, 'kijiji');
    expect(result.external_id).toBeTruthy();
  });

  test('should update existing listing', async () => {
    const result = await syndication.syncToPlatform(mockUnit, 'realtor_ca');
    const updated = await syndication.syncToPlatform(
      { ...mockUnit, price: 2000 },
      'realtor_ca'
    );
    expect(updated.external_id).toBe(result.external_id);
  });

  test('should fail without photos', async () => {
    const noPhotos = { ...mockUnit, photos: [] };
    await expect(
      syndication.syncToPlatform(noPhotos, 'realtor_ca')
    ).rejects.toThrow('No photos');
  });

  test('should handle API errors gracefully', async () => {
    // Mock API failure
    const result = await syndication.syncToPlatform(mockUnit, 'realtor_ca');
    expect(result.error).toBeTruthy();
  });
});
```

**Testing Checklist:**
- [ ] All unit tests pass
- [ ] API integration tests pass
- [ ] Error scenarios handled
- [ ] Concurrent syncs tested
- [ ] Rate limiting tested

**Acceptance Criteria:**
- ✅ 100% test coverage for critical paths
- ✅ All tests pass
- ✅ Error handling verified

---

#### 6.2 Monitoring & Alerting
**Task:** Set up production monitoring

**File to Create:** `/netlify/functions/services/MonitoringService.js`

```javascript
class MonitoringService {
  async recordSyncMetric(unitId, platform, success, duration) {
    // Log to monitoring service
    console.log({
      timestamp: new Date().toISOString(),
      event: 'syndication_sync',
      unitId,
      platform,
      success,
      duration
    });

    // If failed, alert
    if (!success) {
      await this.sendAlert({
        severity: 'high',
        message: `Syndication failed: ${platform} for unit ${unitId}`,
        unitId,
        platform
      });
    }
  }

  async sendAlert(alert) {
    // Send to Slack, email, or monitoring service
    if (process.env.SLACK_WEBHOOK) {
      await fetch(process.env.SLACK_WEBHOOK, {
        method: 'POST',
        body: JSON.stringify({
          text: `🚨 ${alert.message}`
        })
      });
    }
  }

  async getMetrics(timeRange = '24h') {
    // Query metrics
    return {
      total_syncs: 42,
      successful: 40,
      failed: 2,
      average_duration: 1240,
      platforms: {
        realtor_ca: { syncs: 21, success: 20, failed: 1 },
        kijiji: { syncs: 21, success: 20, failed: 1 }
      }
    };
  }
}
```

**Monitoring Dashboard:** Create admin view showing:
- [ ] Syncs per hour/day
- [ ] Success rate
- [ ] Average sync time
- [ ] Errors & failures
- [ ] Platform health

**Acceptance Criteria:**
- ✅ Metrics tracked
- ✅ Alerts working
- ✅ Dashboard functional

---

#### 6.3 Documentation
**File to Create:** `/docs/SYNDICATION_SETUP.md`

**Contents:**
1. Platform API credentials setup
2. Webhook configuration
3. Testing procedures
4. Monitoring setup
5. Troubleshooting guide

**Acceptance Criteria:**
- ✅ Complete setup guide
- ✅ Troubleshooting guide
- ✅ Admin runbook

---

## DEPLOYMENT STRATEGY

### Phase 1: Staging (Week 8.5)
- Deploy to Netlify staging environment
- Test with real API keys (sandbox)
- Load testing
- Security audit

### Phase 2: Pilot Launch (Week 9)
- Enable for 10-20 listings only
- Monitor closely
- Gather feedback
- Fix issues

### Phase 3: Full Rollout (Week 10)
- Enable for all active listings
- Monitor production
- Respond to issues
- Celebrate! 🎉

---

## SUCCESS METRICS

### Technical Metrics
- ✅ 99.9% syndication success rate
- ✅ <3 second photo load time
- ✅ <2 second API response time
- ✅ Zero data loss

### Business Metrics
- ✅ 50% increase in applicant volume from syndicated sources
- ✅ <1% refund rate from syndicated leads
- ✅ 10+ listings syndicating weekly

### User Metrics
- ✅ Landlords report easy management
- ✅ <5 support tickets/month related to syndication
- ✅ 90%+ of active listings have photos

---

## RISK MITIGATION

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|-----------|
| Photo upload failures | Medium | High | Retry logic, error alerts |
| API rate limits | Low | Medium | Batch API calls, queuing |
| Data sync conflicts | Low | High | Transaction isolation, audit log |
| Compliance violations | Low | High | Legal review of ToS |
| Performance degradation | Medium | High | CDN, caching, monitoring |

---

## ROLLBACK PLAN

If critical issues in production:

1. **Stop new syncs:** Disable syndication endpoint
2. **Pause webhooks:** Disable webhook processing
3. **Revert databases:** Restore from backup
4. **Communicate:** Notify users of outage
5. **Investigate:** Root cause analysis
6. **Redeploy:** After fixes verified

**Estimated rollback time:** <15 minutes

---

## NEXT STEPS

### Immediate (This Week)
- [ ] Review roadmap
- [ ] Approve architecture
- [ ] Order platform API credentials

### Week 1
- [ ] Create database migrations
- [ ] Set up Supabase Storage
- [ ] Begin photo component development

### Weeks 2-3
- [ ] Complete photo system
- [ ] CDN setup
- [ ] Integration testing

### Weeks 4-6
- [ ] Realtor.ca integration
- [ ] Kijiji integration
- [ ] Dashboard UI

### Weeks 7-8
- [ ] Testing & monitoring
- [ ] Documentation
- [ ] Staging deployment

### Week 9+
- [ ] Pilot launch
- [ ] Production rollout
- [ ] Ongoing monitoring

---

## OWNER APPROVAL REQUIRED

This roadmap is ready for your review. Please approve:

- [ ] Overall approach acceptable
- [ ] Timeline realistic
- [ ] Resource allocation approved
- [ ] Ready to proceed with Milestone 1

**Next milestone:** Foundation Setup (Weeks 1 = starts ASAP after approval)

---

**Document prepared by:** Senior Architect  
**Status:** READY FOR IMPLEMENTATION  
**Milestone 1 starts:** Upon your approval

