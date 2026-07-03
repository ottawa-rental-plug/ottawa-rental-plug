// ORP portal — SingleKey screening result webhook (Phase 2).
//
// SingleKey POSTs here when a screening is completed, failed, or cancelled.
// We verify the HMAC-SHA256 signature, look up the screenings row by the
// provider request token, update the result, and advance the applicant's stage.
//
// Required Netlify env vars:
//   SINGLEKEY_WEBHOOK_SECRET  — signing secret from SingleKey dashboard
//   SUPABASE_URL              — defaults to the known project
//   SUPABASE_SERVICE_ROLE_KEY — service key (server-side only)
//
// Webhook URL to register in SingleKey:
//   https://ottawarentalplug.com/.netlify/functions/screening-webhook
//
// SingleKey sends the signature as: X-SingleKey-Signature: sha256=<hex>
// Payload shape (normalize below for API version differences):
//   { event, token, result, result_summary, report_url, completed_at }

const crypto = require('crypto');

const SUPABASE_URL    = process.env.SUPABASE_URL || 'https://lvmsajsvkmwejggecehp.supabase.co';
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET  = process.env.SINGLEKEY_WEBHOOK_SECRET;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

async function sbFetch(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json', ...(init.headers || {}),
    },
  });
}

// HMAC-SHA256 signature verification (sha256=<hex> format, same as GitHub/Stripe).
function verifySignature(rawBody, signatureHeader) {
  if (!WEBHOOK_SECRET) return true; // skip until secret is configured
  const expected = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader || ''), Buffer.from(expected));
  } catch { return false; }
}

// Normalize SingleKey result strings to a short consistent summary.
function normaliseResult(payload) {
  const raw = (payload.result || payload.result_summary || payload.recommendation || payload.status || '').toLowerCase();
  if (raw.includes('pass'))     return 'Pass';
  if (raw.includes('consider')) return 'Consider';
  if (raw.includes('fail'))     return 'Fail';
  if (raw.includes('cancel'))   return 'Cancelled';
  return (payload.result_summary || payload.result || 'Completed').slice(0, 80);
}

// Derive next applicant stage from screening result.
// Pass → approved; Fail → declined; everything else stays in screening for manual review.
function nextStage(result) {
  if (result === 'Pass') return 'approved';
  if (result === 'Fail') return 'declined';
  return null; // Consider / Cancelled — agent decides
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!SERVICE_KEY) return json(500, { error: 'Server not configured' });

  const rawBody = event.body || '';
  const sig = event.headers['x-singlekey-signature'] || event.headers['x-sk-signature'] || '';
  if (!verifySignature(rawBody, sig)) return json(401, { error: 'Invalid webhook signature' });

  let payload;
  try { payload = JSON.parse(rawBody); }
  catch { return json(400, { error: 'Invalid JSON body' }); }

  const requestToken = payload.token || payload.request_token || payload.purchase_token || null;
  if (!requestToken) return json(400, { error: 'No token in payload — cannot match to a screening' });

  const eventType    = (payload.event || payload.event_type || '').toLowerCase();
  const resultSummary = normaliseResult(payload);
  const reportUrl    = payload.report_url || payload.report_pdf_url || payload.report_link || null;
  const completedAt  = payload.completed_at || new Date().toISOString();
  const status       = eventType.includes('cancel') ? 'cancelled'
                     : eventType.includes('fail')   ? 'failed'
                     : 'completed';

  // Look up the screenings row by the token stored at initiation time.
  const sRes = await sbFetch(`screenings?provider_request_id=eq.${encodeURIComponent(requestToken)}&select=id,applicant_id,status`);
  if (!sRes.ok) return json(502, { error: 'Could not query screenings table' });
  const [screening] = await sRes.json();

  if (!screening) {
    // Unknown token — acknowledge so SingleKey doesn't retry forever.
    console.warn('screening-webhook: unknown token', requestToken);
    return json(200, { ok: true, note: 'Token not recognised — no action taken' });
  }

  // Idempotency: already processed.
  if (screening.status === 'completed' || screening.status === 'cancelled') {
    return json(200, { ok: true, note: 'Already processed' });
  }

  // Update the screenings row.
  const patchRes = await sbFetch(`screenings?id=eq.${screening.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, result_summary: resultSummary, report_url: reportUrl, completed_at: completedAt }),
  });
  if (!patchRes.ok) return json(502, { error: 'Could not update screenings row' });

  // Advance the applicant's stage — only if still in `screening` so we never
  // overwrite a stage the agent has already set manually.
  const aRes = await sbFetch(`applicants?id=eq.${screening.applicant_id}&select=stage`);
  const [applicant] = aRes.ok ? await aRes.json() : [null];
  const stage = nextStage(resultSummary);
  if (applicant && applicant.stage === 'screening' && stage) {
    await sbFetch(`applicants?id=eq.${screening.applicant_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ stage }),
    });
  }

  // Log to the activity timeline so Cyril sees the result without opening SingleKey.
  const stageNote = stage ? ` Stage → ${stage}.` : ' Manual review required.';
  await sbFetch('activities', {
    method: 'POST',
    body: JSON.stringify({
      applicant_id: screening.applicant_id,
      type: 'status_change',
      body: `SingleKey screening ${status}: ${resultSummary}.${stageNote}${reportUrl ? ' Report: ' + reportUrl : ''}`,
    }),
  });

  return json(200, { ok: true, result: resultSummary, status });
};
