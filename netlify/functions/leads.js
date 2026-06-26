// ORP Landlord Dashboard — secure leads proxy
// Holds the Netlify API token server-side and gates access behind a password.
// The browser never sees the token. Required Netlify env vars:
//   NETLIFY_API_TOKEN   — a Netlify personal access token (server-side only)
//   NETLIFY_FORM_ID     — the form id to read submissions from
//   DASHBOARD_PASSWORD  — the password Cyril types to unlock the dashboard

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  },
  body: JSON.stringify(body),
});

// Constant-time-ish comparison so we don't leak length/timing trivially.
function passwordMatches(supplied, expected) {
  if (typeof supplied !== 'string' || typeof expected !== 'string') return false;
  if (supplied.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < supplied.length; i++) {
    diff |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const TOKEN     = process.env.NETLIFY_API_TOKEN;
  const FORM_ID   = process.env.NETLIFY_FORM_ID;            // tenant search form
  const LL_FORM   = process.env.NETLIFY_LANDLORD_FORM_ID;   // landlord valuation form
  const PASS      = process.env.DASHBOARD_PASSWORD;

  if (!TOKEN || !FORM_ID || !PASS) {
    return json(500, { error: 'Server not configured. Missing NETLIFY_API_TOKEN, NETLIFY_FORM_ID, or DASHBOARD_PASSWORD.' });
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { error: 'Bad request body' }); }

  if (!passwordMatches(body.password || '', PASS)) {
    return json(401, { error: 'Incorrect password' });
  }

  // Which form to read: 'tenant' (default) or 'landlord'.
  const formType = body.form === 'landlord' ? 'landlord' : 'tenant';
  const formId   = formType === 'landlord' ? LL_FORM : FORM_ID;
  if (!formId) {
    return json(500, { error: `No form id configured for ${formType} leads.` });
  }

  // Map a Netlify submission into the dashboard's lead shape, per form type.
  const mapTenant = (sub) => {
    const d = sub.data || {};
    return {
      netlifyId: sub.id,
      name:  d.searchName || d.name || '', email: d.searchEmail || d.email || '',
      phone: d.phone || d.searchPhone || '', beds: d.bedrooms || 'Any',
      budget: d.budget || '', moveIn: d.moveInDate || '',
      neighbourhood: d.neighborhood || 'Any', amenities: d.amenities || '',
      notes: d.specialRequests || '', source: 'orp',
      added: sub.created_at || new Date().toISOString(),
    };
  };
  const mapLandlord = (sub) => {
    const d = sub.data || {};
    return {
      netlifyId: sub.id,
      name: d.landlordName || '', email: d.landlordEmail || '', phone: d.landlordPhone || '',
      propertyType: d.propertyType || '', beds: d.bedrooms || '', baths: d.bathrooms || '',
      neighbourhood: d.neighborhood || '', address: d.propertyAddress || '',
      currentRent: d.currentRent || '', source: 'landlord',
      added: sub.created_at || new Date().toISOString(),
    };
  };

  try {
    const res = await fetch(
      `https://api.netlify.com/api/v1/forms/${formId}/submissions?per_page=100`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    if (!res.ok) {
      const detail = await res.text();
      return json(502, { error: `Netlify API error (${res.status})`, detail });
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      return json(502, { error: 'Unexpected Netlify API response' });
    }
    const leads = data.map(formType === 'landlord' ? mapLandlord : mapTenant);
    return json(200, { leads });
  } catch (e) {
    return json(500, { error: 'Failed to fetch submissions', detail: String(e) });
  }
};
