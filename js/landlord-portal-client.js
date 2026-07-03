// ORP client portal — landlord-facing Supabase client (Phase 5).
// Same project as the admin dashboard, same browser-safe publishable key. RLS
// (db/phase5-landlord-portal.sql) is what actually keeps a landlord scoped to
// their own units — this file is just thin helpers around that.
// Loaded after the supabase-js UMD bundle.

const LP_SUPABASE_URL = 'https://lvmsajsvkmwejggecehp.supabase.co';
const LP_SUPABASE_KEY = 'sb_publishable_ktgQ1_bHcK4J5rpAEZ-l_w_dqC9N144';

const lsb = window.supabase.createClient(LP_SUPABASE_URL, LP_SUPABASE_KEY);

// ── Auth ─────────────────────────────────────────────────────────────
async function lpSignIn(email, password) {
  const { data, error } = await lsb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}
async function lpSignOut() { await lsb.auth.signOut(); }
async function lpSession() { const { data } = await lsb.auth.getSession(); return data.session; }
// First-login flow: the invite email lands them here with a recovery/invite
// token in the URL; this exchanges it for a session so they can set a password.
async function lpExchangeUrlSession() {
  const { data, error } = await lsb.auth.getSession();
  if (error) throw error;
  return data.session;
}
async function lpSetPassword(password) {
  const { error } = await lsb.auth.updateUser({ password });
  if (error) throw error;
}

// ── Data (RLS-scoped to this landlord automatically) ────────────────────
async function lpLoadMyUnits() {
  const { data, error } = await lsb.from('units')
    .select('id,beds,baths,type,price,address,neighbourhood,status,listed_at')
    .order('listed_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
// PII-minimized: name + pipeline status only, never email/phone — Cyril stays
// the single point of contact (matches landlord_applicant_view in the DB).
async function lpLoadMyApplicants() {
  const { data, error } = await lsb.from('landlord_applicant_view')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
