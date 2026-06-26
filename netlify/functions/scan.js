// ORP Landlord Dashboard — live lead scanner
// Pulls real "housing wanted" posts from Reddit (free) and, if a Bright Data key
// is configured, from Kijiji too. Password-gated like the leads function.
//
// Required env vars:
//   DASHBOARD_PASSWORD                 — same password as the dashboard login
// Reddit (free) — set both to enable Reddit scanning:
//   REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET
//     Create a "script" app at https://www.reddit.com/prefs/apps (takes ~2 min).
// Bright Data (optional, paid) — set both to enable Kijiji scanning:
//   BRIGHTDATA_API_KEY, BRIGHTDATA_ZONE
//     Zone = a Web Unlocker zone created in your Bright Data dashboard.

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

function passwordMatches(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Detect bedroom count from free text, e.g. "looking for a 2 bedroom", "3br", "2-bed".
function detectBeds(text) {
  const m = (text || '').match(/(\d+)\s*[-\s]?\s*(?:bed|bdrm|bedroom|br)\b/i);
  return m ? parseInt(m[1], 10) : null;
}

// Heuristic: does this post read like someone *seeking* a place (not a listing)?
const SEEKING = /\b(looking for|in search of|\biso\b|searching for|need a|wanted|anyone (?:renting|have)|seeking|hoping to find|trying to find)\b/i;
const RENTAL  = /\b(rent|apartment|bedroom|\bbr\b|condo|house|room|sublet|lease|housing)\b/i;

// ── REDDIT (free, official API) ─────────────────────────────────────
async function redditToken(id, secret) {
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'ORP-Dashboard/1.0 (Ottawa rental lead finder)',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Reddit auth failed (${res.status})`);
  const { access_token } = await res.json();
  if (!access_token) throw new Error('Reddit returned no token');
  return access_token;
}

async function scanReddit() {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return { status: 'skipped', reason: 'Reddit API keys not set', results: [] };

  const token = await redditToken(id, secret);
  const subs = ['ottawa', 'uOttawa', 'Carleton'];
  const query = '(looking for OR ISO OR wanted OR seeking) (rent OR apartment OR bedroom OR house OR sublet)';
  const results = [];

  for (const sub of subs) {
    const url = `https://oauth.reddit.com/r/${sub}/search?` + new URLSearchParams({
      q: query, restrict_sr: '1', sort: 'new', limit: '25', t: 'month',
    });
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'ORP-Dashboard/1.0 (Ottawa rental lead finder)' },
    });
    if (!res.ok) continue; // skip a sub that errors, keep the others
    const data = await res.json();
    for (const child of (data.data?.children || [])) {
      const p = child.data || {};
      const blob = `${p.title || ''} ${p.selftext || ''}`;
      if (!SEEKING.test(blob) || !RENTAL.test(blob)) continue; // skip listings / off-topic
      results.push({
        source: 'reddit',
        sub: p.subreddit,
        title: p.title || '(untitled)',
        desc: (p.selftext || '').slice(0, 220).replace(/\s+/g, ' ').trim() || `Posted in r/${p.subreddit}`,
        beds: detectBeds(blob),
        url: 'https://www.reddit.com' + (p.permalink || ''),
        created: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : null,
      });
    }
  }
  return { status: 'ok', results };
}

// ── KIJIJI via Bright Data (optional, paid) ─────────────────────────
async function scanKijiji() {
  const key = process.env.BRIGHTDATA_API_KEY;
  const zone = process.env.BRIGHTDATA_ZONE;
  if (!key || !zone) return { status: 'skipped', reason: 'Bright Data not configured', results: [] };

  // Ottawa "real estate wanted" listings — people posting what they're looking for.
  const target = 'https://www.kijiji.ca/b-real-estate/ottawa/housing-wanted/k0c34l1700185?sort=dateDesc';
  const res = await fetch('https://api.brightdata.com/request', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ zone, url: target, format: 'raw' }),
  });
  if (!res.ok) return { status: 'error', reason: `Bright Data error (${res.status})`, results: [] };
  const html = await res.text();

  // Kijiji renders listing data in embedded JSON; fall back to anchor scraping.
  const results = [];
  const seen = new Set();
  const re = /href="(\/v-[^"]*?\/(\d+))"[^>]*>([^<]{8,120})</g;
  let m;
  while ((m = re.exec(html)) && results.length < 25) {
    const [, path, id, rawTitle] = m;
    if (seen.has(id)) continue;
    seen.add(id);
    const title = rawTitle.replace(/\s+/g, ' ').trim();
    if (!RENTAL.test(title)) continue;
    results.push({
      source: 'kijiji',
      title,
      desc: 'Housing-wanted post on Kijiji Ottawa',
      beds: detectBeds(title),
      url: 'https://www.kijiji.ca' + path,
      created: null,
    });
  }
  return { status: 'ok', results };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!process.env.DASHBOARD_PASSWORD) return json(500, { error: 'Server not configured (DASHBOARD_PASSWORD missing)' });

  let supplied = '';
  try { supplied = (JSON.parse(event.body || '{}').password) || ''; }
  catch (e) { return json(400, { error: 'Bad request body' }); }
  if (!passwordMatches(supplied, process.env.DASHBOARD_PASSWORD)) return json(401, { error: 'Incorrect password' });

  // Run both sources; never let one failure kill the other.
  const [reddit, kijiji] = await Promise.all([
    scanReddit().catch((e) => ({ status: 'error', reason: String(e.message || e), results: [] })),
    scanKijiji().catch((e) => ({ status: 'error', reason: String(e.message || e), results: [] })),
  ]);

  const results = [...reddit.results, ...kijiji.results];
  return json(200, {
    results,
    sources: {
      reddit: { status: reddit.status, reason: reddit.reason || null, count: reddit.results.length },
      kijiji: { status: kijiji.status, reason: kijiji.reason || null, count: kijiji.results.length },
    },
    scannedAt: new Date().toISOString(),
  });
};
