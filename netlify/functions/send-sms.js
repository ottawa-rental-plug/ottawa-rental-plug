// ORP portal — Twilio SMS sending (Phase 4)
// Sends SMS notifications to applicants and landlords

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE_NUMBER;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

async function sendTwilioSMS(toPhone, message) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE) {
    throw new Error('Twilio not configured');
  }

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const body = new URLSearchParams({
    From: TWILIO_PHONE,
    To: toPhone,
    Body: message,
  });

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'SMS send failed');
  }

  return await res.json();
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  let reqBody;
  try { reqBody = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'Bad request body' }); }

  const { toPhone, message, templateType } = reqBody;
  if (!toPhone || !message) return json(400, { error: 'Missing toPhone or message' });

  try {
    // Validate phone format (basic E.164 check)
    if (!/^\+?[1-9]\d{1,14}$/.test(toPhone.replace(/\D/g, ''))) {
      return json(400, { error: 'Invalid phone number format' });
    }

    const result = await sendTwilioSMS(toPhone, message);
    console.log(`SMS sent to ${toPhone}: ${result.sid}`);

    return json(200, { ok: true, messageSid: result.sid, cost: result.price });
  } catch (e) {
    console.error('send-sms error:', e);
    return json(500, { error: e.message });
  }
};
