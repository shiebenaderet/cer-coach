import { json, err, sameOriginWrite, requireAdmin, normEmail, isAdminEmail, now } from '../../../lib/server.js';

// List everyone who has signed in or asked for access.
export async function onRequestGet({ request, env }) {
  const { error } = await requireAdmin(request, env);
  if (error) return error;
  const { results } = await env.DB.prepare(
    "SELECT email, name, school, note, role, status, requested_at, decided_at, last_login FROM teachers ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, requested_at DESC"
  ).all();
  return json({ teachers: results });
}

// { email, action: "approve" | "decline" | "remove" }
export async function onRequestPost({ request, env }) {
  if (!sameOriginWrite(request)) return err(403, 'Bad request.');
  const { teacher, error } = await requireAdmin(request, env);
  if (error) return error;
  let b;
  try { b = await request.json(); } catch { return err(400, 'Bad request.'); }
  const email = normEmail(b.email);
  if (isAdminEmail(env, email)) return err(400, 'Admins listed in the site settings cannot be changed here.');
  const status = { approve: 'approved', decline: 'declined', remove: 'declined' }[b.action];
  if (!status) return err(400, 'Unknown action.');
  const r = await env.DB.prepare('UPDATE teachers SET status = ?, decided_at = ?, decided_by = ? WHERE email = ?')
    .bind(status, now(), teacher.email, email).run();
  if (!r.meta.changes) return err(404, 'No one with that email has signed in.');
  return json({ ok: true, email, status });
}
