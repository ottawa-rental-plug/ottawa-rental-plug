// ORP portal — public tenant application intake (Phase 1: Apply + Match)
// A branded application form (apply.html) posts here. This function inserts the
// applicant into Supabase and auto-matches them against available units, writing
// scored `applications` rows. It uses the Supabase SERVICE ROLE key server-side,
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

// Mirrors the dashboard's scoreLeadAgainstVacancy (landlord.html). Beds 40 /
// budget 30 / timing 20 / profile 10. Keep the two in sync if either changes.
function matchScore(applicant, unit) {
  let score = 0;
  const bedsNum = parseInt(applicant.beds_wanted, 10) || 0;
  if (applicant.beds_wanted === 'Any')          score += 20;
  else if (bedsNum === unit.beds)               score += 40;
  else if (Math.abs(bedsNum - unit.beds) === 1) score += 15;

  const budget = parseFloat(applicant.budget) || 0;
  const price  = parseFloat(unit.price) || 0;
  if (!budget)                       score += 15;
  else if (budget >= price)          score += 30;
  else if (budget >= price * 0.92)   score += 20;
  else if (budget >= price * 0.85)   score += 10;

  if (applicant.move_in) {
    const daysOut = Math.round((new Date(applicant.move_in + 'T12:00:00') - new Date()) / 86400000);
    if (daysOut >= 0 && daysOut <= 30)      score += 20;
    else if (daysOut > 30 && daysOut <= 60) score += 15;
    else if (daysOut > 60 && daysOut <= 90) score += 8;
  } else                                    score += 10;

  let urg = 0;
  if (applicant.name)    urg += 3;
  if (applicant.email)   urg += 3;
  if (applicant.move_in) urg += 2;
  if (applicant.budget)  urg += 2;
  score += urg;

  return Math.min(Math.round(score), 100);
}

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

// Best-effort phone alert via ntfy.sh (keyless). Never throws — a failed
// notification must not fail the application submission.
async function notify(applicant, matched, bestScore) {
  const topic = process.env.NTFY_TOPIC || 'ottawarentalplug';
  try {
    const beds = applicant.beds_wanted && applicant.beds_wanted !== 'Any' ? `${applicant.beds_wanted}BR ` : '';
    const budget = applicant.budget ? ` · $${applicant.budget}/mo` : '';
    const area = applicant.neighbourhood && applicant.neighbourhood !== 'Any' ? ` in ${applicant.neighbourhood}` : '';
    const matchLine = matched ? ` — matched ${matched} unit${matched === 1 ? '' : 's'} (best ${bestScore})` : ' — no unit match yet';
    await fetch(`https://ntfy.sh/${topic}`, {
      method: 'POST',
      headers: {
        Title: 'New ORP application',
        Priority: bestScore >= 75 ? 'high' : 'default',
        Tags: 'house',
      },
      body: `${applicant.name} wants a ${beds}place${area}${budget}${matchLine}. ${applicant.email}`,
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

  const name  = clean(body.name, 120);
  const email = clean(body.email, 160).toLowerCase();
  if (!name)         return json(400, { error: 'Name is required.' });
  if (!isEmail(email)) return json(400, { error: 'A valid email is required.' });

  const budgetNum = parseFloat(String(body.budget).replace(/[^\d.]/g, ''));
  const moveIn    = /^\d{4}-\d{2}-\d{2}$/.test(body.moveIn || '') ? body.moveIn : null;
  const consented = body.consentScreening === true || body.consentScreening === 'on';
  const ip = (event.headers['x-nf-client-connection-ip']
           || (event.headers['x-forwarded-for'] || '').split(',')[0]
           || '').trim() || null;

  const applicant = {
    name,
    email,
    phone:         clean(body.phone, 40),
    beds_wanted:   clean(body.beds, 10) || 'Any',
    budget:        Number.isFinite(budgetNum) ? budgetNum : null,
    move_in:       moveIn,
    neighbourhood: clean(body.neighbourhood, 80) || 'Any',
    source:        'apply',
    stage:         'new',
    consent_screening_at: consented ? new Date().toISOString() : null,
    consent_ip:    consented ? ip : null,
  };

  try {
    // 1) Insert the applicant.
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

    // 2) Auto-match against available units; write scored applications.
    let matched = 0, bestScore = 0;
    const unitsRes = await sbFetch('units?status=eq.available&select=id,beds,baths,type,price');
    if (unitsRes.ok) {
      const units = await unitsRes.json();
      const scored = units
        .map((u) => ({ applicant_id: saved.id, unit_id: u.id, match_score: matchScore(applicant, u), stage: 'new' }))
        .sort((a, b) => b.match_score - a.match_score);
      // Keep strong matches (>=50); if none, keep the single best so there's a record.
      let keep = scored.filter((a) => a.match_score >= 50).slice(0, 5);
      if (!keep.length && scored.length) keep = [scored[0]];
      if (keep.length) {
        bestScore = keep[0].match_score;
        const appRes = await sbFetch('applications', { method: 'POST', body: JSON.stringify(keep) });
        if (appRes.ok) matched = keep.length;
      }
      // Promote applicant stage if we found a real match.
      if (matched && bestScore >= 50) {
        await sbFetch(`applicants?id=eq.${saved.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ stage: 'matched' }),
        });
      }
    }

    // 3) Phone alert to Cyril (best-effort; keyless ntfy.sh, same topic as the dashboard).
    await notify(applicant, matched, bestScore);

    return json(200, { ok: true, matched });
  } catch (e) {
    return json(500, { error: 'Failed to submit application', detail: String(e) });
  }
};
