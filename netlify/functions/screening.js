// ORP portal — initiate a SingleKey tenant screening (Phase 2).
// The dashboard (authenticated agent) calls this for a matched applicant who has
// consented. It sends the applicant to SingleKey's embedded flow (the tenant
// completes + pays), records a `screenings` row, and returns the screening link.
//
// Two modes:
//   • API mode    — SINGLEKEY_API_TOKEN set: opens SingleKey's embedded flow.
//   • Manual mode — no token yet: records the request so screening is usable
//                   today via your existing SingleKey account. Complete it there,
//                   then post the outcome back with action:'update' ("Mark
//                   result" in the dashboard). Nothing about the live site
//                   changes until an agent explicitly clicks Request Screening.
//
// Required Netlify env vars (add when SingleKey grants API access):
//   SINGLEKEY_API_TOKEN   — token from SingleKey (info@singlekey.com); omit for manual mode
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

const clean = (s, max = 200) => (typeof s === 'string' ? s.trim().slice(0, max) : '');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!SERVICE_KEY) return json(500, { error: 'Server not configured (SUPABASE_SERVICE_ROLE_KEY missing).' });
  if (!(await verifyAgent(event))) return json(401, { error: 'Not authorized' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { error: 'Bad request body' }); }

  // ── Manual result entry (used in manual mode, or to correct a record) ──
  // Stores only a short summary + link — never raw report contents.
  if (body.action === 'update') {
    const screeningId = clean(body.screeningId, 60);
    if (!screeningId) return json(400, { error: 'screeningId is required' });
    const status  = ['completed', 'failed'].includes(body.status) ? body.status : 'completed';
    const patch = {
      status,
      result_summary: clean(body.resultSummary, 200) || null,
      report_url: clean(body.reportUrl, 500) || null,
      completed_at: new Date().toISOString(),
    };
    const res = await sb(`screenings?id=eq.${encodeURIComponent(screeningId)}`, {
      method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch),
    });
    if (!res.ok) return json(502, { error: 'Could not update screening', detail: await res.text() });
    const [row] = await res.json();
    if (!row) return json(404, { error: 'Screening not found' });
    return json(200, { ok: true, screening: row });
  }

  // ── Request a new screening ────────────────────────────────────────────
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

  // Don't double-charge / duplicate: reuse an already in-flight request.
  const openRes = await sb(`screenings?applicant_id=eq.${applicantId}&status=eq.requested&select=id,report_url,requested_at&order=requested_at.desc&limit=1`);
  if (openRes.ok) {
    const [open] = await openRes.json();
    if (open) return json(200, { ok: true, screening: open, link: open.report_url || null, reused: true });
  }

  // Manual mode: record the request so it's trackable, without calling SingleKey.
  if (!SK_TOKEN) {
    const insRes = await sb('screenings', {
      method: 'POST', headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        applicant_id: applicant.id,
        provider: 'singlekey',
        status: 'requested',
        consent_at: applicant.consent_screening_at,
      }),
    });
    if (!insRes.ok) return json(502, { error: 'Could not record screening', detail: await insRes.text() });
    const [saved] = await insRes.json();
    await sb(`applicants?id=eq.${applicant.id}`, { method: 'PATCH', body: JSON.stringify({ stage: 'screening' }) });
    return json(200, { ok: true, mode: 'manual', screening: saved });
  }

  // API mode: split name into first/last for SingleKey.
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

  return json(200, { ok: true, mode: 'api', link, token: requestToken });
};
