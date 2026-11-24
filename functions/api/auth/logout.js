import { json, clearCookie } from '../../../lib/server.js';

export async function onRequestPost() {
  return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
}
