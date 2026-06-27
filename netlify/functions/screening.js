// ORP portal — initiate a SingleKey tenant screening (Phase 2).
// The dashboard (authenticated agent) calls this for a matched applicant who has
// consented. It sends the applicant to SingleKey's embedded flow (the tenant
// completes + pays), records a `screenings` row, and returns the screening link.
//
// Safe + inert until configured: returns 503 until SINGLEKEY_API_TOKEN is set,
// so deploying this changes nothing about the live site until Phase 2 goes live.
//
// Required Netlify env vars (add when SingleKey grants API access):
//   SINGLEKEY_API_TOKEN   — token from SingleKey (info@singlekey.com)
//   SINGLEKEY_BASE_URL    — https://sandbox.singlekey.com (default) or https://platform.singlekey.com
// Already set: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE publishable key.

const SUPABASE_URL    = process.env.SUPABASE_URL || 'https://lvmsajsvkmwejggecehp.supabase.co';
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_ktgQ1_bHcK4J5rpAEZ-l_w_dqC9N144';
const SK_TOKEN        = process.env.SINGLEKEY_API_TOKEN;
const SK_BASE         = process.env.SINGLEKEY_BASE_URL || 'https://sandbox.singlekey.com';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

async function sb(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json', ...(init.headers || {}),
    },
  });
}

// Verify the caller is the signed-in agent (their Supabase access token).
async function verifyAgent(event) {
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!SK_TOKEN)  return json(503, { error: 'Screening not configured yet (SINGLEKEY_API_TOKEN missing).' });
  if (!SERVICE_KEY) return json(500, { error: 'Server not configured (SUPABASE_SERVICE_ROLE_KEY missing).' });

  if (!(await verifyAgent(event))) return json(401, { error: 'Not authorized' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { error: 'Bad request body' }); }
  const applicantId = body.applicantId;
  if (!applicantId) return json(400, { error: 'applicantId is required' });

  // Load the applicant and require recorded consent before any screening.
  const aRes = await sb(`applicants?id=eq.${applicantId}&select=*`);
  if (!aRes.ok) return json(502, { error: 'Could not load applicant' });
  const [applicant] = await aRes.json();
  if (!applicant) return json(404, { error: 'Applicant not found' });
  if (!applicant.consent_screening_at) {
    return json(409, { error: 'Applicant has not consented to screening.' });
  }

  // Split name into first/last for SingleKey.
  const parts = (applicant.name || '').trim().split(/\s+/);
  const firstName = parts.shift() || '';
  const lastName  = parts.join(' ') || firstName;

  // Initiate SingleKey's embedded flow (tenant completes + pays).
  const skPayload = {
    external_tenant_id: applicant.id,
    ten_first_name: firstName,
    ten_last_name:  lastName,
    ten_email:      applicant.email,
    ten_tel:        applicant.phone || '',
    ten_address:    applicant.neighbourhood && applicant.neighbourhood !== 'Any' ? applicant.neighbourhood : '',
  };
  let skData;
  try {
    const skRes = await fetch(`${SK_BASE}/screen/embedded_flow_request`, {
      method: 'POST',
      headers: { Authorization: `Token ${SK_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(skPayload),
    });
    skData = await skRes.json().catch(() => ({}));
    if (!skRes.ok) return json(502, { error: 'SingleKey request failed', detail: skData });
  } catch (e) {
    return json(502, { error: 'Could not reach SingleKey', detail: String(e) });
  }

  // Persist a screenings row. We store only the request token + link, never PII.
  const requestToken = skData.token || skData.request_token || skData.purchase_token || null;
  const link = skData.link || skData.url || skData.embedded_flow_url || null;
  await sb('screenings', {
    method: 'POST',
    body: JSON.stringify({
      applicant_id: applicant.id,
      provider: 'singlekey',
      provider_request_id: requestToken,
      status: 'requested',
      report_url: link,
      consent_at: applicant.consent_screening_at,
    }),
  });
  // Move the applicant into the screening stage.
  await sb(`applicants?id=eq.${applicant.id}`, { method: 'PATCH', body: JSON.stringify({ stage: 'screening' }) });

  return json(200, { ok: true, link, token: requestToken });
};
