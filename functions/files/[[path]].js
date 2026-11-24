// Public: serve uploaded source files from R2.
const INLINE = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'text/plain']);

export async function onRequestGet({ env, params }) {
  const key = (Array.isArray(params.path) ? params.path : [params.path]).join('/');
  if (!/^u\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(key)) return new Response('Not found', { status: 404 });
  const obj = await env.FILES.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const type = obj.httpMetadata?.contentType || 'application/octet-stream';
  const name = key.split('/').pop();
  return new Response(obj.body, {
    headers: {
      'content-type': type,
      'content-disposition': `${INLINE.has(type) ? 'inline' : 'attachment'}; filename="${name}"`,
      'x-content-type-options': 'nosniff',
      // Chrome's PDF viewer will not render a sandboxed PDF, so only lock down other types.
      ...(type === 'application/pdf' ? {} : { 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" }),
      'cache-control': 'public, max-age=86400',
    },
  });
}
