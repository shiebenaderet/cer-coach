import { json, err, sameOriginWrite, verifyGoogleIdToken, domainOK, upsertTeacher, signSession, sessionCookie } from '../../../lib/server.js';

export async function onRequestPost({ request, env }) {
  if (!sameOriginWrite(request)) return err(403, 'Bad request.');
  if (!env.GOOGLE_CLIENT_ID) return err(503, 'Google sign-in is not set up yet.');
  let body;
  try { body = await request.json(); } catch { return err(400, 'Bad request.'); }
  let claims;
  try { claims = await verifyGoogleIdToken(body.credential, env.GOOGLE_CLIENT_ID); }
  catch (e) { return err(401, e.message); }
  if (!domainOK(env, claims.email)) {
    return err(403, `Use your @${env.ALLOWED_DOMAIN || 'edmonds.wednet.edu'} school account.`);
  }
  const t = await upsertTeacher(env, claims.email, claims.name);
  const cookie = sessionCookie(await signSession(env, t.email));
  return json({ ok: true, email: t.email, status: t.status, role: t.role }, 200, { 'set-cookie': cookie });
}
