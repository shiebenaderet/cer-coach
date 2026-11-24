import { json, err, sameOriginWrite, domainOK, normEmail, sha256Hex, upsertTeacher, signSession, sessionCookie } from '../../../../lib/server.js';

export async function onRequestPost({ request, env }) {
  if (!sameOriginWrite(request)) return err(403, 'Bad request.');
  let email, code;
  try { const b = await request.json(); email = normEmail(b.email); code = String(b.code || '').replace(/\D/g, ''); }
  catch { return err(400, 'Bad request.'); }
  if (!domainOK(env, email) || code.length !== 6) return err(400, 'Check the email address and the six-digit code.');

  const row = await env.DB.prepare('SELECT * FROM login_codes WHERE email = ?').bind(email).first();
  if (!row || row.expires_at < Date.now()) return err(401, 'That code has expired. Ask for a new one.');
  if (row.tries >= 5) return err(429, 'Too many tries. Ask for a new code.');
  const ok = row.code_hash === (await sha256Hex(`${email}:${code}:${env.SESSION_SECRET}`));
  if (!ok) {
    await env.DB.prepare('UPDATE login_codes SET tries = tries + 1 WHERE email = ?').bind(email).run();
    return err(401, 'That code is not right.');
  }
  await env.DB.prepare('DELETE FROM login_codes WHERE email = ?').bind(email).run();
  const t = await upsertTeacher(env, email, null);
  return json({ ok: true, status: t.status }, 200, { 'set-cookie': sessionCookie(await signSession(env, t.email)) });
}
