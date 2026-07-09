// Server-side Supabase utilities for Netlify functions
const { createClient } = require('@supabase/supabase-js');

const ORP_SUPABASE_URL = process.env.SUPABASE_URL || 'https://lvmsajsvkmwejggecehp.supabase.co';
const ORP_SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(ORP_SUPABASE_URL, ORP_SUPABASE_KEY);

// Verify JWT from Authorization header and return user if valid
async function verifyAuth(event) {
  const authHeader = event.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');

  if (!token) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }
    return data.user;
  } catch (e) {
    console.error('Auth verification failed:', e);
    return null;
  }
}

module.exports = {
  supabase,
  verifyAuth,
};
