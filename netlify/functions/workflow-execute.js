// ORP portal — workflow automation (Phase 2)
// Executes workflows when applicants change stages

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lvmsajsvkmwejggecehp.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!SERVICE_KEY) return json(500, { error: 'Server not configured' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Bad request body' }); }

  const { applicantId, triggerType, triggerStage } = body;
  if (!applicantId || !triggerType) return json(400, { error: 'Missing required fields' });

  try {
    // Find matching workflows
    const wRes = await sbFetch(
      `workflows?trigger_type=eq.${encodeURIComponent(triggerType)}&trigger_stage=eq.${encodeURIComponent(triggerStage)}&enabled=eq.true&select=*`
    );
    if (!wRes.ok) throw new Error('Could not fetch workflows');
    const workflows = await wRes.json();

    let executed = 0;
    for (const workflow of workflows) {
      const action = workflow.action_data || {};

      try {
        if (workflow.action_type === 'send_email') {
          // Get applicant email
          const aRes = await sbFetch(`applicants?id=eq.${applicantId}&select=email,name`);
          const [applicant] = aRes.ok ? await aRes.json() : [null];
          if (!applicant?.email) continue;

          // Send email via Formspree (placeholder)
          await fetch('https://formspree.io/f/your-form-id', {
            method: 'POST',
            body: JSON.stringify({
              email: applicant.email,
              subject: action.template ? `ORP: ${action.template}` : 'Message from Ottawa Rental Plug',
              message: `Hi ${applicant.name}, your application has been updated.`
            }),
            headers: { 'Content-Type': 'application/json' }
          }).catch(() => {});

          // Log activity
          await sbFetch('activities', {
            method: 'POST',
            body: JSON.stringify({
              applicant_id: applicantId,
              type: 'status_change',
              body: `Automated email sent: ${action.template || 'default'}`
            })
          });

          executed++;
        } else if (workflow.action_type === 'create_task') {
          // Create task with optional delay
          const delayHours = action.delay_hours || 0;
          const dueAt = new Date(Date.now() + delayHours * 3600000).toISOString();
          await sbFetch('tasks', {
            method: 'POST',
            body: JSON.stringify({
              applicant_id: applicantId,
              title: action.title || 'Follow up',
              due_at: dueAt,
              type: 'followup'
            })
          });
          executed++;
        } else if (workflow.action_type === 'advance_stage') {
          // Auto-advance to next stage
          const nextStage = action.next_stage;
          if (nextStage) {
            await sbFetch(`applicants?id=eq.${applicantId}`, {
              method: 'PATCH',
              body: JSON.stringify({ stage: nextStage })
            });
            executed++;
          }
        }

        // Log execution
        await sbFetch('workflow_executions', {
          method: 'POST',
          body: JSON.stringify({
            workflow_id: workflow.id,
            applicant_id: applicantId,
            status: 'completed'
          })
        });
      } catch (e) {
        console.error(`Workflow ${workflow.id} failed:`, e);
        await sbFetch('workflow_executions', {
          method: 'POST',
          body: JSON.stringify({
            workflow_id: workflow.id,
            applicant_id: applicantId,
            status: 'failed',
            error: e.message
          })
        });
      }
    }

    return json(200, { ok: true, executed });
  } catch (e) {
    console.error('workflow-execute error:', e);
    return json(500, { error: e.message });
  }
};
