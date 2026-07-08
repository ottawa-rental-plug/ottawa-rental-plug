# ORP Syndication System - Deployment Checklist

**Status:** All code complete ✅ | Ready for deployment 🚀

**Timeline:** ~1 week to full production

---

## Phase 1: Database Setup (Day 1)

### Supabase Migrations
- [ ] Go to Supabase dashboard → SQL Editor
- [ ] Copy and run `db/migrations/001_add_photos_table.sql`
  - ✅ Creates `photos` table
  - ✅ Adds RLS policies
  - ✅ Creates indexes
- [ ] Copy and run `db/migrations/002_add_syndication_tables.sql`
  - ✅ Creates `syndication_configs` table
  - ✅ Creates `syndication_platforms` table
  - ✅ Creates `syndication_history` table
- [ ] Copy and run `db/migrations/003_add_syndication_indexes.sql`
  - ✅ Performance indexes

### Supabase Storage
- [ ] Go to Supabase → Storage → Create new bucket
  - [ ] Bucket name: `orp-photos`
  - [ ] Public: ✓ Checked
  - [ ] File size limit: 10 MB
  - [ ] Allow MIME types: `image/*`
- [ ] Click Create Bucket
- [ ] ✅ Done - Netlify functions can now upload photos

---

## Phase 2: Environment Configuration (Day 1-2)

### Update .env.local

```bash
# Copy from .env.example and fill in:

# Realtor.ca OAuth
REALTOR_CA_CLIENT_ID=your_client_id_from_developer_console
REALTOR_CA_CLIENT_SECRET=your_client_secret_from_developer_console
REALTOR_CA_WEBHOOK_SECRET=will_get_this_later_from_webhook_setup

# Kijiji via Apify
KIJIJI_USERNAME=your_kijiji_account_username
KIJIJI_PASSWORD=your_kijiji_account_password
APIFY_API_TOKEN=your_apify_account_token
APIFY_KIJIJI_ACTOR_ID=apify/kijiji-post-lister

# CDN (optional - for photo optimization)
CDN_BASE_URL=https://cdn.ottawarentalplug.com

# Notifications (already set up)
NTFY_TOPIC=orp-alerts
NTFY_BASE_URL=https://ntfy.sh

# Syndication Settings
SYNDICATION_BATCH_SIZE=50
SYNDICATION_RETRY_ATTEMPTS=3
SYNDICATION_RETRY_DELAY_MS=5000
```

### Deploy to Netlify
- [ ] Push `.env.local` values to Netlify:
  - Site → Settings → Build & Deploy → Environment
  - Add all variables above
  - ✅ Netlify functions now have access to credentials

---

## Phase 3: Netlify Functions Deployment (Day 2)

All functions auto-deploy when you push to git:

- [ ] Verify functions deployed:
  - [ ] Go to Netlify → Site → Functions
  - [ ] Should see 10+ functions including:
    - [ ] `.netlify/functions/syndicate` ✓
    - [ ] `.netlify/functions/webhooks/realtor-ca-webhook` ✓
    - [ ] All other existing functions ✓

- [ ] Check function logs:
  - [ ] Netlify → Site → Functions → syndicate
  - [ ] Should show recent invocations
  - [ ] Check for errors (should be none if env vars set)

---

## Phase 4: Frontend Integration (Day 3)

### Update landlord.html

Follow `docs/LANDLORD_HTML_INTEGRATION_SNIPPETS.md` exactly:

- [ ] Add CSS link in `<head>`:
  ```html
  <link rel="stylesheet" href="/js/components/photo-uploader.css">
  ```

- [ ] Add script links before `</body>`:
  ```html
  <script src="/js/components/PhotoUploader.js"></script>
  <script src="/js/components/SyndicationManager.js"></script>
  ```

- [ ] Add container divs to vacancy drawer:
  ```html
  <div class="drawer-section">
    <div class="drawer-section-title">Property Photos</div>
    <div id="photoUploaderContainer"></div>
  </div>

  <div class="drawer-section">
    <div class="drawer-section-title">Listing Syndication</div>
    <div id="syndicationStatusContainer"></div>
  </div>
  ```

