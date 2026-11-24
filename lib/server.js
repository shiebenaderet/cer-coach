// Shared server helpers for CER Coach Pages Functions.

const enc = new TextEncoder();
const SESSION_COOKIE = 'cer_session';
const SESSION_DAYS = 14;

// ---------------------------------------------------------------- responses
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}
export const err = (status, message, extra = {}) => json({ error: message, ...extra }, status);
export const now = () => new Date().toISOString();

// Mutating requests must come from our own pages (custom header + JSON or form-data).
export function sameOriginWrite(request) {
  return request.headers.get('x-cer') === '1';
}

// ---------------------------------------------------------------- base64url
export function b64u(bytes) {
  let s = '';
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const b64uStr = (s) => b64u(enc.encode(s));
const unb64uStr = (s) => new TextDecoder().decode(unb64u(s));

export function randomId(n = 16) {
  const b = new Uint8Array(n); crypto.getRandomValues(b); return b64u(b);
}

// ---------------------------------------------------------------- sessions (HMAC-signed cookie)
async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
export async function signSession(env, email) {
  if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET is not set');
  const body = b64uStr(JSON.stringify({ email, exp: Date.now() + SESSION_DAYS * 864e5 }));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env.SESSION_SECRET), enc.encode(body));
  return `${body}.${b64u(sig)}`;
}
export async function readSession(request, env) {
  if (!env.SESSION_SECRET) return null;
  const raw = (request.headers.get('cookie') || '').split(/;\s*/).find((c) => c.startsWith(SESSION_COOKIE + '='));
  if (!raw) return null;
  const [body, sig] = raw.slice(SESSION_COOKIE.length + 1).split('.');
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(env.SESSION_SECRET), unb64u(sig), enc.encode(body));
    if (!ok) return null;
    const data = JSON.parse(unb64uStr(body));
    if (!data.email || data.exp < Date.now()) return null;
    return data;
  } catch { return null; }
}
export function sessionCookie(value, maxAgeSec = SESSION_DAYS * 86400) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
}
export const clearCookie = () => `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

// ---------------------------------------------------------------- accounts
export const normEmail = (e) => String(e || '').trim().toLowerCase();
export function domainOK(env, email) {
  const d = (env.ALLOWED_DOMAIN || 'edmonds.wednet.edu').toLowerCase();
  return normEmail(email).endsWith('@' + d);
}
export function isAdminEmail(env, email) {
  return (env.ADMIN_EMAILS || '').split(',').map(normEmail).filter(Boolean).includes(normEmail(email));
}

// Make sure a teacher row exists; admins listed in env are always approved admins.
export async function upsertTeacher(env, email, name) {
  email = normEmail(email);
  const admin = isAdminEmail(env, email);
  const row = await env.DB.prepare('SELECT * FROM teachers WHERE email = ?').bind(email).first();
  if (!row) {
    await env.DB.prepare('INSERT INTO teachers (email, name, role, status, last_login) VALUES (?, ?, ?, ?, ?)')
      .bind(email, name || null, admin ? 'admin' : 'teacher', admin ? 'approved' : 'new', now()).run();
  } else {
    await env.DB.prepare('UPDATE teachers SET last_login = ?, name = COALESCE(name, ?), role = CASE WHEN ? THEN \'admin\' ELSE role END, status = CASE WHEN ? THEN \'approved\' ELSE status END WHERE email = ?')
      .bind(now(), name || null, admin ? 1 : 0, admin ? 1 : 0, email).run();
  }
  return env.DB.prepare('SELECT * FROM teachers WHERE email = ?').bind(email).first();
}

export async function currentTeacher(request, env) {
  const s = await readSession(request, env);
  if (!s) return null;
  const row = await env.DB.prepare('SELECT * FROM teachers WHERE email = ?').bind(normEmail(s.email)).first();
  if (!row) return null;
  if (isAdminEmail(env, row.email)) { row.role = 'admin'; row.status = 'approved'; }
  return row;
}
export async function requireApproved(request, env) {
  const t = await currentTeacher(request, env);
  if (!t) return { error: err(401, 'Please sign in.') };
  if (t.status !== 'approved') return { error: err(403, 'Your access has not been approved yet.') };
  return { teacher: t };
}
export async function requireAdmin(request, env) {
  const r = await requireApproved(request, env);
  if (r.error) return r;
  if (r.teacher.role !== 'admin') return { error: err(403, 'Only an admin can do that.') };
  return r;
}

// ---------------------------------------------------------------- Google ID token
let jwksCache = { keys: null, at: 0 };
async function googleKeys(fetchImpl) {
  if (jwksCache.keys && Date.now() - jwksCache.at < 3600e3) return jwksCache.keys;
  const r = await fetchImpl('https://www.googleapis.com/oauth2/v3/certs');
  if (!r.ok) throw new Error('Could not reach Google to check the sign-in.');
  jwksCache = { keys: (await r.json()).keys, at: Date.now() };
  return jwksCache.keys;
}
export async function verifyGoogleIdToken(idToken, clientId, { fetchImpl = fetch, keys = null } = {}) {
  const parts = String(idToken || '').split('.');
  if (parts.length !== 3) throw new Error('Bad sign-in token.');
  const [h, p, s] = parts;
  let header, payload;
  try { header = JSON.parse(unb64uStr(h)); payload = JSON.parse(unb64uStr(p)); }
  catch { throw new Error('Bad sign-in token.'); }
  if (header.alg !== 'RS256') throw new Error('Unexpected sign-in token type.');
  const jwks = keys || (await googleKeys(fetchImpl));
  const jwk = jwks.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Unknown sign-in key.');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, unb64u(s), enc.encode(`${h}.${p}`));
  if (!ok) throw new Error('Sign-in token did not verify.');
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) throw new Error('Sign-in token is not from Google.');
  if (!clientId || payload.aud !== clientId) throw new Error('Sign-in token is for a different app.');
  if (!payload.exp || payload.exp * 1000 < Date.now()) throw new Error('Sign-in token expired. Try again.');
  if (payload.email_verified !== true && payload.email_verified !== 'true') throw new Error('That Google account email is not verified.');
  return payload;
}

// ---------------------------------------------------------------- emailed codes
export async function sha256Hex(s) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function sixDigits() {
  const b = new Uint32Array(1); crypto.getRandomValues(b);
  return String(b[0] % 1000000).padStart(6, '0');
}

// ---------------------------------------------------------------- prompt validation
const TYPES = new Set(['excerpt', 'pdf', 'image', 'doc', 'link']);
const VERSIONS = new Set(['Quick', 'Clear', 'Full', 'Deep']);
const str = (v, max) => String(v ?? '').slice(0, max);
const okURL = (u) => { if (!u) return ''; try { const x = new URL(u); return ['http:', 'https:'].includes(x.protocol) ? x.href : ''; } catch { return ''; } };
const okFile = (f) => (/^\/files\/u\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(String(f || '')) ? f : '');

export function cleanPrompt(input, id) {
  const p = input || {};
  const sources = (Array.isArray(p.sources) ? p.sources : []).slice(0, 12).map((s) => {
    const type = TYPES.has(s?.type) ? s.type : 'excerpt';
    const out = { type, title: str(s.title, 160), note: str(s.note, 400), citation: str(s.citation, 400), url: okURL(s.url) };
    if (type === 'excerpt' || type === 'link' || type === 'doc') out.excerpt = str(s.excerpt, 3000);
    if (type === 'pdf' || type === 'image' || type === 'doc') out.file = okFile(s.file);
    if (type === 'image') out.alt = str(s.alt, 300);
    return out;
  });
  return {
    id,
    title: str(p.title, 120) || 'Untitled CER',
    unit: str(p.unit, 120),
    question: str(p.question, 500),
    version: VERSIONS.has(p.version) ? p.version : 'Full',
    wordBank: (Array.isArray(p.wordBank) ? p.wordBank : String(p.wordBank || '').split(','))
      .map((w) => str(w, 40).trim()).filter(Boolean).slice(0, 20),
    sources,
  };
}

export function slugify(t) {
  return String(t || 'cer').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'cer';
}

// ---------------------------------------------------------------- uploads
export const UPLOAD_TYPES = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
};
export const MAX_UPLOAD = 15 * 1024 * 1024;
export function safeName(name, ext) {
  const base = String(name || 'file').replace(/\.[^.]*$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
  return `${base}.${ext}`;
}
