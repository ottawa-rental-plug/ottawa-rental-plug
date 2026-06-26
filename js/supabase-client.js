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
