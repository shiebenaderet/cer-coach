import { json, err, sameOriginWrite, requireApproved, randomId, safeName, UPLOAD_TYPES, MAX_UPLOAD, now } from '../../../lib/server.js';

// multipart/form-data with one "file" field. Returns { file: "/files/u/<id>/<name>" }.
export async function onRequestPost({ request, env }) {
  if (!sameOriginWrite(request)) return err(403, 'Bad request.');
  const { teacher, error } = await requireApproved(request, env);
  if (error) return error;
  let form;
  try { form = await request.formData(); } catch { return err(400, 'Send the file as a form upload.'); }
  const file = form.get('file');
  if (!file || typeof file === 'string') return err(400, 'No file was attached.');
  const ext = UPLOAD_TYPES[file.type];
  if (!ext) return err(415, 'Upload a PDF, image (PNG, JPG, GIF, WebP), Word, PowerPoint or text file.');
  if (file.size > MAX_UPLOAD) return err(413, 'Files can be up to 15 MB.');
  const key = `u/${randomId(9)}/${safeName(file.name, ext)}`;
  await env.FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  await env.DB.prepare('INSERT INTO files (key, owner, name, type, size, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(key, teacher.email, String(file.name).slice(0, 200), file.type, file.size, now()).run();
  return json({ ok: true, file: `/files/${key}`, name: file.name, type: file.type });
}
