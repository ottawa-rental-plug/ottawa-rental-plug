// ORP portal — SingleKey screening completion webhook (Phase 2).
// SingleKey POSTs here when a screening finishes. We match the screenings row by
// the request token and update its status + report link. We store only a result
// summary + link — never the raw credit/background report (that stays at SingleKey).
//
// Configure this URL in SingleKey: https://ottawarentalplug.com/.netlify/functions/screening-webhook
// Optional shared secret: set SINGLEKEY_WEBHOOK_SECRET in Netlify and in SingleKey,
// sent as the `x-singlekey-secret` header; we reject mismatches.
//
// Payload field names are finalized against the SingleKey sandbox once live.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lvmsajsvkmwejggecehp.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = process.env.SINGLEKEY_WEBHOOK_SECRET;

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!SERVICE_KEY) return json(500, { error: 'Server not configured.' });

  if (WEBHOOK_SECRET) {
    const got = event.headers['x-singlekey-secret'] || event.headers['X-Singlekey-Secret'];
    if (got !== WEBHOOK_SECRET) return json(401, { error: 'Bad signature' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { error: 'Bad request body' }); }

  const token = body.token || body.request_token || body.purchase_token;
  if (!token) return json(400, { error: 'Missing screening token' });

  // Map SingleKey's outcome to a short summary; never store the raw report.
  const summary = body.recommendation || body.result || body.status || 'completed';
  const reportLink = body.report_url || body.report_pdf_url || body.link || null;

  const res = await sb(`screenings?provider_request_id=eq.${encodeURIComponent(token)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      status: 'completed',
      result_summary: String(summary).slice(0, 200),
      report_url: reportLink,
      completed_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) return json(502, { error: 'Could not update screening' });

  return json(200, { ok: true });
};
