// ORP portal — ntfy push notifications (Phase 4)
// Sends free push notifications via ntfy.sh

const NTFY_TOPIC = process.env.NTFY_TOPIC || 'orp-alerts';

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

async function sendNtifyNotification(title, message, tags = '') {
  const url = `https://ntfy.sh/${NTFY_TOPIC}`;
  const headers = {
    'Title': title,
    'Message': message,
    'Priority': 'high',
  };
  if (tags) headers['Tags'] = tags;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: message,
  });

  if (!res.ok) throw new Error(`ntfy error: ${res.status}`);
  return await res.json().catch(() => ({}));
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let reqBody;
  try { reqBody = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Bad request body' }); }

  const { title, message, tags } = reqBody;
  if (!title || !message) return json(400, { error: 'Missing title or message' });

  try {
    await sendNtifyNotification(title, message, tags);
    console.log(`Notification sent: ${title}`);
    return json(200, { ok: true, topic: NTFY_TOPIC });
  } catch (e) {
    console.error('send-notification error:', e);
    return json(500, { error: e.message });
  }
};
