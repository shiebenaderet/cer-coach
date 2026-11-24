import { json, err, sameOriginWrite, currentTeacher, now } from '../../../lib/server.js';

// A signed-in teacher who is not approved yet asks for access.
export async function onRequestPost({ request, env }) {
  if (!sameOriginWrite(request)) return err(403, 'Bad request.');
  const t = await currentTeacher(request, env);
  if (!t) return err(401, 'Please sign in first.');
  if (t.status === 'approved') return json({ ok: true, status: 'approved' });
  let b;
  try { b = await request.json(); } catch { return err(400, 'Bad request.'); }
  const name = String(b.name || '').slice(0, 100).trim();
  const school = String(b.school || '').slice(0, 100).trim();
  const note = String(b.note || '').slice(0, 500).trim();
  if (!name || !school) return err(400, 'Add your name and school.');
  await env.DB.prepare("UPDATE teachers SET name = ?, school = ?, note = ?, status = 'pending', requested_at = ? WHERE email = ?")
    .bind(name, school, note, now(), t.email).run();
  return json({ ok: true, status: 'pending' });
}
