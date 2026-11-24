import { json, err, sameOriginWrite, requireApproved, cleanPrompt, slugify, randomId, now } from '../../../../lib/server.js';

// My CERs (admins see everyone's).
export async function onRequestGet({ request, env }) {
  const { teacher, error } = await requireApproved(request, env);
  if (error) return error;
  const q = teacher.role === 'admin'
    ? env.DB.prepare('SELECT id, owner, data, updated_at FROM prompts ORDER BY updated_at DESC')
    : env.DB.prepare('SELECT id, owner, data, updated_at FROM prompts WHERE owner = ? ORDER BY updated_at DESC').bind(teacher.email);
  const { results } = await q.all();
  return json({
    prompts: results.map((r) => {
      const d = JSON.parse(r.data);
      return { id: r.id, owner: r.owner, title: d.title, unit: d.unit, question: d.question, updated_at: r.updated_at, mine: r.owner === teacher.email };
    }),
  });
}

// Create (no id) or update (id) a CER.
export async function onRequestPost({ request, env }) {
  if (!sameOriginWrite(request)) return err(403, 'Bad request.');
  const { teacher, error } = await requireApproved(request, env);
  if (error) return error;
  let b;
  try { b = await request.json(); } catch { return err(400, 'Bad request.'); }

  let id = b.id ? String(b.id) : '';
  if (id) {
    const row = await env.DB.prepare('SELECT owner FROM prompts WHERE id = ?').bind(id).first();
    if (!row) return err(404, 'That CER was not found.');
    if (row.owner !== teacher.email && teacher.role !== 'admin') return err(403, 'You can only edit your own CERs.');
    const data = cleanPrompt(b, id);
    if (!data.question) return err(400, 'Add the question students will answer.');
    await env.DB.prepare('UPDATE prompts SET data = ?, updated_at = ? WHERE id = ?').bind(JSON.stringify(data), now(), id).run();
    return json({ ok: true, id, prompt: data });
  }
  id = `${slugify(b.title)}-${randomId(3).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`;
  const data = cleanPrompt(b, id);
  if (!data.question) return err(400, 'Add the question students will answer.');
  await env.DB.prepare('INSERT INTO prompts (id, owner, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .bind(id, teacher.email, JSON.stringify(data), now(), now()).run();
  return json({ ok: true, id, prompt: data });
}
