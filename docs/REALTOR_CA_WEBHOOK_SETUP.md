# Realtor.ca DDF® Webhook Registration Guide

## Overview

Realtor.ca webhooks allow real-time notifications when:
- Your listing gets viewed
- A renter inquires about your listing
- A renter saves your listing
- Your listing is removed
- Your listing metadata is updated

---

## Prerequisites

✅ Registered with Realtor.ca DDF® Web API  
✅ Have Client ID and Client Secret  
✅ ORP is deployed to production (Netlify)  
✅ SSL certificate (HTTPS) - required by Realtor.ca  

---

## Webhook URL to Register

Your unique webhook endpoint is:

```
https://ottawarentalplug.com/.netlify/functions/webhooks/realtor-ca-webhook
```

**Note:** Replace `ottawarentalplug.com` with your actual domain if different.

---

## Step-by-Step Registration

### Step 1: Access Realtor.ca Developer Console

1. Go to: https://developer.realtor.ca/
2. Sign in with your account
3. Navigate to: **Applications** → Your Application → **Webhooks**

### Step 2: Add Webhook Endpoint

In the Developer Console Webhooks section:

1. Click **"Add Webhook"** or **"New Webhook"**
2. Enter Webhook URL:
   ```
   https://ottawarentalplug.com/.netlify/functions/webhooks/realtor-ca-webhook
   ```
