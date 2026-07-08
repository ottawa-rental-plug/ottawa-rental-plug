# Landlord Dashboard - Syndication Integration Guide

## What to Add to `landlord.html`

### 1. Add CSS Link (in `<head>`)
Add after the existing style tags:
```html
<link rel="stylesheet" href="/js/components/photo-uploader.css">
```

### 2. Add Script Links (before closing `</body>`)
Add before the other script tags:
```html
<script src="/js/components/PhotoUploader.js"></script>
<script src="/js/components/SyndicationManager.js"></script>
```

### 3. Add Photo Uploader to Vacancy Drawer

Find the drawer-body section in landlord.html and add this section:

```html
<!-- PHOTO UPLOADER SECTION (Add inside drawer-body after applicant section) -->
<div class="drawer-section">
  <div class="drawer-section-title">Property Photos</div>
  <div id="photoUploaderContainer"></div>
</div>

<!-- SYNDICATION STATUS SECTION (Add inside drawer-body) -->
<div class="drawer-section">
  <div class="drawer-section-title">Listing Syndication</div>
  <div id="syndicationStatusContainer"></div>
</div>
```

---

## JavaScript Integration

### Initialize When Opening Vacancy Detail

In the JavaScript that opens the vacancy drawer, add:

```javascript
async function openVacancyDetail(unitId) {
  // ... existing code to populate vacancy details ...

  // Initialize photo uploader
  const uploader = new PhotoUploader('photoUploaderContainer', sb, unitId);
  await uploader.init();

  // Initialize syndication manager
  const syndication = new SyndicationManager('syndicationStatusContainer', unitId);
  await syndication.init();
}
```

### Supabase Storage Setup

Before photos can be uploaded, create the storage bucket:

```javascript
// Run this once in browser console or backend:
await sb.storage.createBucket('orp-photos', { public: true });
```

Or in Supabase console:
1. Storage → Create new bucket
2. Name: `orp-photos`
3. Public: ✓ Checked
4. File size limit: 10 MB
5. Allowed MIME types: image/*

---

## What Gets Built

### Photo Uploader Component
**Features:**
- ✅ Drag & drop upload
- ✅ Click to browse
- ✅ Multiple file selection
- ✅ Image validation (JPG/PNG/WebP, max 10MB)
- ✅ Progress indicator
- ✅ Photo gallery with reordering
- ✅ Set primary photo
- ✅ Delete photos
- ✅ Stores in Supabase Storage
- ✅ Saves metadata to `photos` table

**Files:**
- `js/components/PhotoUploader.js` - Main component
- `js/components/photo-uploader.css` - Styling

### Syndication Manager Component
**Features:**
- ✅ Show syndication status per platform
- ✅ Platform badges (Realtor.ca, Kijiji, Airbnb)
- ✅ Last sync time
- ✅ External listing URLs (clickable)
- ✅ "Sync Now" button per platform
- ✅ Error messages
- ✅ Sync history viewer
- ✅ Requires photos before syncing

**Files:**
- `js/components/SyndicationManager.js` - Main component
- Styling included in existing CSS

---

## Database Prerequisites

### 1. Photos Table Migration
```sql
-- Must be deployed to Supabase
-- File: db/migrations/001_add_photos_table.sql
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  alt_text TEXT,
  display_order SMALLINT DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

### 2. Syndication Tables Migration
```sql
-- File: db/migrations/002_add_syndication_tables.sql
-- Creates syndication_configs, syndication_platforms, syndication_history
```

### 3. Deploy Migrations
In Supabase console:
1. SQL Editor → New Query
2. Paste migration SQL
3. Run

---

## User Flow

### Landlord Posts Property:

```
1. Go to "Vacancies" panel
2. Click "Add Vacancy" → Fill form → Save
3. Click vacancy card to open detail drawer
4. Upload property photos (drag-drop)
   - Select primary photo
   - Reorder if needed
5. Click "Sync Now" under each platform
   - Realtor.ca: Posted (if broker access)
   - Kijiji: Posted via Apify
   - Airbnb: Posted (if partnership approved)
6. See "Synced ✓" status with external links
7. Webhooks notify when renters view/inquire
```

---

## Component APIs

### PhotoUploader Class
```javascript
const uploader = new PhotoUploader(containerId, supabaseClient, unitId);

// Methods
await uploader.init();                  // Initialize component
await uploader.loadPhotos();            // Load existing photos
await uploader.uploadFiles();           // Upload selected files
await uploader.deletePhoto(photoId);    // Delete a photo
```

### SyndicationManager Class
```javascript
const syndication = new SyndicationManager(containerId, unitId);

// Methods
await syndication.init();               // Initialize component
await syndication.loadStatus();         // Fetch sync status
await syndication.syncPlatform(platform); // Sync to one platform
await syndication.loadHistory();        // Fetch sync history
```

---

## Styling Notes

All components use CSS custom properties for theming:
- `--brand: #06b6d4` (Teal)
- `--brand-dark: #0d9488` (Teal dark)
- `--success: #10b981` (Green)
- `--error: #ef4444` (Red)
- `--text-primary: #0f172a` (Dark)
- `--border: #e2e8f0` (Light gray)

Dark mode automatically supported via `prefers-color-scheme`.

---

## Testing Checklist

- [ ] Supabase Storage bucket `orp-photos` created
- [ ] Photos table migrated to Supabase
- [ ] Syndication tables migrated
- [ ] Photo uploader appears in vacancy drawer
- [ ] Can upload photos (drag-drop works)
- [ ] Photos display in gallery
- [ ] Can reorder photos
- [ ] Can set primary photo
- [ ] Can delete photos
- [ ] Syndication status shows for each platform
- [ ] "Sync Now" button triggers sync
- [ ] External URLs appear after sync
- [ ] Error messages show if sync fails

---

## Troubleshooting

### Photos not uploading
- Check Supabase Storage bucket exists (`orp-photos`)
- Check bucket is public
- Verify CORS is configured
- Check browser console for errors

### Syndication status not showing
- Verify API endpoint is deployed (/.netlify/functions/syndicate)
- Check user is authenticated
- Verify unit belongs to user
- Check browser console for errors

### Photos not persisting
- Verify `photos` table exists in Supabase
- Check RLS policies allow inserts
- Verify unit_id is being passed correctly

---

## Next Steps

1. ✅ Build photo uploader component
2. ✅ Build syndication manager component  
3. ⏳ **Add to landlord.html** (manual integration)
4. ⏳ Deploy Supabase migrations
5. ⏳ Deploy Netlify functions
6. ⏳ Test end-to-end

---

**Files Ready:**
- ✅ `js/components/PhotoUploader.js`
- ✅ `js/components/photo-uploader.css`
- ⏳ `js/components/SyndicationManager.js` (coming next)
- ✅ `REALTOR_CA_WEBHOOK_SETUP.md` (coming next)
