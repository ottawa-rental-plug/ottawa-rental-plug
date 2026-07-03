// ORP portal — public per-unit rental application intake.
// The branded application form (apply.html) posts here for a specific unit
// (?unit=<uuid>). This function inserts the applicant into Supabase and
// writes a single scored `applications` row tied to that unit — it does not
// match against other units; a visitor applies to the exact listing they
// picked on listings.html. Uses the Supabase SERVICE ROLE key server-side,
// so the public `applicants`/`units`/`applications` tables stay fully locked
// behind RLS — the browser never gets write access.
//
// Required Netlify env vars:
//   SUPABASE_URL                — e.g. https://xxxx.supabase.co (falls back to the known project)
//   SUPABASE_SERVICE_ROLE_KEY   — Supabase service_role key (server-side ONLY, never shipped to the browser)

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lvmsajsvkmwejggecehp.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

async function sbFetch(path, init = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const clean   = (s, max = 200) => (typeof s === 'string' ? s.trim().slice(0, max) : '');
const isUuid  = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const EMPLOYMENT_STATUSES = new Set(['full_time','part_time','self_employed','student','retired','unemployed','other']);
const EMPLOYMENT_LENGTHS  = new Set(['<6mo','6-12mo','1-2yr','2yr+']);

// Trim + length-cap every string in a plain object (one level deep). Used
// for the jsonb blobs so nothing oversized or non-string sneaks into storage.
function cleanObj(obj, fields, max = 200) {
  if (!obj || typeof obj !== 'object') return null;
  const out = {};
  for (const f of fields) out[f] = clean(obj[f], max);
  return out;
}

// Best-effort phone alert via ntfy.sh (keyless). Never throws — a failed
// notification must not fail the application submission.
async function notify(applicant, unit) {
  const topic = process.env.NTFY_TOPIC || 'ottawarentalplug';
  try {
    const bedsLabel = unit.beds === 0 ? 'Studio' : (unit.beds != null ? `${unit.beds}BR ` : '');
    const unitLabel = [bedsLabel + (unit.type || ''), unit.neighbourhood].filter(Boolean).join(' · ');
    const priceLabel = unit.price ? ` · $${Math.round(unit.price).toLocaleString()}/mo` : '';
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: { Title: 'New ORP application', Priority: 'high', Tags: 'house' },
      body: `${applicant.name} applied for ${unitLabel || 'a unit'}${priceLabel}. ${applicant.email}`,
    });
  } catch (e) { /* swallow — notification is non-critical */ }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!SERVICE_KEY) return json(500, { error: 'Server not configured (SUPABASE_SERVICE_ROLE_KEY missing).' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { error: 'Bad request body' }); }

  // Honeypot — bots fill hidden fields. Pretend success without writing anything.
  if (clean(body.company)) return json(200, { ok: true });

  if (!isUuid(body.unitId)) return json(400, { error: 'A unitId is required.' });

  const name  = clean(body.name, 120);
  const email = clean(body.email, 160).toLowerCase();
  if (!name)          return json(400, { error: 'Name is required.' });
  if (!isEmail(email)) return json(400, { error: 'A valid email is required.' });

  const moveIn    = /^\d{4}-\d{2}-\d{2}$/.test(body.moveIn || '') ? body.moveIn : null;
  const consented = body.consentScreening === true || body.consentScreening === 'on';
  const ip = (event.headers['x-nf-client-connection-ip']
           || (event.headers['x-forwarded-for'] || '').split(',')[0]
           || '').trim() || null;

  const incomeNum    = parseFloat(String(body.income).replace(/[^\d.]/g, ''));
  const occupantsNum = parseInt(body.occupants, 10);
  const hasPets = body.hasPets === true || body.hasPets === 'on';
  const isSmoker = body.isSmoker === true || body.isSmoker === 'on';

  const additionalIncome = body.additionalIncome && clean(body.additionalIncome.source)
    ? { source: clean(body.additionalIncome.source, 120), amount: clean(body.additionalIncome.amount, 20) }
    : null;

  const ah = body.addressHistory || {};
  const addressHistory = {
    current: cleanObj(ah.current, ['address','city','postal','time_there','monthly_rent','landlord_name','landlord_phone','reason_leaving'], 200),
    previous: ah.previous && clean(ah.previous.address) ? cleanObj(ah.previous, ['address','city','landlord_name','landlord_phone'], 200) : null,
  };

  const emergencyContact = body.emergencyContact && clean(body.emergencyContact.name)
    ? cleanObj(body.emergencyContact, ['name','phone','relationship'], 120)
    : null;

  const personalReferences = Array.isArray(body.personalReferences)
    ? body.personalReferences.filter(r => r && clean(r.name)).slice(0, 2).map(r => cleanObj(r, ['name','phone'], 120))
    : [];

  const vehicle = body.vehicle && (clean(body.vehicle.make_model) || clean(body.vehicle.plate))
    ? cleanObj(body.vehicle, ['make_model','plate'], 80)
    : null;

  const applicant = {
    name, email,
    phone: clean(body.phone, 40),
    move_in: moveIn,
    source: 'apply',
    stage: 'new',
    consent_screening_at: consented ? new Date().toISOString() : null,
    consent_ip: consented ? ip : null,
    // Self-reported affordability screening.
    monthly_income:     Number.isFinite(incomeNum) && incomeNum > 0 ? incomeNum : null,
    employer:            clean(body.employer, 120),
    job_title:           clean(body.jobTitle, 120),
    employment_status:   EMPLOYMENT_STATUSES.has(body.employmentStatus) ? body.employmentStatus : null,
    employment_length:   EMPLOYMENT_LENGTHS.has(body.employmentLength) ? body.employmentLength : null,
    occupants:           Number.isFinite(occupantsNum) && occupantsNum > 0 ? occupantsNum : null,
    has_pets:            hasPets,
    pets_detail:         hasPets ? clean(body.petsDetail, 200) : null,
    // Form-410-equivalent CRM fields.
    address_history:      addressHistory,
    emergency_contact:    emergencyContact,
    personal_references:  personalReferences,
    vehicle,
    additional_income:    additionalIncome,
    is_smoker:            isSmoker,
  };

  try {
    // 1) Re-fetch the unit server-side — never trust a client-supplied price
    // or address — and confirm it's still available.
    const unitRes = await sbFetch(`units?id=eq.${body.unitId}&status=eq.available&select=id,beds,baths,type,price,neighbourhood,address`);
    if (!unitRes.ok) return json(502, { error: 'Could not look up that unit.' });
    const [unit] = await unitRes.json();
    if (!unit) return json(404, { error: 'This unit is no longer available.' });

    // 2) Insert the applicant.
    const insRes = await sbFetch('applicants', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(applicant),
    });
    if (!insRes.ok) {
      const detail = await insRes.text();
      return json(502, { error: 'Could not save application', detail });
    }
    const [saved] = await insRes.json();

    // 3) Write a single application row for this unit, snapshotting what was
    // actually applied to so later unit edits/removal never corrupt it.
    const appRes = await sbFetch('applications', {
      method: 'POST',
      body: JSON.stringify({
        applicant_id: saved.id,
        unit_id: unit.id,
        unit_snapshot: unit,
        stage: 'new',
      }),
    });
    if (!appRes.ok) {
      const detail = await appRes.text();
      return json(502, { error: 'Application saved but could not be linked to the unit', detail });
    }
    await sbFetch(`applicants?id=eq.${saved.id}`, { method: 'PATCH', body: JSON.stringify({ stage: 'matched' }) });

    // 4) Phone alert to Cyril (best-effort; keyless ntfy.sh, same topic as the dashboard).
    await notify(applicant, unit);

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: 'Failed to submit application', detail: String(e) });
  }
};
