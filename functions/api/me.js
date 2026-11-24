import { json, currentTeacher } from '../../lib/server.js';

export async function onRequestGet({ request, env }) {
  const t = await currentTeacher(request, env);
  if (!t) return json({ signedIn: false });
  return json({ signedIn: true, email: t.email, name: t.name, role: t.role, status: t.status });
}