3. Leave authentication method as default (they'll send signature headers)

### Step 3: Subscribe to Events

Select the following events to monitor:

- [ ] **Listing Viewed** - Track property views
- [ ] **Listing Inquiry** - New inquiry from renter
- [ ] **Listing Saved** - Renter bookmarked your listing  
- [ ] **Listing Removed** - Your listing was delisted
- [ ] **Listing Updated** - Metadata changed

(You can select all or specific events based on your needs)

### Step 4: Get Webhook Secret

After creating the webhook:

1. Realtor.ca will display a **Webhook Secret**
2. Copy this value
3. Add to your `.env.local`:
   ```bash
   REALTOR_CA_WEBHOOK_SECRET=<paste_the_secret_here>
   ```
4. Redeploy to Netlify with updated environment variables

### Step 5: Test Webhook Delivery

In Developer Console:

1. Click your webhook
2. Scroll to **"Test Event"**
3. Select an event type (e.g., "Listing Viewed")
4. Click **"Send Test"**
5. Check Realtor.ca console for delivery status (should show ✓ Success)

---

## Webhook Payload Examples

### Listing Viewed
```json
{
  "event_type": "listing_viewed",
  "listing_id": "12345678",
  "view_count": 5,
  "viewer_ip": "192.168.1.1",
  "viewed_at": "2026-07-08T14:30:00Z"
}
```

### Listing Inquiry
```json
{
  "event_type": "listing_inquiry",
  "listing_id": "12345678",
  "inquirer_name": "Jane Doe",
  "inquirer_email": "jane@example.com",
  "inquirer_phone": "+1-613-555-0123",
  "inquiry_message": "Is this place still available?",
  "inquiry_date": "2026-07-08T14:35:00Z"
}
```

### Listing Saved
```json
{
  "event_type": "listing_saved",
  "listing_id": "12345678",
  "saver_email": "john@example.com",
  "saved_at": "2026-07-08T14:40:00Z"
}
```

### Listing Removed
```json
{
  "event_type": "listing_removed",
  "listing_id": "12345678",
  "reason": "Lease Signed",
  "removed_at": "2026-07-08T15:00:00Z"
}
```

---

## What Happens When Webhook Fires

### Our Processing Flow:

```
1. Realtor.ca sends webhook to our endpoint
   ↓
2. We verify signature (security)
   ↓
3. Route by event type:
   - listing_viewed → Log view count
   - listing_inquiry → Create new applicant
   - listing_saved → Log saved event
   - listing_removed → Mark listing as removed
   ↓
4. Record in syndication_history table
   ↓
5. Send notification to landlord (via ntfy)
   ↓
6. Return 200 OK to Realtor.ca
```

### What Landlord Sees:

1. **Notifications** - Real-time alerts (if ntfy configured)
   - "Your listing was viewed on Realtor.ca"
   - "New inquiry from Jane Doe: jane@example.com"

2. **Dashboard** - Sync history shows all events
   - View count updates
   - New inquiries become applicants

3. **Applicants** - Inquiries auto-create applicant records
   - Can screen & communicate immediately
   - Auto-matched to vacancy requirements

---

## Webhook Signature Verification

Our code automatically verifies webhook authenticity:

```javascript
// In RealtorCaIntegration.js
verifyWebhookSignature(event) {
  const signature = event.headers['x-realtor-signature'];
  const timestamp = event.headers['x-realtor-timestamp'];
  const message = `${timestamp}${event.body}`;
  const hash = crypto
    .createHmac('sha256', this.webhookSecret)
    .update(message)
    .digest('hex');
  return crypto.timingSafeEqual(hash, signature);
}
```

This prevents spoofed webhooks from other sources.

---

## Troubleshooting

### Webhook Not Received

**Check 1: Endpoint is public**
```bash
curl -I https://ottawarentalplug.com/.netlify/functions/webhooks/realtor-ca-webhook
# Should return 200 or 405 (OPTIONS), not 404 or 403
```

**Check 2: HTTPS and SSL valid**
- Realtor.ca requires HTTPS
- Self-signed certificates will be rejected
- Netlify provides free SSL automatically

**Check 3: Webhook URL registered correctly**
- Double-check URL in Realtor.ca console
- No trailing slashes
- Must be exactly: `https://ottawarentalplug.com/.netlify/functions/webhooks/realtor-ca-webhook`

**Check 4: Events selected**
- Verify events are checked in webhook settings
- Some events may have additional requirements

### Webhook Signature Verification Failed

**Cause:** `REALTOR_CA_WEBHOOK_SECRET` not set or incorrect

**Solution:**
1. Get fresh secret from Realtor.ca console
2. Add to `.env.local`:
   ```bash
   REALTOR_CA_WEBHOOK_SECRET=abc123xyz789
   ```
3. Redeploy to Netlify
4. Test again

### Webhook Delivery Failing (Realtor.ca Dashboard)

Check Netlify Function Logs:
1. Go to Netlify → Site → Functions → realtor-ca-webhook
2. View recent invocations
3. Look for error messages
4. Fix and redeploy

---

## Webhook Delivery Retry Policy

**Realtor.ca automatically retries:**
- Initial attempt + 4 retries
- Exponential backoff
- Stops after 5 total attempts

**Our code:**
- Always returns 200 OK if webhook processed (even if errors)
- Logs all events to database
- Send alerts for errors

**Best Practice:**
- Process webhooks synchronously (we do this)
- Never hang on long operations (we don't)
- Return quickly and process in background if needed

---

## Testing Guide

### Manual Test 1: View Count
1. Create a listing on Realtor.ca
2. View it from different browser/device
3. Check webhook test in developer console
4. Should see "listing_viewed" in sync history

### Manual Test 2: Inquiry
1. Have someone contact your listing on Realtor.ca
2. Or use "Send Test" → "Listing Inquiry" in developer console
3. Should create new applicant in ORP dashboard
4. Should receive notification

### Manual Test 3: Removal
1. Remove listing from Realtor.ca
2. Or use "Send Test" → "Listing Removed"
3. Should mark listing status as "removed" in database

---

## Production Checklist

- [ ] Webhook registered in Realtor.ca developer console
- [ ] Webhook secret added to `.env.local`
- [ ] Webhook secret deployed to Netlify
- [ ] Test webhook delivery shows ✓ Success
- [ ] Ntfy notifications configured (optional but recommended)
- [ ] Reviewed webhook payload examples above
- [ ] Tested each event type at least once
- [ ] Verified applicants created from inquiries
- [ ] Verified notifications received

---

## Monitor Webhook Health

### Check Delivery Status
- Realtor.ca Developer Console → Webhooks → Your webhook
- "Recent Deliveries" tab shows last 100 events
- Green ✓ = successful
- Red ✗ = failed

### Check Application Logs
```bash
# Netlify CLI
netlify functions:logs

# Or via Netlify dashboard:
# Site → Functions → realtor-ca-webhook
```

### Monitor Alerts
If ntfy configured, check:
- Topic: `orp-alerts`
- Tags: `realtor-*`

---

## Support & Resources

**Realtor.ca Support:**
- Email: support@realtor.ca
- Developer Docs: https://developer.realtor.ca/

**ORP Support:**
- Check function logs in Netlify
- Review webhook payload format
- Verify environment variables deployed

---

## Summary

By enabling webhooks:
✅ Real-time view tracking  
✅ Instant inquiry notifications  
✅ Auto-creation of applicant records  
✅ Dashboard sync history  
✅ Landlord alerts  

**Status:** Ready to activate! 🚀

Once registered, webhooks work automatically with zero additional setup.
