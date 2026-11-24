// node tests/google-token.test.mjs
// Signs test ID tokens with a throwaway RSA key and checks verifyGoogleIdToken accepts and rejects the right ones.
import assert from 'node:assert/strict';
import { verifyGoogleIdToken, b64u, cleanPrompt } from '../lib/server.js';

const enc = new TextEncoder();
const { privateKey, publicKey } = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
const keys = [jwk];
const CLIENT = 'test-client.apps.googleusercontent.com';

async function token(claims, kid = 'k1') {
  const h = b64u(enc.encode(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' })));
  const p = b64u(enc.encode(JSON.stringify(claims)));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, enc.encode(`${h}.${p}`));
  return `${h}.${p}.${b64u(sig)}`;
}
const good = { iss: 'https://accounts.google.com', aud: CLIENT, exp: Math.floor(Date.now() / 1000) + 600, email: 'a@edmonds.wednet.edu', email_verified: true, hd: 'edmonds.wednet.edu' };
let n = 0;
const ok = (m) => { n++; console.log('ok', n, m); };

const c = await verifyGoogleIdToken(await token(good), CLIENT, { keys });
assert.equal(c.email, 'a@edmonds.wednet.edu'); ok('valid token accepted');

await assert.rejects(async () => verifyGoogleIdToken(await token({ ...good, aud: 'other' }), CLIENT, { keys }), /different app/); ok('wrong audience rejected');
await assert.rejects(async () => verifyGoogleIdToken(await token({ ...good, iss: 'evil.com' }), CLIENT, { keys }), /not from Google/); ok('wrong issuer rejected');
await assert.rejects(async () => verifyGoogleIdToken(await token({ ...good, exp: 1 }), CLIENT, { keys }), /expired/); ok('expired rejected');
await assert.rejects(async () => verifyGoogleIdToken(await token({ ...good, email_verified: false }), CLIENT, { keys }), /not verified/); ok('unverified email rejected');
await assert.rejects(async () => verifyGoogleIdToken(await token(good, 'k2'), CLIENT, { keys }), /Unknown sign-in key/); ok('unknown key rejected');
const t = await token(good); const [h, p] = t.split('.');
const tampered = `${h}.${b64u(enc.encode(JSON.stringify({ ...good, email: 'x@edmonds.wednet.edu' })))}.${t.split('.')[2]}`;
await assert.rejects(() => verifyGoogleIdToken(tampered, CLIENT, { keys }), /did not verify/); ok('tampered payload rejected');
await assert.rejects(() => verifyGoogleIdToken('a.b.c', CLIENT, { keys }), /Bad sign-in token/); ok('garbage rejected cleanly');

const cp = cleanPrompt({ title: 'T', question: 'Q?', version: 'Bogus', sources: [{ type: 'pdf', file: '/files/u/abc/x.pdf' }, { type: 'image', file: '../x', url: 'javascript:1' }] }, 'id1');
assert.equal(cp.version, 'Full'); assert.equal(cp.sources[0].file, '/files/u/abc/x.pdf'); assert.equal(cp.sources[1].file, ''); assert.equal(cp.sources[1].url, '');
ok('prompt cleaning blocks bad files and links');
console.log(`${n} passed`);
