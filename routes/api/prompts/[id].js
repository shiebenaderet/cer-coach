import { json, err } from '../../../lib/server.js';

// Public: students load a teacher-built CER by its id.
export async function onRequestGet({ env, params }) {
  const row = await env.DB.prepare('SELECT data FROM prompts WHERE id = ?').bind(String(params.id)).first();
  if (!row) return err(404, 'That CER was not found.');
  return json(JSON.parse(row.data), 200, { 'cache-control': 'public, max-age=60' });
}
