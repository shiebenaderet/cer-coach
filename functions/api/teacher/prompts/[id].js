import { json, err, sameOriginWrite, requireApproved } from '../../../../lib/server.js';

async function load(env, id, teacher) {
  const row = await env.DB.prepare('SELECT owner, data FROM prompts WHERE id = ?').bind(id).first();
  if (!row) return { error: err(404, 'That CER was not found.') };
  if (row.owner !== teacher.email && teacher.role !== 'admin') return { error: err(403, 'You can only open your own CERs.') };
  return { row };
}

export async function onRequestGet({ request, env, params }) {
  const { teacher, error } = await requireApproved(request, env);
  if (error) return error;
  const r = await load(env, params.id, teacher);
  if (r.error) return r.error;
  return json({ prompt: JSON.parse(r.row.data), owner: r.row.owner });
}

export async function onRequestDelete({ request, env, params }) {
  if (!sameOriginWrite(request)) return err(403, 'Bad request.');
  const { teacher, error } = await requireApproved(request, env);
  if (error) return error;
  const r = await load(env, params.id, teacher);
  if (r.error) return r.error;
  await env.DB.prepare('DELETE FROM prompts WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
}
