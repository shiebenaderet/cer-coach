// CER Coach teacher dashboard: sign-in, access requests, CER builder, approvals.

const $ = (s, el = document) => el.querySelector(s);
const esc = (s = '') => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const main = () => $('#main');

let config = { googleClientId: '', domain: 'edmonds.wednet.edu', emailCodes: false };
let me = { signedIn: false };
let draft = null;          // CER being edited
let lastSaved = null;      // JSON of the draft as last saved
let pendingCount = 0;

const VERSIONS = ['Quick', 'Clear', 'Full', 'Deep'];
const TYPES = [['excerpt', 'Excerpt (short passage + citation)'], ['pdf', 'PDF'], ['image', 'Image'], ['doc', 'Document file'], ['link', 'Link only']];
const blankSource = () => ({ type: 'excerpt', title: '', note: '', excerpt: '', citation: '', url: '', file: '', alt: '' });
const blankDraft = () => ({ id: '', title: '', unit: '', question: '', version: 'Full', wordBank: [], sources: [blankSource()] });

// ---------------------------------------------------------------- api
async function api(path, { method = 'GET', body, form } = {}) {
  const opts = { method, headers: { 'x-cer': '1' }, credentials: 'same-origin' };
  if (form) opts.body = form;
  else if (body !== undefined) { opts.headers['content-type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const r = await fetch(path, opts);
  let data = {};
  try { data = await r.json(); } catch { /* empty */ }
  if (!r.ok) throw new Error(data.error || `Something went wrong (${r.status}).`);
  return data;
}

function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg; t.classList.toggle('bad', bad); t.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => { t.hidden = true; }, 3500);
}
function focusMain() { main().focus({ preventScroll: true }); window.scrollTo(0, 0); }
const studentLink = (id) => `${location.origin}/?q=${encodeURIComponent(id)}#/s/1`;

// ---------------------------------------------------------------- chrome
function paintChrome(view) {
  const acct = $('#acct');
  acct.innerHTML = me.signedIn
    ? `<span class="small muted">${esc(me.email)}</span><button class="btn quiet small" type="button" data-act="logout">Sign Out</button>`
    : `<a href="/">Student Site</a>`;
  const tabs = $('#tabs');
  if (!me.signedIn || me.status !== 'approved') { tabs.hidden = true; return; }
  tabs.hidden = false;
  const t = [['mine', 'My CERs'], ['build', draft?.id ? 'Edit CER' : 'Build a CER']];
  if (me.role === 'admin') t.push(['teachers', `Teachers${pendingCount ? ` <span class="count" aria-label="${pendingCount} waiting">${pendingCount}</span>` : ''}`]);
  tabs.innerHTML = t.map(([k, label]) => `<a href="#/${k}" ${view === k ? 'aria-current="page"' : ''}>${label}</a>`).join('') + `<a href="/" target="_blank" rel="noopener">Student Site</a>`;
}

