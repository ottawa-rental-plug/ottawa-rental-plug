// ORP portal — Supabase client + auth + state persistence (Phase 0)
// The publishable key is browser-safe: row-level security blocks all access
// until a user is signed in, and each user only sees their own app_state rows.
// Loaded after the supabase-js UMD bundle.

const ORP_SUPABASE_URL = 'https://lvmsajsvkmwejggecehp.supabase.co';
const ORP_SUPABASE_KEY = 'sb_publishable_ktgQ1_bHcK4J5rpAEZ-l_w_dqC9N144';

const sb = window.supabase.createClient(ORP_SUPABASE_URL, ORP_SUPABASE_KEY);

// ── Auth ─────────────────────────────────────────────────────────────
async function orpSignIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
async function orpSignOut() { await sb.auth.signOut(); }
async function orpSession() { const { data } = await sb.auth.getSession(); return data.session; }

// ── Key/value state (one JSONB row per user per key) ─────────────────
// Phase 0 stores the dashboard's existing data shapes (orpLeads, orpVacancies)
// verbatim, so all app logic — ids, statuses, scoring — stays unchanged.
async function orpLoadState(key) {
  const { data, error } = await sb.from('app_state').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  return data ? data.value : null;
}
async function orpSaveState(key, value) {
  const session = await orpSession();
  if (!session) throw new Error('Not signed in');
  const { error } = await sb.from('app_state')
    .upsert({ user_id: session.user.id, key, value, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,key' });
  if (error) throw error;
}

// ── Bridge to the normalized apply pipeline ──────────────────────────
// The public apply form writes tenants to the `applicants` table and matches
// them against `units`. These helpers let the dashboard (a) pull those
// applications in as leads, and (b) mirror its vacancies into `units` so the
// matcher sees real inventory. Both run under the authenticated session.
function leadFromApplicant(r) {
  return {
    id: r.id, name: r.name, email: r.email, phone: r.phone,
    beds: r.beds_wanted || 'Any', budget: r.budget,
    moveIn: r.move_in, neighbourhood: r.neighbourhood,
    status: 'new', source: r.source || 'apply', added: r.created_at,
  };
}
async function orpPullApplicants() {
  const { data, error } = await sb.from('applicants').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(leadFromApplicant);
}
function unitFromVacancy(v) {
  return {
    beds: v.beds != null ? parseInt(v.beds) : null,
    baths: v.baths != null ? parseFloat(v.baths) : null,
    type: v.type || null,
    price: v.price != null ? parseFloat(v.price) : null,
    listed_at: v.listed || null,
    status: 'available',
  };
}
// Replace the units table with the dashboard's current vacancies.
async function orpMirrorUnits(vacancies) {
  const del = await sb.from('units').delete().not('id', 'is', null);
  if (del.error) throw del.error;
  if (vacancies && vacancies.length) {
    const { error } = await sb.from('units').insert(vacancies.map(unitFromVacancy));
    if (error) throw error;
  }
}

// ── Screening (Phase 2) ───────────────────────────────────────────────
// Calls the SingleKey-backed Netlify function as the signed-in agent.
// Throws with `.status` set so callers can distinguish "not configured yet"
// (503, expected until SINGLEKEY_API_TOKEN is set) from real errors.
async function orpRequestScreening(applicantId) {
  return orpScreeningCall({ applicantId });
}
// Manual result entry (manual mode, before the SingleKey webhook is live).
// Stores only a short summary + optional link — never raw report contents.
async function orpUpdateScreening(screeningId, { status, resultSummary, reportUrl } = {}) {
  return orpScreeningCall({ action: 'update', screeningId, status, resultSummary, reportUrl });
}
async function orpScreeningCall(payload) {
  const session = await orpSession();
  if (!session) throw new Error('Not signed in');
  const res = await fetch('/.netlify/functions/screening', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ── Approval (Phase 3) ────────────────────────────────────────────────
// Records an approve/decline decision with its fixed criteria checklist, issues
// the "Approved by Cyril" badge timestamp on approval, and advances the
// applicant's stage. Written directly under the authenticated session (approvals
// has no secrets — RLS already locks it to the signed-in agent).
async function orpSaveApproval(applicantId, { decision, criteria, notes } = {}) {
  const session = await orpSession();
  if (!session) throw new Error('Not signed in');
  const approved = decision === 'approved';
  const { error } = await sb.from('approvals').insert({
    applicant_id: applicantId,
    decision: approved ? 'approved' : 'declined',
    criteria_checklist: criteria || {},
    badge_issued_at: approved ? new Date().toISOString() : null,
    notes: notes || null,
    decided_by: session.user.email || session.user.id,
  });
  if (error) throw error;
  const { error: stageErr } = await sb.from('applicants')
    .update({ stage: approved ? 'approved' : 'declined' }).eq('id', applicantId);
  if (stageErr) throw stageErr;
}
