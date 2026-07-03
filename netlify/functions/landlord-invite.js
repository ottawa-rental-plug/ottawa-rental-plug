// ORP portal — invite a landlord to the client portal (Phase 5).
// Called from the dashboard (Cyril, authenticated) when adding/inviting a
// landlord. Creates (or reuses) a Supabase Auth user for the landlord's email
// via the admin API, emails them a "set your password" invite link, and links
// that auth user to the landlords row so RLS (landlord_id = current_landlord_id())
// scopes their portal access to their own units.
//
// The service-role key never reaches the browser — this function is the only
// place it's used for auth admin actions.
//
// Required Netlify env vars:
//   SUPABASE_URL              — defaults to the known project
//   SUPABASE_SERVICE_ROLE_KEY — server-side only
//   SUPABASE_PUBLISHABLE_KEY  — browser-safe anon key, used only to verify the caller's session
// Optional:
//   LANDLORD_PORTAL_URL       — where the invite email link lands (defaults to
//                               the known production client-portal.html)

const SUPABASE_URL    = process.env.SUPABASE_URL || 'https://lvmsajsvkmwejggecehp.supabase.co';
const SERVICE_KEY     = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_ktgQ1_bHcK4J5rpAEZ-l_w_dqC9N144';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

async function sbAdmin(path, init = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json', ...(init.headers || {}),
    },
  });
}

// Verify the caller is the signed-in agent (mirrors screening.js). This
// function is admin-only in effect since only Cyril's dashboard calls it, but
// we still gate on a valid session rather than trusting the request body.
async function verifyAgent(event) {
  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!SERVICE_KEY) return json(500, { error: 'Server not configured (SUPABASE_SERVICE_ROLE_KEY missing).' });
  if (!(await verifyAgent(event))) return json(401, { error: 'Not authorized' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { error: 'Bad request body' }); }

  const landlordId = body.landlordId;
  const email = (body.email || '').trim().toLowerCase();
  if (!landlordId) return json(400, { error: 'landlordId is required' });
  if (!isEmail(email)) return json(400, { error: 'A valid email is required' });

  const PORTAL_URL = process.env.LANDLORD_PORTAL_URL || 'https://ottawarentalplug.com/client-portal.html';

  try {
    // Invite (or, if the user already exists, this 422s — we then look them up
    // and link by email instead so re-inviting/fixing a typo doesn't break).
    let userId = null;
    const inviteRes = await sbAdmin(`/auth/v1/invite?redirect_to=${encodeURIComponent(PORTAL_URL)}`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    if (inviteRes.ok) {
      const data = await inviteRes.json();
      userId = data.id || data.user?.id || null;
    } else if (inviteRes.status === 422 || inviteRes.status === 400) {
      // Likely "already registered" — look them up instead of failing.
      const listRes = await sbAdmin(`/auth/v1/admin/users?email=${encodeURIComponent(email)}`);
      if (listRes.ok) {
        const list = await listRes.json();
        const users = list.users || list || [];
        const match = users.find(u => (u.email || '').toLowerCase() === email);
        userId = match ? match.id : null;
      }
      if (!userId) {
        const detail = await inviteRes.text();
        return json(502, { error: 'Could not invite landlord', detail });
      }
    } else {
      const detail = await inviteRes.text();
      return json(502, { error: 'Could not invite landlord', detail });
    }

    // Link the auth user to the landlords row so RLS scopes their portal access.
    const patchRes = await sbAdmin(`/rest/v1/landlords?id=eq.${encodeURIComponent(landlordId)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ auth_user_id: userId, invited_at: new Date().toISOString(), email }),
    });
    if (!patchRes.ok) return json(502, { error: 'Invited, but could not link the landlord record', detail: await patchRes.text() });
    const [saved] = await patchRes.json();

    return json(200, { ok: true, landlord: saved });
  } catch (e) {
    return json(500, { error: 'Failed to invite landlord', detail: String(e) });
  }
};