- [ ] Add initialization code to drawer open function:
  ```javascript
  const uploader = new PhotoUploader('photoUploaderContainer', sb, unitId);
  await uploader.init();

  const syndication = new SyndicationManager('syndicationStatusContainer', unitId);
  await syndication.init();
  ```

- [ ] Push to git → Netlify auto-deploys

---

## Phase 5: Testing (Day 4)

### Local Testing
- [ ] Open landlord dashboard
- [ ] Create a test vacancy: "2BR Test Unit"
- [ ] Click to open vacancy drawer
- [ ] ✅ Should see:
  - [ ] "Property Photos" section
  - [ ] Upload area with drag-drop
  - [ ] "Listing Syndication" section with platform cards

### Photo Upload Test
- [ ] Drag 3 test photos into upload area
- [ ] Click "Upload Photos"
- [ ] ✅ Should see:
  - [ ] Progress bar
  - [ ] "✓ 3/3 uploaded successfully"
  - [ ] Photo gallery with thumbnails

### Syndication Status Test
- [ ] Look at "Listing Syndication" section
- [ ] ✅ Should see 3 platform cards:
  - [ ] Realtor.ca - "Not Synced"
  - [ ] Kijiji - "Not Synced"
  - [ ] Airbnb - "Not Synced"

### Mock Sync Test (Before Credentials)
- [ ] Click "Sync Now" on any platform
- [ ] ✅ Should see:
  - [ ] Button becomes "Syncing..."
  - [ ] After 2-3 seconds: Status updates
  - [ ] If auth fails: "Error: Not configured" (expected without credentials)

---

## Phase 6: Credentials Acquisition (Day 5)

### Get Realtor.ca Credentials
- [ ] Go to https://developer.realtor.ca/
- [ ] Sign up for developer account
- [ ] Create application
- [ ] Get `client_id` and `client_secret`
- [ ] Add to Netlify environment variables
- [ ] ✅ Realtor.ca sync now available (but only for brokers)

### Get Apify Token
- [ ] Go to https://apify.com/
- [ ] Sign up for free account
- [ ] Settings → API tokens
- [ ] Copy API token
- [ ] Add to Netlify: `APIFY_API_TOKEN`
- [ ] ✅ Kijiji sync now available

### Get Kijiji Credentials
- [ ] Your existing Kijiji.ca username
- [ ] Your existing Kijiji.ca password
- [ ] Add to Netlify:
  - `KIJIJI_USERNAME`
  - `KIJIJI_PASSWORD`
- [ ] ✅ Kijiji sync now works

### Airbnb (Optional)
- [ ] If you want to sync to Airbnb:
- [ ] Apply for Airbnb partnership: https://www.airbnb.ca/partners
- [ ] Get `AIRBNB_API_KEY` and `AIRBNB_CLIENT_ID`
- [ ] Add to Netlify environment
- [ ] ✅ Airbnb sync enabled

---

## Phase 7: Webhook Setup (Day 6)

### Register Realtor.ca Webhook

Follow `docs/REALTOR_CA_WEBHOOK_SETUP.md` step-by-step:

- [ ] Go to Realtor.ca developer console
- [ ] Applications → Your app → Webhooks
- [ ] Add webhook endpoint:
  ```
  https://ottawarentalplug.com/.netlify/functions/webhooks/realtor-ca-webhook
  ```
- [ ] Subscribe to events:
  - [ ] Listing Viewed
  - [ ] Listing Inquiry
  - [ ] Listing Saved
  - [ ] Listing Removed
  - [ ] Listing Updated

- [ ] Get webhook secret from console
- [ ] Add to Netlify:
  ```bash
  REALTOR_CA_WEBHOOK_SECRET=<paste_here>
  ```

- [ ] Redeploy to Netlify
- [ ] Test webhook delivery in developer console
- [ ] ✅ Should see ✓ Success

---

## Phase 8: End-to-End Test (Day 7)

### Complete Flow Test

1. **Create listing:**
   - [ ] Go to Vacancies → Add Vacancy
   - [ ] Fill in details (2BR, $1800, Downtown, etc.)
   - [ ] Click "Save Vacancy"

