# Realtor.ca DDF® Web API Integration Guide

**Important:** Realtor.ca uses OAuth 2.0 with OData queries, NOT simple REST API endpoints.

---

## Understanding Realtor.ca's API

Realtor.ca's DDF® (Data Distribution Facility) Web API allows authenticated users to:
- **Read** listing data (public listings + your own)
- **Create/Update** listings (if you're a broker or partner)
- **Query** with OData filters and selectors

**Critical Limitation:** Individual landlords (non-brokers) **cannot post listings via API**. Only brokers and authorized partners can publish listings.

---

## Registration & Credentials

### Step 1: Register with Realtor.ca
1. Go to https://developer.realtor.ca/
2. Sign up for developer access
3. Create an application
4. Request DDF® Web API access

### Step 2: Get Your Credentials
After approval, you'll receive:
- **client_id** - Your Destination username
- **client_secret** - Your Destination password
- These are used for OAuth token requests

### Step 3: Set Environment Variables
```bash
REALTOR_CA_CLIENT_ID=your_client_id
REALTOR_CA_CLIENT_SECRET=your_client_secret
REALTOR_CA_WEBHOOK_SECRET=your_webhook_secret
```

---

## OAuth 2.0 Token Flow

Our implementation handles this automatically, but here's what happens:

### Step 1: Get Access Token
```bash
POST https://identity.crea.ca/connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
client_id=YOUR_CLIENT_ID
client_secret=YOUR_CLIENT_SECRET
scope=DDFApi_Read
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

### Step 2: Use Token in API Calls
```bash
GET https://ddfapi.realtor.ca/odata/v1/OpenHouse
Authorization: Bearer {access_token}
```

**Our code handles token caching and automatic refresh.**

---

## API Endpoints (OData)

Realtor.ca API uses OData v1, which allows flexible queries:

### Available Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/odata/v1/Property` | Property listings |
| `/odata/v1/OpenHouse` | Open house events |
| `/odata/v1/Office` | Real estate office info |
| `/odata/v1/Member` | Agent/member info |
| `/odata/v1/Destination` | Your API destination config |

### Example Queries

**Get all properties:**
```bash
GET https://ddfapi.realtor.ca/odata/v1/Property
```

**Get with filters:**
```bash
GET https://ddfapi.realtor.ca/odata/v1/Property?$filter=Address eq '123 Main St'
```

**Get specific fields:**
```bash
GET https://ddfapi.realtor.ca/odata/v1/Property?$select=PropertyKey,Address,Price
```

**Pagination:**
```bash
GET https://ddfapi.realtor.ca/odata/v1/Property?$top=10&$skip=0
```

---

## Current Implementation Status

### ✅ What's Built
- OAuth 2.0 token management (automatic refresh)
- Token caching (60-minute expiry)
- Error handling and retries
- Webhook signature verification

### ⚠️ Limitations for Individual Landlords
- **Cannot POST listings** (broker-only feature)
- **Can only READ** existing listings
- If you need to publish listings, requires broker partnership

### 🔮 What We Can Do Instead
**Option A: Use as Read-Only**
- Query your listings (if posted by broker)
- Track syndicated listing status
- Receive webhook updates

**Option B: Partner as Broker**
- Register as real estate broker
- Get full API write access
- Post/update listings programmatically

**Option C: Manual Realtor.ca Entry**
- Use Realtor.ca web interface to create listing
- Our API tracks it and syndicates to other platforms
- Can update Realtor.ca via web when needed

---

## Webhook Integration

Realtor.ca sends webhooks for:
- Listing viewed
- Listing inquiry received
- Listing saved by user
- Listing removed
- Listing updated

### Register Webhook URL

In Realtor.ca developer console:
```
Webhook URL: https://ottawarentalplug.com/.netlify/functions/webhooks/realtor-ca-webhook
Events: inquiry, view, save, remove, update
```

### Webhook Payload Example

```json
{
  "event_type": "listing_inquiry",
  "listing_id": "12345678",
  "inquirer_name": "John Doe",
  "inquirer_email": "john@example.com",
  "inquirer_phone": "+1-613-555-0123",
  "inquiry_message": "Is this place still available?",
  "inquiry_date": "2026-07-08T14:30:00Z"
}
```

---

## Testing Without Broker Access

### Option 1: Read-Only Testing
```javascript
// This will work for querying listings
const { data } = await realtorCa.getStatus(listingId);
```

### Option 2: Mock Testing
Set `MOCK_MODE = true` in RealtorCaIntegration to test without real API calls.

### Option 3: Sandbox Environment
Realtor.ca may offer sandbox/test environment - confirm with support@realtor.ca

---

## Troubleshooting

### "Not configured" Error
→ Verify `REALTOR_CA_CLIENT_ID` and `REALTOR_CA_CLIENT_SECRET` in `.env.local`

### "Token request failed"
→ Credentials invalid or Destination inactive
→ Check with Realtor.ca support: support@realtor.ca

### "403 Unauthorized" on API calls
→ Your Destination doesn't have access to that endpoint
→ Verify permissions in Realtor.ca developer console

### Webhooks not received
→ Verify webhook URL is publicly accessible (no firewall blocking)
→ Check Realtor.ca webhook logs in developer console
→ Confirm webhook URL registered correctly

---

## Next Steps

### Immediate
1. ✅ Register for DDF® Web API access at https://developer.realtor.ca/
2. ✅ Get client_id and client_secret
3. ✅ Add to `.env.local`
4. ✅ Test token generation (our code logs success)

### If Broker Access Available
1. Test listing creation with mock data
2. Create test listing on Realtor.ca
3. Setup webhook receiver
4. Test webhook delivery

### If Non-Broker (Recommended)
1. Create listing on Realtor.ca web interface
2. Get listing ID
3. Test syndication to other platforms (Kijiji, Airbnb)
4. Monitor for Realtor.ca webhooks

---

## Resources

- **Realtor.ca Developer Portal:** https://developer.realtor.ca/
- **DDF® Web API Docs:** https://developer.realtor.ca/docs/ddf
- **OData Documentation:** https://www.odata.org/
- **Support:** support@realtor.ca

---

## How OUR Integration Works

```
User calls: POST /syndicate with unitId
    ↓
SyndicationService fetches unit + photos
    ↓
RealtorCaIntegration.create(listing)
    ↓
Get OAuth token (cached if fresh)
    ↓
Call RealtorCa API endpoint
    ↓
Handle errors, retry if needed
    ↓
Return external_id + external_url
    ↓
Record in syndication_platforms table
    ↓
Webhook listener receives Realtor.ca events
    ↓
Events logged in syndication_history
```

---

**Status:** Ready for testing once credentials obtained 🚀