// ---------------------------------------------------------------- router
async function route() {
  const view = location.hash.replace(/^#\/?/, '').split('/')[0] || 'mine';
  if (!me.signedIn) return renderSignIn();
  if (me.status !== 'approved') return renderRequest();
  if (me.role === 'admin') refreshPending();
  if (view === 'build') return renderBuilder();
  if (view === 'teachers' && me.role === 'admin') return renderTeachers();
  return renderMine();
}

async function refreshMe() {
  try { me = await api('/api/me'); } catch { me = { signedIn: false }; }
}
async function refreshPending() {
  try {
    const { teachers } = await api('/api/admin/teachers');
    const n = teachers.filter((t) => t.status === 'pending').length;
    if (n !== pendingCount) { pendingCount = n; paintChrome(location.hash.replace(/^#\/?/, '') || 'mine'); }
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------- sign in
function renderSignIn() {
  paintChrome('');
  const codes = config.emailCodes ? `<div class="or">or</div>
      <form id="codeForm" class="stack" novalidate>
        <div class="field"><label for="cemail">Get a sign-in code by email</label>
          <input type="email" id="cemail" autocomplete="email" placeholder="you@${esc(config.domain)}" required></div>
        <div class="field" id="codeRow" hidden><label for="ccode">Six-digit code</label>
          <input type="text" id="ccode" inputmode="numeric" autocomplete="one-time-code" maxlength="6"></div>
        <div class="row"><button class="btn ghost" type="submit" id="codeBtn">Email Me a Code</button></div>
      </form>` : '';
  main().innerHTML = `<div class="wrap"><div class="narrow"><div class="card stack">
      <h1>Teacher Sign-In</h1>
      <p>Sign in with your <b>@${esc(config.domain)}</b> school account to build CERs for your students.</p>
      <p class="small muted">Students do not need to sign in. They use the link you share.</p>
      <div id="gsi" class="gbtn">${config.googleClientId ? '' : '<p class="small muted">Google sign-in is not set up yet.</p>'}</div>
      ${codes}
      <div id="signmsg" class="small" aria-live="polite"></div>
    </div></div></div>`;
  focusMain();
  if (config.googleClientId) mountGoogle();
}

function mountGoogle(tries = 0) {
  if (!window.google?.accounts?.id) { if (tries < 40) setTimeout(() => mountGoogle(tries + 1), 150); return; }
  google.accounts.id.initialize({
    client_id: config.googleClientId,
    hd: config.domain,
    ux_mode: 'popup',
    callback: async (resp) => {
      $('#signmsg').textContent = 'Signing in...';
      try { await api('/api/auth/google', { method: 'POST', body: { credential: resp.credential } }); await refreshMe(); route(); }
      catch (e) { $('#signmsg').textContent = e.message; }
    },
  });
  google.accounts.id.renderButton($('#gsi'), { theme: 'outline', size: 'large', text: 'signin_with', shape: 'rectangular', width: 280 });
}

async function onCodeSubmit(e) {
  e.preventDefault();
  const email = $('#cemail').value.trim();
  const row = $('#codeRow');
  const msg = $('#signmsg');
  try {
    if (row.hidden) {
      await api('/api/auth/code/request', { method: 'POST', body: { email } });
      row.hidden = false; $('#codeBtn').textContent = 'Sign In'; $('#ccode').focus();
      msg.textContent = `Check ${email} for a six-digit code. It works for 10 minutes.`;
    } else {
      await api('/api/auth/code/verify', { method: 'POST', body: { email, code: $('#ccode').value } });
      await refreshMe(); route();
    }
  } catch (err) { msg.textContent = err.message; }
}

// ---------------------------------------------------------------- request access
function renderRequest() {
  paintChrome('');
  let body;
  if (me.status === 'pending') {
    body = `<h1>Request Sent</h1><p>Your request for CER Coach is waiting for approval. Check back soon, or reach out to Mr. Benaderet.</p>`;
  } else if (me.status === 'declined') {
    body = `<h1>No Access Yet</h1><p>Your account does not have dashboard access. If you think this is a mistake, contact Mr. Benaderet.</p>`;
  } else {
    body = `<h1>Request Access</h1>
      <p>You're signed in as <b>${esc(me.email)}</b>. CER Coach is in a small pilot, so new teachers are approved by hand.</p>
      <form id="reqForm" class="stack">
        <div class="field"><label for="rname">Your name</label><input type="text" id="rname" value="${esc(me.name || '')}" required></div>
        <div class="field"><label for="rschool">School</label><input type="text" id="rschool" required></div>
        <div class="field"><label for="rnote">What would you use it for? <span class="hint">(optional)</span></label><textarea id="rnote" class="short"></textarea></div>
        <div class="row"><button class="btn" type="submit">Request Access</button></div>
      </form>`;
  }
  main().innerHTML = `<div class="wrap"><div class="narrow"><div class="card stack">${body}<div id="reqmsg" class="small" aria-live="polite"></div></div></div></div>`;
  focusMain();
}

async function onRequestSubmit(e) {
  e.preventDefault();
  try {
    await api('/api/access/request', { method: 'POST', body: { name: $('#rname').value, school: $('#rschool').value, note: $('#rnote').value } });
    await refreshMe(); route();
  } catch (err) { $('#reqmsg').textContent = err.message; }
}

// ---------------------------------------------------------------- my CERs
async function renderMine() {
  paintChrome('mine');
  main().innerHTML = `<div class="wrap"><p class="muted">Loading your CERs...</p></div>`;
  let prompts = [];
  try { ({ prompts } = await api('/api/teacher/prompts')); } catch (e) { toast(e.message, true); }
  const items = prompts.map((p) => `<div class="item"><div class="info">
      <h3>${esc(p.title)}</h3>
      <div class="small muted">${esc(p.unit || '')}${p.unit ? ' · ' : ''}Updated ${esc(new Date(p.updated_at).toLocaleDateString())}${p.mine ? '' : ` · ${esc(p.owner)}`}</div>
      <div class="small">${esc(p.question)}</div></div>
      <div class="actions">
        <button class="btn quiet small" type="button" data-act="copy" data-id="${esc(p.id)}">Copy Student Link</button>
        <a class="btn quiet small" href="${esc(studentLink(p.id))}" target="_blank" rel="noopener">Student View</a>
        <button class="btn ghost small" type="button" data-act="edit" data-id="${esc(p.id)}">Edit</button>
        <button class="btn quiet small" type="button" data-act="delete" data-id="${esc(p.id)}" data-title="${esc(p.title)}">Delete</button>
      </div></div>`).join('');
  main().innerHTML = `<div class="wrap stack">
      <div class="row"><h1>My CERs</h1><span class="spacer"></span><button class="btn" type="button" data-act="new">Build a CER</button></div>
      ${items ? `<div class="list">${items}</div>` : `<div class="card"><p>You haven't built a CER yet.</p><p class="muted small">Each CER is a question, the sources students use, and a link you share in Canvas.</p></div>`}
    </div>`;
  focusMain();
}

// ---------------------------------------------------------------- builder
async function renderBuilder() {
  paintChrome('build');
  if (!draft) { draft = blankDraft(); lastSaved = JSON.stringify(draft); }
  const d = draft;
  main().innerHTML = `<div class="wrap"><form id="cerForm" class="form" novalidate>
    <div class="row"><h1>${d.id ? 'Edit CER' : 'Build a CER'}</h1></div>
    ${d.id ? `<div class="linkbox"><b>Student link:</b> <code>${esc(studentLink(d.id))}</code>
      <button class="btn quiet small" type="button" data-act="copy" data-id="${esc(d.id)}">Copy</button>
      <a class="btn quiet small" href="${esc(studentLink(d.id))}" target="_blank" rel="noopener">Student View</a></div>` : ''}
    <div class="card form">
      <h2>The Question</h2>
      <div class="field"><label for="b_question">Question students will answer</label>
        <textarea id="b_question" data-k="question" class="short" required>${esc(d.question)}</textarea></div>
      <div class="two">
        <div class="field"><label for="b_title">Short title <span class="hint">(students see this in the list)</span></label><input type="text" id="b_title" data-k="title" value="${esc(d.title)}"></div>
        <div class="field"><label for="b_unit">Unit <span class="hint">(optional)</span></label><input type="text" id="b_unit" data-k="unit" value="${esc(d.unit)}"></div>
      </div>
      <fieldset class="field"><legend class="q" style="font-weight:800">Default version</legend>
        <p class="small muted">Quick and Clear use 2 pieces of evidence. Full and Deep use 3 and require a counterpoint. Students can change it.</p>
        <div class="choice">${VERSIONS.map((v) => `<label><input type="radio" name="b_version" value="${v}" ${d.version === v ? 'checked' : ''}>${v}</label>`).join('')}</div></fieldset>
      <div class="field"><label for="b_words">Ideas from class <span class="hint">(word bank, separated by commas)</span></label>
        <input type="text" id="b_words" data-k="wordBank" value="${esc((d.wordBank || []).join(', '))}"></div>
    </div>
    <div class="card form">
      <div class="row"><h2>Sources</h2><span class="spacer"></span><span class="small muted">${d.sources.length} of 12</span></div>
      <p class="small muted">For a web page, paste only the part students need, with a citation and a link to the full original.</p>
      <div class="srcs">${d.sources.map((s, i) => sourceEditor(s, i)).join('')}</div>
      <div class="row"><button class="btn quiet" type="button" data-act="addsrc" ${d.sources.length >= 12 ? 'disabled' : ''}>Add a Source</button></div>
    </div>
    <div class="savebar"><button class="btn" type="submit" id="saveBtn">${d.id ? 'Save Changes' : 'Save and Get Link'}</button>
      ${d.id ? `<a href="${esc(studentLink(d.id))}" target="_blank" rel="noopener">Student View</a>` : ''}
      <span class="spacer"></span><button class="btn quiet small" type="button" data-act="cancel">${d.id ? 'Back to My CERs' : 'Cancel'}</button>
      <span id="savemsg" class="small" aria-live="polite"></span></div>
  </form></div>`;
  focusMain();
}

function sourceEditor(s, i) {
  const t = s.type;
  const field = (k, label, opts = {}) => {
    const id = `s${i}_${k}`;
    const v = s[k] || '';
    const input = opts.area
      ? `<textarea id="${id}" data-s="${i}.${k}" ${opts.short ? 'class="short"' : ''}>${esc(v)}</textarea>`
      : `<input type="${opts.type || 'text'}" id="${id}" data-s="${i}.${k}" value="${esc(v)}">`;
    return `<div class="field ${opts.wide ? 'wide' : ''}"><label for="${id}">${label}${opts.hint ? ` <span class="hint">${opts.hint}</span>` : ''}</label>${input}</div>`;
  };
  const needsFile = t === 'pdf' || t === 'image' || t === 'doc';
  const accept = { pdf: 'application/pdf', image: 'image/png,image/jpeg,image/gif,image/webp', doc: '.docx,.doc,.pptx,.txt' }[t] || '';
  const fileBox = needsFile ? `<div class="filebox">
      ${s.file ? `<span>Uploaded: <code>${esc(decodeURIComponent(s.file.split('/').pop()))}</code></span> <a href="${esc(s.file)}" target="_blank" rel="noopener">Open</a>` : '<span class="muted">No file yet.</span>'}
      <label class="btn quiet small" for="s${i}_upload">${s.file ? 'Replace File' : 'Upload File'}</label>
      <input type="file" id="s${i}_upload" data-upload="${i}" accept="${accept}" hidden>
      <span class="small muted" id="s${i}_upmsg" aria-live="polite"></span></div>` : '';
  return `<div class="src"><div class="head"><b>Source ${i + 1}</b>
      <label class="small" for="s${i}_type">Type</label>
      <select id="s${i}_type" data-s="${i}.type">${TYPES.map(([k, l]) => `<option value="${k}" ${t === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <span class="spacer"></span>
      ${i > 0 ? `<button class="btn quiet small" type="button" data-act="upsrc" data-i="${i}" aria-label="Move source ${i + 1} up">Move Up</button>` : ''}
      <button class="btn quiet small" type="button" data-act="delsrc" data-i="${i}" aria-label="Remove source ${i + 1}">Remove</button></div>
    ${field('title', 'Title')}
    ${field('note', 'Note for students', { hint: '(optional, one line)' })}
    ${t === 'excerpt' || t === 'link' || t === 'doc' ? field('excerpt', t === 'doc' ? 'Passage to focus on' : 'Excerpt', { area: true, hint: t === 'excerpt' ? '(only the part students need)' : '(optional)' }) : ''}
    ${fileBox}
    ${t === 'image' ? field('alt', 'Describe the image', { hint: '(for screen readers)' }) : ''}
    ${field('citation', 'Citation', { hint: '(who made it, title, where, when)' })}
    ${field('url', 'Link to the full original', { type: 'url', hint: t === 'excerpt' || t === 'link' ? '' : '(optional)' })}
  </div>`;
}

function readForm() {
  const f = $('#cerForm');
  if (!f) return;
  draft.question = $('#b_question').value;
  draft.title = $('#b_title').value;
  draft.unit = $('#b_unit').value;
  draft.wordBank = $('#b_words').value.split(',').map((w) => w.trim()).filter(Boolean);
  const v = f.querySelector('input[name=b_version]:checked'); if (v) draft.version = v.value;
  f.querySelectorAll('[data-s]').forEach((el) => {
    const [i, k] = el.dataset.s.split('.');
    draft.sources[+i][k] = el.value;
  });
}

function problems() {
  const p = [];
  if (!draft.question.trim()) p.push('Add the question students will answer.');
  draft.sources.forEach((s, i) => {
    const n = `Source ${i + 1}`;
    if (!s.title.trim()) p.push(`${n} needs a title.`);
    if (s.type === 'excerpt' && !s.excerpt.trim()) p.push(`${n} needs the excerpt text.`);
    if (['pdf', 'image', 'doc'].includes(s.type) && !s.file) p.push(`${n} needs an uploaded file.`);
    if (s.type === 'link' && !s.url.trim()) p.push(`${n} needs a link.`);
    if (s.type !== 'link' && !s.citation.trim()) p.push(`${n} needs a citation.`);
    if (s.type === 'image' && !s.alt.trim()) p.push(`${n} needs an image description.`);
  });
  return p;
}

async function onSave(e) {
  e.preventDefault();
  readForm();
  if (!draft.title.trim()) draft.title = draft.question.slice(0, 60);
  const p = problems();
  const msg = $('#savemsg');
  if (p.length) { msg.textContent = p[0] + (p.length > 1 ? ` (${p.length - 1} more to fix)` : ''); toast(p[0], true); return; }
  msg.textContent = 'Saving...';
  try {
    const r = await api('/api/teacher/prompts', { method: 'POST', body: draft });
    const isNew = !draft.id;
    draft = { ...r.prompt, sources: r.prompt.sources.map((s) => ({ ...blankSource(), ...s })) };
    lastSaved = JSON.stringify(draft);
    toast(isNew ? 'Saved. Your student link is ready.' : 'Saved.');
    renderBuilder();
  } catch (err) { msg.textContent = err.message; toast(err.message, true); }
}

async function onUpload(input) {
  const i = +input.dataset.upload;
  const file = input.files?.[0];
  if (!file) return;
  readForm();
  const msg = document.getElementById(`s${i}_upmsg`);
  msg.textContent = 'Uploading...';
  const form = new FormData(); form.append('file', file);
  try {
    const r = await api('/api/teacher/upload', { method: 'POST', form });
    draft.sources[i].file = r.file;
    if (!draft.sources[i].title) draft.sources[i].title = file.name.replace(/\.[^.]+$/, '');
    renderBuilder();
    toast('File uploaded. Save the CER to keep it.');
  } catch (err) { msg.textContent = err.message; }
}

async function openForEdit(id) {
  try {
    const { prompt } = await api(`/api/teacher/prompts/${encodeURIComponent(id)}`);
    draft = { ...blankDraft(), ...prompt, sources: (prompt.sources.length ? prompt.sources : [blankSource()]).map((s) => ({ ...blankSource(), ...s })) };
    lastSaved = JSON.stringify(draft);
    location.hash = '#/build';
  } catch (e) { toast(e.message, true); }
}

function unsaved() { if (!draft || !$('#cerForm')) return false; readForm(); return JSON.stringify(draft) !== lastSaved; }

// ---------------------------------------------------------------- teachers (admin)
async function renderTeachers() {
  paintChrome('teachers');
  main().innerHTML = `<div class="wrap"><p class="muted">Loading...</p></div>`;
  let teachers = [];
  try { ({ teachers } = await api('/api/admin/teachers')); } catch (e) { toast(e.message, true); }
  pendingCount = teachers.filter((t) => t.status === 'pending').length;
  paintChrome('teachers');
  const row = (t) => `<div class="item"><div class="info">
      <h3>${esc(t.name || t.email)} <span class="pill ${esc(t.role === 'admin' ? 'admin' : t.status)}">${esc(t.role === 'admin' ? 'admin' : t.status)}</span></h3>
      <div class="small muted">${esc(t.email)}${t.school ? ` · ${esc(t.school)}` : ''}${t.requested_at ? ` · asked ${esc(new Date(t.requested_at).toLocaleDateString())}` : ''}</div>
      ${t.note ? `<div class="small">${esc(t.note)}</div>` : ''}</div>
      <div class="actions">${t.role === 'admin' ? '' : t.status === 'approved'
        ? `<button class="btn quiet small" type="button" data-act="decide" data-email="${esc(t.email)}" data-do="remove">Remove Access</button>`
        : `<button class="btn small" type="button" data-act="decide" data-email="${esc(t.email)}" data-do="approve">Approve</button>
           ${t.status !== 'declined' ? `<button class="btn quiet small" type="button" data-act="decide" data-email="${esc(t.email)}" data-do="decline">Decline</button>` : ''}`}</div></div>`;
  const pend = teachers.filter((t) => t.status === 'pending');
  const appr = teachers.filter((t) => t.status === 'approved');
  const other = teachers.filter((t) => !['pending', 'approved'].includes(t.status));
  main().innerHTML = `<div class="wrap stack">
    <h1>Teachers</h1>
    <h2>Waiting for Approval</h2>${pend.length ? `<div class="list">${pend.map(row).join('')}</div>` : '<p class="muted">No one is waiting.</p>'}
    <h2>Approved</h2><div class="list">${appr.map(row).join('')}</div>
    ${other.length ? `<h2>Signed In, No Access</h2><div class="list">${other.map(row).join('')}</div>` : ''}
  </div>`;
  focusMain();
}

// ---------------------------------------------------------------- events
document.addEventListener('submit', (e) => {
  if (e.target.id === 'codeForm') onCodeSubmit(e);
  if (e.target.id === 'reqForm') onRequestSubmit(e);
  if (e.target.id === 'cerForm') onSave(e);
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.upload) onUpload(t);
  if (t.dataset.s && t.dataset.s.endsWith('.type')) { readForm(); renderBuilder(); }
});
document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'logout') { await api('/api/auth/logout', { method: 'POST' }).catch(() => {}); me = { signedIn: false }; draft = null; location.hash = ''; route(); }
  if (act === 'new') { draft = blankDraft(); lastSaved = JSON.stringify(draft); location.hash = '#/build'; if (location.hash === '#/build') renderBuilder(); }
  if (act === 'edit') openForEdit(b.dataset.id);
  if (act === 'copy') {
    const link = studentLink(b.dataset.id);
    try { await navigator.clipboard.writeText(link); toast('Student link copied.'); } catch { prompt('Copy this link:', link); }
  }
  if (act === 'delete') {
    if (!confirm(`Delete "${b.dataset.title}"? Students using its link will see an error. This cannot be undone.`)) return;
    try { await api(`/api/teacher/prompts/${encodeURIComponent(b.dataset.id)}`, { method: 'DELETE' }); toast('Deleted.'); if (draft?.id === b.dataset.id) draft = null; renderMine(); }
    catch (err) { toast(err.message, true); }
  }
  if (act === 'addsrc') { readForm(); draft.sources.push(blankSource()); renderBuilder(); }
  if (act === 'delsrc') { readForm(); draft.sources.splice(+b.dataset.i, 1); if (!draft.sources.length) draft.sources.push(blankSource()); renderBuilder(); }
  if (act === 'upsrc') { readForm(); const i = +b.dataset.i; [draft.sources[i - 1], draft.sources[i]] = [draft.sources[i], draft.sources[i - 1]]; renderBuilder(); }
  if (act === 'cancel') { if (unsaved() && !confirm('Leave without saving your changes?')) return; draft = null; location.hash = '#/mine'; }
  if (act === 'decide') {
    try { await api('/api/admin/teachers', { method: 'POST', body: { email: b.dataset.email, action: b.dataset.do } }); toast('Updated.'); renderTeachers(); }
    catch (err) { toast(err.message, true); }
  }
});
window.addEventListener('beforeunload', (e) => { if (unsaved()) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('hashchange', route);

(async function start() {
  try { config = await api('/api/config'); } catch { /* keep defaults */ }
  await refreshMe();
  route();
})();
