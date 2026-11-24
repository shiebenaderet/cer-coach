import { json, err, sameOriginWrite, domainOK, normEmail, sha256Hex, sixDigits } from '../../../../lib/server.js';

// Fallback sign-in: email a six-digit code to a district address.
export async function onRequestPost({ request, env }) {
  if (!sameOriginWrite(request)) return err(403, 'Bad request.');
  if (!env.RESEND_API_KEY) return err(503, 'Emailed codes are not set up yet. Use Google sign-in.');
  let email;
  try { email = normEmail((await request.json()).email); } catch { return err(400, 'Bad request.'); }
  if (!domainOK(env, email)) return err(403, `Use your @${env.ALLOWED_DOMAIN || 'edmonds.wednet.edu'} school address.`);

  const prev = await env.DB.prepare('SELECT sent_at FROM login_codes WHERE email = ?').bind(email).first();
  if (prev && Date.now() - prev.sent_at < 60e3) return err(429, 'A code was just sent. Wait a minute before asking again.');

  const code = sixDigits();
  await env.DB.prepare('INSERT OR REPLACE INTO login_codes (email, code_hash, expires_at, tries, sent_at) VALUES (?, ?, ?, 0, ?)')
    .bind(email, await sha256Hex(`${email}:${code}:${env.SESSION_SECRET}`), Date.now() + 10 * 60e3, Date.now()).run();

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'CER Coach <coach@mrbsocialstudies.org>',
      to: [email],
      subject: `Your CER Coach sign-in code: ${code}`,
      text: `Your CER Coach sign-in code is ${code}.\n\nIt works for 10 minutes. If you did not ask for it, you can ignore this email.`,
    }),
  });
  if (!r.ok) return err(502, 'The code email could not be sent. Try Google sign-in.');
  return json({ ok: true });
}
