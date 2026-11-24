import { json } from '../../lib/server.js';

// Public settings the dashboard needs before sign-in.
export async function onRequestGet({ env }) {
  return json({
    googleClientId: env.GOOGLE_CLIENT_ID || '',
    domain: env.ALLOWED_DOMAIN || 'edmonds.wednet.edu',
    emailCodes: Boolean(env.RESEND_API_KEY),
  });
}