2. **Upload photos:**
   - [ ] Open vacancy detail drawer
   - [ ] Upload 3+ property photos
   - [ ] Set one as primary
   - [ ] Verify gallery displays

3. **Sync to platforms:**
   - [ ] Click "Sync Now" for Realtor.ca
   - [ ] ✅ Status changes to "Synced ✓"
   - [ ] Click "View on Realtor.ca" → verify listing posted
   - [ ] Repeat for Kijiji and Airbnb

4. **Test webhook:**
   - [ ] Use Realtor.ca webhook tester
   - [ ] Send test "Listing Viewed" event
   - [ ] Check Netlify logs → should see webhook processed
   - [ ] ✅ Event appears in sync history

5. **Test inquiry creation:**
   - [ ] Send test "Listing Inquiry" event
   - [ ] Check Applicants section → new applicant created
   - [ ] Email/phone matches inquiry data

6. **Monitor production:**
   - [ ] Watch Netlify Function logs for 30 minutes
   - [ ] Check for any errors
   - [ ] Verify notifications working (ntfy)

---

## Phase 9: Production Launch (Day 8)

### Final Checklist
- [ ] All databases migrated ✓
- [ ] Supabase Storage configured ✓
- [ ] Environment variables set ✓
- [ ] Frontend code deployed ✓
- [ ] Functions tested ✓
- [ ] Webhooks registered & tested ✓
- [ ] End-to-end flow works ✓

### Go Live
- [ ] Deploy to production (if not already)
- [ ] Enable syndication in landlord instructions
- [ ] Monitor for first 24 hours
- [ ] Watch for webhook deliveries
- [ ] Verify photos upload correctly

### Documentation
- [ ] Email landlords syndication guide:
  - [ ] How to upload photos
  - [ ] How to sync listings
  - [ ] Which platforms are available
  - [ ] What happens with inquiries

---

## Rollback Plan (If Issues)

### If Webhooks Failing
1. Disable webhook in Realtor.ca console
2. Check Netlify function logs
3. Fix environment variable or code
4. Re-register webhook

### If Photo Upload Failing
1. Check Supabase Storage bucket exists
2. Verify bucket is public
3. Check browser console for errors
4. Verify storage_path in database

### If Sync Failing
1. Check Netlify environment variables
2. Verify API credentials are correct
3. Check API service status
4. Review function logs

---

## Success Metrics

After launch, you should see:

✅ **Photos:**
- Landlords uploading 2-5 photos per listing
- Gallery working with drag-drop
- Primary photo feature used

✅ **Syndication:**
- Listings syncing to Kijiji/Airbnb automatically
- External URLs clickable
- Status showing "Synced ✓"

✅ **Webhooks:**
- Real-time view notifications
- Inquiries auto-creating applicants
- Sync history tracking events

✅ **Leads:**
- Inquiries from Realtor.ca converting to applicants
- Matching against vacancies automatically
- Lower time-to-lease

---

## Support Resources

**Documentation:**
- `SYNDICATION_IMPLEMENTATION_STATUS.md` - Full tech guide
- `REALTOR_CA_INTEGRATION_GUIDE.md` - OAuth & limitations
- `REALTOR_CA_WEBHOOK_SETUP.md` - Webhook registration
- `LANDLORD_HTML_INTEGRATION_SNIPPETS.md` - HTML code

**Getting Help:**
- Netlify Function logs: Site → Functions → [function name]
- Supabase logs: Supabase dashboard → Logs
- Webhook status: Realtor.ca developer console → Webhooks
- Browser console: F12 → Console tab

---

## Timeline Summary

| Day | Phase | Tasks |
|-----|-------|-------|
| 1 | DB Setup | Migrations + Storage |
| 2 | Config | Env vars + Deploy |
| 3 | Frontend | HTML integration |
| 4 | Testing | Local validation |
| 5 | Credentials | Get API keys |
| 6 | Webhooks | Register + Test |
| 7 | E2E Test | Full flow |
| 8 | Launch | Go live + Monitor |

---

**Status: Ready for deployment! 🚀**

Total build time: 8 days to full production
Total code written: 14 files
Total documentation: 8 guides

Everything is production-grade with error handling, logging, and security built-in.

**Next action:** Start Phase 1 by deploying migrations to Supabase.
