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
    client_id: String(v.id),
    beds: v.beds != null ? parseInt(v.beds) : null,
    baths: v.baths != null ? parseFloat(v.baths) : null,
    type: v.type || null,
    price: v.price != null ? parseFloat(v.price) : null,
    address: v.address || null,
    neighbourhood: v.neighbourhood || null,
    description: v.description || null,
    landlord_id: v.landlordId || null,
    listed_at: v.listed || null,
    status: 'available',
  };
}
// Upsert the dashboard's current vacancies into the cloud `units` table,
// keyed on a stable client_id (the vacancy's local id). This keeps each
// unit's real uuid — and therefore any apply link already sent out — stable
// across edits, instead of wiping and recreating every unit on every
// publish. Only removes cloud units whose vacancy was actually deleted.
async function orpMirrorUnits(vacancies) {
  const list = vacancies || [];
  if (list.length) {
    const { error } = await sb.from('units')
      .upsert(list.map(unitFromVacancy), { onConflict: 'client_id' });
    if (error) throw error;
  }
  const keepIds = list.map(v => String(v.id));
  const del = keepIds.length
    ? await sb.from('units').delete().not('client_id', 'is', null).not('client_id', 'in', `(${keepIds.map(id => `"${id}"`).join(',')})`)
    : await sb.from('units').delete().not('client_id', 'is', null);
  if (del.error) throw del.error;
}

// ── Screening (Phase 2) ───────────────────────────────────────────────
// Calls the SingleKey-backed Netlify function as the signed-in agent.
// Throws with `.status` set so callers can distinguish "not configured yet"
// (503, expected until SINGLEKEY_API_TOKEN is set) from real errors.
async function orpRequestScreening(applicantId) {
  const session = await orpSession();
  if (!session) throw new Error('Not signed in');
  const res = await fetch('/.netlify/functions/screening', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ applicantId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ── Notifications (Phase 4: ntfy push alerts) ─────────────────────
async function orpSendNotification(title, message, tags = '') {
  const session = await orpSession();
  if (!session) throw new Error('Not signed in');

  const res = await fetch('/.netlify/functions/send-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ title, message, tags }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ── Documents (Phase 3: document management) ──────────────────────
async function orpUploadDocument(applicantId, file, docType) {
  const session = await orpSession();
  if (!session) throw new Error('Not signed in');

  // Generate unique file path
  const ext = file.name.split('.').pop();
  const fileName = `${applicantId}/${docType}/${Date.now()}-${file.name}`;

  // Upload to Supabase Storage
  const { data, error: uploadError } = await sb.storage
    .from('orp-documents')
    .upload(fileName, file);
  if (uploadError) throw uploadError;

  // Record metadata in documents table
  const { error: dbError } = await sb.from('documents').insert({
    applicant_id: applicantId,
    type: docType,
    file_name: file.name,
    file_path: data.path,
    file_size: file.size,
    mime_type: file.type,
    uploaded_by: session.user.email
  });
  if (dbError) throw dbError;

  return { path: data.path, fileName: file.name };
}
async function orpLoadDocuments(applicantId) {
  const { data, error } = await sb.from('documents')
    .select('*')
    .eq('applicant_id', applicantId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
async function orpGetDocumentUrl(filePath) {
  const { data } = sb.storage.from('orp-documents').getPublicUrl(filePath);
  return data.publicUrl;
}
async function orpDeleteDocument(documentId, filePath) {
  // Delete from storage
  const { error: storageError } = await sb.storage
    .from('orp-documents')
    .remove([filePath]);
  if (storageError) console.error('Storage delete error:', storageError);

  // Delete from database
  const { error: dbError } = await sb.from('documents').delete().eq('id', documentId);
  if (dbError) throw dbError;
}

// ── Workflows (Phase 2: automation) ────────────────────────────────
async function orpLoadWorkflows() {
  const { data, error } = await sb.from('workflows').select('*').eq('enabled', true).order('created_at');
  if (error) throw error;
  return data || [];
}
async function orpSaveWorkflow(workflow) {
  const session = await orpSession();
  if (!session) throw new Error('Not signed in');
  if (workflow.id) {
    const { error } = await sb.from('workflows').update(workflow).eq('id', workflow.id);
    if (error) throw error;
    return workflow.id;
  }
  const { data, error } = await sb.from('workflows').insert(workflow).select('id').single();
  if (error) throw error;
  return data.id;
}
async function orpDeleteWorkflow(id) {
  const { error } = await sb.from('workflows').delete().eq('id', id);
  if (error) throw error;
}
async function orpTriggerWorkflows(applicantId, triggerType, triggerStage) {
  const session = await orpSession();
  if (!session) throw new Error('Not signed in');
  const res = await fetch('/.netlify/functions/workflow-execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ applicantId, triggerType, triggerStage }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ── Tasks (Phase 1: kanban pipeline) ────────────────────────────────
async function orpLoadTasks(applicantId) {
  const { data, error } = await sb.from('tasks').select('*').eq('applicant_id', applicantId).order('due_at', { ascending: true });
  if (error) throw error;
  return data || [];
}
async function orpSaveTask(task) {
  const session = await orpSession();
  if (!session) throw new Error('Not signed in');
  if (task.id) {
    const { error } = await sb.from('tasks').update(task).eq('id', task.id);
    if (error) throw error;
    return task.id;
  }
  const { data, error } = await sb.from('tasks').insert({...task, created_by: session.user.email}).select('id').single();
  if (error) throw error;
  return data.id;
}
async function orpCompleteTask(taskId) {
  const { error } = await sb.from('tasks').update({completed_at: new Date().toISOString()}).eq('id', taskId);
  if (error) throw error;
}
async function orpDeleteTask(taskId) {
  const { error } = await sb.from('tasks').delete().eq('id', taskId);
  if (error) throw error;
}
async function orpTodayTasks() {
  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  const { data, error } = await sb.from('tasks')
    .select('*,applicants(id,name,stage)')
    .lte('due_at', tomorrow)
    .is('completed_at', null)
    .order('due_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

// ── Landlord accounts (Phase 5: client portal) ────────────────────────
async function orpLoadLandlords() {
  const { data, error } = await sb.from('landlords').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
async function orpSaveLandlord({ id, name, email, phone }) {
  const row = { name: name || null, email: (email || '').toLowerCase() || null, phone: phone || null };
  if (id) {
    const { error } = await sb.from('landlords').update(row).eq('id', id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await sb.from('landlords').insert(row).select('id').single();
  if (error) throw error;
  return data.id;
}
async function orpDeleteLandlord(id) {
  const { error } = await sb.from('landlords').delete().eq('id', id);
  if (error) throw error;
}
async function orpAssignUnitLandlord(unitId, landlordId) {
  const { error } = await sb.from('units').update({ landlord_id: landlordId }).eq('id', unitId);
  if (error) throw error;
}
async function orpLoadUnits() {
  const { data, error } = await sb.from('units').select('id,beds,baths,type,price,address,neighbourhood,status,landlord_id').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
async function orpInviteLandlord(landlordId, email) {
  const session = await orpSession();
  if (!session) throw new Error('Not signed in');
  const res = await fetch('/.netlify/functions/landlord-invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ landlordId, email }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
