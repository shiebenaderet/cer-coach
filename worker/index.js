// CER Coach Worker: serves the API and uploaded files.
// Static files in site/ are served by Workers Static Assets before this runs.

import * as config from '../routes/api/config.js';
import * as me from '../routes/api/me.js';
import * as google from '../routes/api/auth/google.js';
import * as logout from '../routes/api/auth/logout.js';
import * as dev from '../routes/api/auth/dev.js';
import * as codeRequest from '../routes/api/auth/code/request.js';
import * as codeVerify from '../routes/api/auth/code/verify.js';
import * as accessRequest from '../routes/api/access/request.js';
import * as adminTeachers from '../routes/api/admin/teachers.js';
import * as teacherPrompts from '../routes/api/teacher/prompts/index.js';
import * as teacherPrompt from '../routes/api/teacher/prompts/[id].js';
import * as upload from '../routes/api/teacher/upload.js';
import * as publicPrompt from '../routes/api/prompts/[id].js';
import * as files from '../routes/files/[[path]].js';

// [pattern, module]. ":name" matches one path segment, "*name" matches the rest.
const ROUTES = [
  ['/api/config', config],
  ['/api/me', me],
  ['/api/auth/google', google],
  ['/api/auth/logout', logout],
  ['/api/auth/dev', dev],
  ['/api/auth/code/request', codeRequest],
  ['/api/auth/code/verify', codeVerify],
  ['/api/access/request', accessRequest],
  ['/api/admin/teachers', adminTeachers],
  ['/api/teacher/prompts', teacherPrompts],
  ['/api/teacher/prompts/:id', teacherPrompt],
  ['/api/teacher/upload', upload],
  ['/api/prompts/:id', publicPrompt],
  ['/files/*path', files],
];

function match(pattern, path) {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  const params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith('*')) { params[p[i].slice(1)] = s.slice(i).map(decodeURIComponent); return s.length > i ? params : null; }
    if (i >= s.length) return null;
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return p.length === s.length ? params : null;
}

const HANDLER = { GET: 'onRequestGet', POST: 'onRequestPost', DELETE: 'onRequestDelete', HEAD: 'onRequestGet' };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    for (const [pattern, mod] of ROUTES) {
      const params = match(pattern, url.pathname);
      if (!params) continue;
      const fn = mod[HANDLER[request.method]];
      if (!fn) return new Response('Method not allowed', { status: 405 });
      try {
        return await fn({ request, env, params, waitUntil: ctx.waitUntil.bind(ctx) });
      } catch (e) {
        console.error(e);
        return new Response(JSON.stringify({ error: 'Something went wrong on the server.' }), {
          status: 500, headers: { 'content-type': 'application/json' },
        });
      }
    }
    // Anything else that is not a static file.
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
  },
};
