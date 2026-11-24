import { json, err, sameOriginWrite, domainOK, upsertTeacher, signSession, sessionCookie } from '../../../lib/server.js';

// Local testing only: works when DEV_LOGIN=1 AND the request is to localhost.
// Never set DEV_LOGIN in the Cloudflare dashboard.
export async function onRequestPost({ request, env }) {
  const host = new URL(request.url).hostname;
  if (env.DEV_LOGIN !== '1' || !['localhost', '127.0.0.1'].includes(host)) return err(404, 'Not found.');
  if (!sameOriginWrite(request)) return err(403, 'Bad request.');
  const { email } = await request.json();
  if (!domainOK(env, email)) return err(403, 'Wrong domain.');
  const t = await upsertTeacher(env, email, 'Dev Login');
  return json({ ok: true, status: t.status }, 200, { 'set-cookie': sessionCookie(await signSession(env, t.email)).replace('; Secure', '') });
}
