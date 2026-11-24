import { STATIONS, F, LEVELS, VERSIONS, STEPS, EXAMPLE, TASK_WORDS, HELP_WORDS, MOVES, SELF_QUESTION, needsCounter, evidenceNeeded } from './content.js';
import { RULES } from './rules.js';
import { blankWork, blankRow, loadWork, saveWork, clearWork, loadLevels, saveLevels, loadLast, saveLast } from './store.js';

// ---------------------------------------------------------------- state
let prompt = null;      // the loaded prompt file
let work = null;        // this student's work on it
let levels = loadLevels();
let sourceTab = 0;
let pending = null;     // snapshot of flagged answers, so a second Next keeps them
let selfShown = false;  // Prompted level: self-question shown before the Coach's
let revealed = {};      // starters / questions opened this visit

const $ = (s, el = document) => el.querySelector(s);
const main = () => $('#main');
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function getPath(path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), work); }
function setPath(path, v) {
  const ks = path.split('.'); let o = work;
  ks.slice(0, -1).forEach((k) => { if (o[k] == null) o[k] = {}; o = o[k]; });
  o[ks.at(-1)] = v;
}
const save = () => work && saveWork(work);
const lvl = (move) => (move ? levels[move].level : 2);
const ctxBase = () => ({ question: prompt?.question || '' });

// ---------------------------------------------------------------- prompts
async function getJSON(url) { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(url); return r.json(); }

async function loadPrompt(id) {
  if (id === 'open') {
    prompt = { id: 'open', title: 'Your Own Question', question: '', version: 'Full', sources: [], wordBank: [] };
  } else {
    // Built-in practice prompts are static files; teacher-built CERs come from the API.
    prompt = await getJSON(`/prompts/${encodeURIComponent(id)}.json`)
      .catch(() => getJSON(`/api/prompts/${encodeURIComponent(id)}`));
    if (!Array.isArray(prompt.sources)) prompt.sources = [];
  }
  work = loadWork(prompt.id) || blankWork(prompt.id, prompt.version || 'Full');
  if (prompt.id === 'open') {
    work.custom = work.custom || { question: '', sources: [] };
    prompt.question = work.custom.question;
    prompt.sources = work.custom.sources;
  }
  saveLast(prompt.id);
  sourceTab = 0;
}

function promptIdFromURL() {
  const p = new URLSearchParams(location.search);
  return p.get('q');
}

// ---------------------------------------------------------------- router
async function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [page, arg] = hash.split('/');
  pending = null; selfShown = false; revealed = {};
  try {
    if (!prompt) {
      const id = promptIdFromURL() || loadLast();
      if (id) await loadPrompt(id).catch(() => { prompt = null; });
    }
  } catch { prompt = null; }

  if (page === 'steps') return renderSteps();
  if (page === 's' && prompt) {
    const n = Math.min(8, Math.max(1, parseInt(arg, 10) || 1));
    return n === 1 ? renderStart() : renderStation(n);
  }
  return renderStart();
}

function go(n) { location.hash = `#/s/${n}`; }

// ---------------------------------------------------------------- chrome
function paintChrome(current) {
  $('#topq').innerHTML = prompt && prompt.question ? `<b>Question:</b> ${esc(prompt.question)}` : '';
  const nav = $('#stations');
  if (!prompt || !current) { nav.hidden = true; return; }
  nav.hidden = false;
  nav.innerHTML = STATIONS.map((s) => {
    const done = work.done[s.n];
    const reach = s.n === 1 || done || work.done[s.n - 1] || s.n <= current;
    const cls = done ? 'done' : '';
    const inner = `<span class="bar"></span><span class="lbl">${s.n} ${esc(s.name)}${done ? ' ✓' : ''}</span>`;
    if (s.n === current) return `<a href="#/s/${s.n}" class="${cls}" aria-current="step" aria-label="Station ${s.n}, ${esc(s.name)}, current">${inner}</a>`;
    return reach ? `<a href="#/s/${s.n}" class="${cls}" aria-label="Station ${s.n}, ${esc(s.name)}${done ? ', done' : ''}">${inner}</a>`
      : `<span aria-label="Station ${s.n}, ${esc(s.name)}, locked">${inner}</span>`;
  }).join('');
}

function focusMain() { const m = main(); m.focus({ preventScroll: true }); window.scrollTo(0, 0); }

// ---------------------------------------------------------------- start (station 1)
async function renderStart() {
  paintChrome(prompt ? 1 : 0);
  let list = [];
  try { list = await getJSON('prompts/index.json'); } catch { list = []; }

  const levelsHTML = Object.keys(MOVES).map((m) => {
    const L = levels[m].level;
    return `<div class="lvlrow"><b>${MOVES[m]}</b><div><div class="pips" aria-hidden="true">${[1, 2, 3, 4].map((i) => `<span class="${i <= L ? 'on' : ''}"></span>`).join('')}</div><div class="small muted">${LEVELS[L - 1]}</div></div></div>`;
  }).join('') + `<p class="small muted" style="margin-top:4px">Model » Guided » Prompted » Solo</p>`;

  const picker = `<div class="card"><h2>Pick a Question</h2>
    <p class="muted small">Your teacher may have sent you a link that opens the right one.</p>
    <div class="prompts">${list.map((p) => `<a href="?q=${encodeURIComponent(p.id)}#/s/1"><b>${esc(p.title)}</b><br><span class="muted small">${esc(p.unit || '')}</span></a>`).join('')}
    <a href="?q=open#/s/1"><b>Use My Own Question</b><br><span class="muted small">Type any question and add your own sources.</span></a></div></div>`;

  if (!prompt) {
    main().innerHTML = `<div class="wrap"><div class="grid2"><div class="work">
      <div class="card"><h1>CER Coach</h1><p>Build a Claim, Evidence and Reasoning answer one step at a time. The Coach asks questions and pushes back when an answer needs more. As you get stronger, it gives you less help.</p></div>
      ${picker}</div><div class="side"><div class="card"><h2>Your Support Levels</h2><p class="muted small">These change as you show you can do each part on your own.</p><div class="levels">${levelsHTML}</div></div></div></div></div>`;
    return focusMain();
  }

  const isOpen = prompt.id === 'open';
  const openForm = isOpen ? `<div class="card stack"><h2>Your Question and Sources</h2>
      <div class="field"><label for="oq">The question you are answering</label><textarea id="oq" class="short" data-open="question">${esc(work.custom.question)}</textarea></div>
      <div class="stack" id="osrc">${work.custom.sources.map((s, i) => customSourceRow(s, i)).join('')}</div>
      <div class="row"><button class="btn quiet small" type="button" data-act="addsrc">Add a Source</button></div></div>` : '';

  const versionHTML = `<fieldset class="card"><legend class="kicker">VERSION</legend>
      <p class="small muted">Use the version your teacher gave you. Full and Deep require a counterpoint.</p>
      <div class="choice">${VERSIONS.map((v) => `<label><input type="radio" name="ver" value="${v}" ${work.version === v ? 'checked' : ''}>${v}</label>`).join('')}</div></fieldset>`;

  const warm = `<div class="card"><h2>Warm-Up: The Six Steps From Memory</h2>
      <p class="muted small">Type the steps you remember. Then check yourself.</p>
      <div class="warm" id="warm">${[1, 2, 3, 4, 5, 6].map((i) => `<label for="w${i}"><span>${i}</span><input type="text" id="w${i}" autocomplete="off"></label>`).join('')}</div>
      <div class="row" style="margin-top:12px"><button class="btn ghost" type="button" data-act="warmcheck">Check Me</button><span id="warmout" class="small" aria-live="polite"></span></div></div>`;

  main().innerHTML = `<div class="wrap"><div class="grid2"><div class="work">
    <div class="card"><div class="kicker">${esc(prompt.unit || 'QUESTION')}</div><h1 style="margin-top:6px">${esc(prompt.question || 'Type your question below.')}</h1>
      <p class="muted small">${prompt.sources.length} source${prompt.sources.length === 1 ? '' : 's'} · Plan here or on paper · Your finished CER is written on paper</p></div>
    ${openForm}${versionHTML}${warm}
    <div class="row"><button class="btn" type="button" data-act="begin">Start at Station 2</button>
      <a href="./#/">Pick a different question</a><span class="spacer"></span>
      <button class="btn quiet small" type="button" data-act="reset">Start Over</button></div>
  </div><div class="side">
    <div class="card"><h2>Your Support Levels</h2><p class="muted small">These change as you show you can do each part on your own.</p><div class="levels">${levelsHTML}</div></div>
    ${sourceList()}
  </div></div></div>`;
  focusMain();
}

function customSourceRow(s, i) {
  return `<div class="logrow"><div class="head"><span class="num">Source ${i + 1}</span><span class="spacer"></span><button class="btn quiet small" type="button" data-act="delsrc" data-i="${i}">Remove</button></div>
    <div class="cols"><div class="field"><label for="st${i}">Title</label><input type="text" id="st${i}" data-src="${i}.title" value="${esc(s.title)}"></div>
    <div class="field"><label for="su${i}">Link (optional)</label><input type="url" id="su${i}" data-src="${i}.url" value="${esc(s.url)}"></div>
    <div class="field wide"><label for="se${i}">Key words or quote you will use</label><textarea id="se${i}" class="short" data-src="${i}.excerpt">${esc(s.excerpt)}</textarea></div>
    <div class="field wide"><label for="sc${i}">Citation: who made it, and when?</label><input type="text" id="sc${i}" data-src="${i}.citation" value="${esc(s.citation)}"></div></div></div>`;
}

function sourceList() {
  if (!prompt.sources.length) return '';
  return `<div class="card"><h2>Sources for This Question</h2><div class="stack" style="margin-top:10px">${prompt.sources.map((s, i) =>
    `<div class="row small"><span class="kicker" style="width:64px">${esc((s.type || 'link').toUpperCase())}</span><span>${i + 1}. ${esc(s.title || 'Source')}</span></div>`).join('')}</div></div>`;
}

// ---------------------------------------------------------------- field rendering
function field(key, path, move, opts = {}) {
  const f = F[key];
  const L = lvl(move);
  const id = 'f_' + path.replace(/\./g, '_');
  const val = getPath(path) || '';
  const showQ = L <= 2 || revealed['q:' + path];
  const label = opts.label || (showQ ? f.q : f.short);
  const starter = opts.starter ?? f.starter;
  let extra = '';
  if (starter && L === 1) extra = `<div class="starter">Start like this: ${esc(starter)}</div>`;
  else if (starter && L === 2) extra = revealed['s:' + path]
    ? `<div class="starter">Start like this: ${esc(starter)}</div>`
    : `<div><button class="btn quiet small" type="button" data-act="stuck" data-path="${path}" data-move="${move}">Stuck? See a Starter</button></div>`;
  else if (L >= 3 && !showQ) extra = `<div><button class="btn quiet small" type="button" data-act="showq" data-path="${path}" data-move="${move}">Show the Question</button></div>`;
  const tag = f.rows <= 1
    ? `<input type="text" id="${id}" data-bind="${path}" value="${esc(val)}" ${L === 1 && starter ? `placeholder="${esc(starter)}..."` : ''}>`
    : `<textarea id="${id}" data-bind="${path}" rows="${f.rows}" ${f.rows <= 2 ? 'class="short"' : ''} ${L === 1 && starter ? `placeholder="${esc(starter)}..."` : ''}>${esc(val)}</textarea>`;
  return `<div class="field" data-field="${path}"><label for="${id}">${esc(label)}${opts.note ? ` <span class="hint">${esc(opts.note)}</span>` : ''}</label>${extra}${tag}<div class="pushslot" id="push_${id}" aria-live="polite"></div></div>`;
}

function exampleBox(move, html) {
  const L = lvl(move);
  if (L === 1) return `<div class="example"><span class="kicker">EXAMPLE, DIFFERENT QUESTION: ${esc(EXAMPLE.question.toUpperCase())}</span>${html}</div>`;
  if (L === 2) return `<details class="example"><summary><b>See an Example (Different Question)</b></summary><p class="muted small">${esc(EXAMPLE.question)}</p>${html}</details>`;
  return '';
}
const bank = (label, ws) => `<div class="bank"><b>${esc(label)}:</b>${ws.map(esc).join(' · ')}</div>`;

// ---------------------------------------------------------------- stations
function renderStation(n) {
  const st = STATIONS[n - 1];
  paintChrome(n);
  if (n === 8) return renderCheck();
  const L = lvl(st.move);
  const levelTag = st.move ? `<span class="small muted"><b>${MOVES[st.move]}</b> · Your level: ${LEVELS[L - 1]}</span>` : '';
  let body = '';

  if (st.id === 'unpack') {
    body = field('task', 'unpack.task', 'claim') + (L === 1 ? bank('Task words', TASK_WORDS) : '') +
      field('words', 'unpack.words', 'claim') + field('own', 'unpack.own', 'claim') +
      exampleBox('claim', `<p>${esc(EXAMPLE.own)}</p>`);
  }

  if (st.id === 'gather') {
    const need = evidenceNeeded(work.version);
    body = `<p class="small muted">Log every piece that might help, at least ${need + 1}. Rate how directly it answers the question: 3 proves it, 2 helps, 1 barely.</p>` +
      exampleBox('evidence', `<p><b>Says:</b> ${esc(EXAMPLE.log.says)}<br><b>Who and when:</b> ${esc(EXAMPLE.log.who)}<br><b>Where:</b> ${esc(EXAMPLE.log.where)}<br><b>Shows:</b> ${esc(EXAMPLE.log.shows)}<br><b>Strength:</b> 3</p>`) +
      `<div class="log">${work.log.map((r, i) => logRow(i)).join('')}</div>
      <div class="row"><button class="btn quiet small" type="button" data-act="addrow">Add a Row</button></div><div class="pushslot" id="push_logcount" aria-live="polite"></div>`;
  }

  if (st.id === 'claim') {
    body = field('first', 'claim.first', 'claim') + (L === 1 ? bank('Helpful words', HELP_WORDS) : '') +
      exampleBox('claim', `<p>${esc(EXAMPLE.first)}</p>`) +
      `<fieldset class="field" data-field="claim.tests"><legend class="q" style="font-weight:800">Test your claim. Check each box that is true.</legend><div class="checks">
        ${chk('claim.tests.answers', 'It answers the question at the top.')}${chk('claim.tests.disagree', 'Someone could disagree with it.')}${chk('claim.tests.provable', 'Evidence from my log can prove it.')}
      </div><div class="pushslot" id="push_tests" aria-live="polite"></div></fieldset>`;
  }

  if (st.id === 'choose') {
    const need = evidenceNeeded(work.version);
    const rows = work.log.map((r, i) => ({ r, i })).filter(({ r }) => r.says.trim());
    body = `<p class="small muted">Your claim: <b>${esc(work.claim.first || '(not written yet)')}</b></p>
      <p>Choose the <b>${need}</b> that prove your claim best, strongest first.</p>
      <div class="pick">${rows.map(({ r, i }) => {
        const rank = work.chosen.indexOf(i);
        return `<label><input type="checkbox" data-act="pick" data-i="${i}" ${rank > -1 ? 'checked' : ''}><span>${esc(r.says)}<br><span class="small muted">${esc(r.who)}${r.strength ? ` · strength ${esc(r.strength)}` : ''}</span></span>${rank > -1 ? `<span class="rankno">#${rank + 1}</span>` : ''}</label>`;
      }).join('') || '<p class="muted">Log some evidence at Station 3 first.</p>'}</div>
      <div class="pushslot" id="push_choose" aria-live="polite"></div>`;
  }

  if (st.id === 'reason') {
    body = `<p class="small muted">Your claim: <b>${esc(work.claim.first || '(not written yet)')}</b></p>` +
      exampleBox('reasoning', `<p><b>Shows:</b> ${esc(EXAMPLE.rshows)}<br><b>Proves:</b> ${esc(EXAMPLE.proves)}<br><b>Connects:</b> ${esc(EXAMPLE.connects)}</p>`) +
      (work.chosen.length ? work.chosen.map((i, k) => {
        const r = work.log[i];
        return `<div class="rung"><h3>Evidence ${k + 1}</h3><div class="ev">${esc(r.says)} <span class="muted small">(${esc(r.who)}${r.where ? ', ' + esc(r.where) : ''})</span></div>
          ${field('rshows', `reasoning.${i}.shows`, 'reasoning')}${field('proves', `reasoning.${i}.proves`, 'reasoning')}${field('connects', `reasoning.${i}.connects`, 'reasoning')}</div>`;
      }).join('') : '<p class="muted">Choose your evidence at Station 5 first.</p>') +
      (prompt.wordBank?.length && L <= 2 ? bank('Ideas from class', prompt.wordBank) : '');
  }

  if (st.id === 'stress') {
    const req = needsCounter(work.version);
    body = `<p class="small muted">Your first claim: <b>${esc(work.claim.first || '(not written yet)')}</b></p>` +
      field('counter', 'stress.counter', 'claim', { note: req ? '' : '(optional challenge)' }) +
      field('answer', 'stress.answer', 'claim', { note: req ? '' : '(optional challenge)' }) +
      exampleBox('claim', `<p>${esc(EXAMPLE.counter)}<br>${esc(EXAMPLE.answer)}</p>`) +
      field('final', 'stress.final', 'claim');
  }

  main().innerHTML = `<div class="wrap"><div class="grid2"><div class="work">
      <div class="row"><h1>${esc(st.title)}</h1>${levelTag}</div>
      <div class="card stack">${body}</div>
      <div class="pushslot" id="push_self" aria-live="polite"></div>
      <div class="row"><a href="#/s/${n - 1}">Back</a><span class="spacer"></span><button class="btn" type="button" data-act="next" data-n="${n}">${n === 7 ? 'Go to Check' : 'Next'}</button></div>
    </div><div class="side">${viewer()}${askYourself(n)}</div></div></div>`;
  focusMain();
}

const chk = (path, text) => `<label><input type="checkbox" data-bind="${path}" ${getPath(path) ? 'checked' : ''}>${esc(text)}</label>`;

function logRow(i) {
  const r = work.log[i];
  const L = lvl('evidence');
  const lab = (k) => (L <= 2 ? F[k].q : F[k].short);
  const inp = (k, wide) => {
    const id = `f_log_${i}_${k}`;
    const multi = F[k].rows > 1;
    return `<div class="field ${wide ? 'wide' : ''}" data-field="log.${i}"><label for="${id}">${esc(lab(k))}</label>${multi
      ? `<textarea id="${id}" class="short" data-bind="log.${i}.${k}">${esc(r[k])}</textarea>`
      : `<input type="text" id="${id}" data-bind="log.${i}.${k}" value="${esc(r[k])}">`}</div>`;
  };
  return `<div class="logrow"><div class="head"><span class="num">${i + 1}</span>
    <fieldset class="strength"><legend class="small">Strength</legend>${[1, 2, 3].map((s) => `<label><input type="radio" name="str${i}" data-bind="log.${i}.strength" value="${s}" ${String(r.strength) === String(s) ? 'checked' : ''}>${s}</label>`).join('')}</fieldset>
    <span class="spacer"></span>${work.log.length > 1 ? `<button class="btn quiet small" type="button" data-act="delrow" data-i="${i}" aria-label="Remove row ${i + 1}">Remove</button>` : ''}</div>
    <div class="cols">${inp('says', true)}${inp('who')}${inp('where')}${inp('shows', true)}</div>
    <div class="pushslot" id="push_log_${i}" aria-live="polite"></div></div>`;
}

function askYourself(n) {
  const map = { 2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5 };
  const s = STEPS[map[n]];
  if (!s) return '';
  return `<div class="card askself"><b>Step ${map[n] + 1}: ${esc(s.t)}</b><ul>${s.qs.map((q) => `<li>${esc(q)}</li>`).join('')}</ul></div>`;
}

// ---------------------------------------------------------------- source viewer
function viewer() {
  const srcs = prompt.sources || [];
  if (!srcs.length) return `<div class="card"><h2>Sources</h2><p class="muted small">No sources are attached to this question. Use your class readings and notes.</p></div>`;
  if (sourceTab >= srcs.length) sourceTab = 0;
  const s = srcs[sourceTab];
  const tabs = srcs.map((x, i) => `<button type="button" role="tab" aria-selected="${i === sourceTab}" data-act="tab" data-i="${i}">${i + 1} ${esc(labelType(x.type))}</button>`).join('');
  let content = '';
  const t = s.type || 'link';
  if (t === 'excerpt' || t === 'link') content = s.excerpt ? `<blockquote>${esc(s.excerpt)}</blockquote>` : '';
  if (t === 'pdf') content = `<iframe src="${esc(s.file)}" title="${esc(s.title || 'PDF source')}"></iframe>`;
  if (t === 'image') content = `<img src="${esc(s.file)}" alt="${esc(s.alt || s.title || '')}">`;
  if (t === 'doc') content = `${s.excerpt ? `<blockquote>${esc(s.excerpt)}</blockquote>` : ''}<p><a href="${esc(s.file)}" download>Download the document</a></p>`;
  const open = s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">Open the full original</a>` : '';
  return `<section class="card viewer" aria-label="Source viewer"><div class="tabs" role="tablist">${tabs}</div>
    <div class="body"><div class="kicker">SOURCE ${sourceTab + 1} · ${esc(labelType(t).toUpperCase())}</div><h3>${esc(s.title || '')}</h3>
    ${s.note ? `<p class="small muted">${esc(s.note)}</p>` : ''}${content}
    ${s.citation ? `<div class="cite"><b>Citation:</b> ${esc(s.citation)}</div>` : ''}${open}
    <div class="askself"><b>Ask yourself</b><ul><li>Who made this source, and when?</li><li>Who is not speaking in this source?</li></ul></div></div></section>`;
}
const labelType = (t) => ({ excerpt: 'Excerpt', pdf: 'PDF', image: 'Image', doc: 'Doc', link: 'Link' }[t] || 'Source');

// ---------------------------------------------------------------- checks per station
function flagsFor(n) {
  const out = [];
  const add = (slot, res, move) => res && out.push({ slot, move, ...res });
  const ctx = ctxBase();
  if (n === 2) {
    add('f_unpack_task', RULES.task(work.unpack.task), 'claim');
    add('f_unpack_own', RULES.own(work.unpack.own, ctx), 'claim');
  }
  if (n === 3) {
    work.log.forEach((r, i) => add(`log_${i}`, RULES.logRow(r), 'evidence'));
    add('logcount', RULES.logCount(work.log, evidenceNeeded(work.version)), 'evidence');
  }
  if (n === 4) {
    add('f_claim_first', RULES.claim(work.claim.first, ctx), 'claim');
    add('tests', RULES.claimTests(work.claim.tests), 'claim');
  }
  if (n === 5) add('choose', RULES.choose(work.chosen, work.log, evidenceNeeded(work.version)), 'evidence');
  if (n === 6) {
    work.chosen.forEach((i) => {
      const r = work.reasoning[i] || {};
      add(`f_reasoning_${i}_shows`, RULES.rshows(r.shows || ''), 'reasoning');
      add(`f_reasoning_${i}_proves`, RULES.proves(r.proves || '', { says: work.log[i]?.says }), 'reasoning');
      add(`f_reasoning_${i}_connects`, RULES.connects(r.connects || ''), 'reasoning');
    });
  }
  if (n === 7) {
    const required = needsCounter(work.version);
    add('f_stress_counter', RULES.counter(work.stress.counter, { required }), 'claim');
    add('f_stress_answer', RULES.answer(work.stress.answer, { required, counter: work.stress.counter.trim() }), 'claim');
    add('f_stress_final', RULES.final(work.stress.final, ctx), 'claim');
  }
  return out;
}

function snapshot(n) { return JSON.stringify([n, work.unpack, work.log, work.claim, work.chosen, work.reasoning, work.stress]); }

function onNext(n) {
  document.querySelectorAll('.pushslot').forEach((el) => { el.innerHTML = ''; });
  document.querySelectorAll('.flagged').forEach((el) => el.classList.remove('flagged'));
  const st = STATIONS[n - 1];
  const L = lvl(st.move);
  // Solo: no inline push-back; the Check station runs the checks.
  const flags = L >= 4 ? [] : flagsFor(n);
  if (flags.length) {
    const snap = snapshot(n);
    if (pending === snap) { proceed(n); return; }      // second Next with nothing changed: keep going
    if (L === 3 && !selfShown) {                       // Prompted: ask the student first
      selfShown = true;
      $('#push_self').innerHTML = `<div class="push self"><span class="mark">?</span><div><b>${esc(SELF_QUESTION)}</b>
        <span class="small">Fix anything you notice, then press Next. Or <button class="btn quiet small" type="button" data-act="coachq" data-n="${n}">Show the Coach's Question</button></span></div></div>`;
      pending = null;
      return;
    }
    showFlags(flags);
    pending = snap;
    $('#push_self').innerHTML = `<p class="small muted">Fix what the Coach asked about, or press Next again to keep your answers as they are.</p>`;
    return;
  }
  proceed(n);
}

function showFlags(flags) {
  flags.forEach((f, k) => {
    const slot = document.getElementById(`push_${f.slot}`) || $('#push_self');
    slot.insertAdjacentHTML('beforeend', `<div class="push" role="status"><span class="mark">?</span><div><b>${esc(f.title)}</b>${f.nudge ? `<span class="small">${esc(f.nudge)}</span>` : ''}</div></div>`);
    slot.closest('.field')?.classList.add('flagged');
    if (k === 0) slot.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

function proceed(n) {
  work.done[n] = true; save();
  go(n + 1);
}

// ---------------------------------------------------------------- check (station 8)
function coachResults() {
  const req = needsCounter(work.version);
  const need = evidenceNeeded(work.version);
  const ctx = ctxBase();
  const claimRes = RULES.claim(work.stress.final || work.claim.first, ctx);
  const evRows = work.chosen.map((i) => work.log[i]).filter(Boolean);
  const evRes = evRows.length < need ? { title: `Use ${need} pieces of evidence.`, nudge: '' }
    : evRows.map((r) => RULES.logRow(r)).find(Boolean) || null;
  const reRes = work.chosen.map((i) => RULES.proves((work.reasoning[i] || {}).proves || '', { says: work.log[i]?.says })).find(Boolean) || null;
  const out = [
    { key: 'claim', name: 'Claim', res: claimRes },
    { key: 'evidence', name: 'Evidence', res: evRes },
    { key: 'reasoning', name: 'Reasoning', res: reRes },
  ];
  if (req) out.push({ key: 'counter', name: 'Counterpoint', res: RULES.counter(work.stress.counter, { required: true }) || RULES.answer(work.stress.answer, { required: true }) });
  return out;
}

function planHTML() {
  const req = needsCounter(work.version);
  const rows = [['Claim', work.stress.final || work.claim.first]];
  work.chosen.forEach((i, k) => {
    const r = work.log[i]; const z = work.reasoning[i] || {};
    rows.push([`Evidence ${k + 1}`, `${r.says} (${r.who}${r.where ? ', ' + r.where : ''})\n» ${z.shows || ''}\n» ${z.proves || ''}${z.connects ? '\n» Connects to: ' + z.connects : ''}`]);
  });
  if (req || work.stress.counter.trim()) rows.push(['Counterpoint', `${work.stress.counter}\n» ${work.stress.answer}`]);
  rows.push(['Return', 'Come back to your claim in your last sentence.']);
  return rows.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b || '(empty)')}</dd>`).join('');
}

function renderCheck() {
  const req = needsCounter(work.version);
  const parts = [['claim', 'Claim'], ['evidence', 'Evidence'], ['reasoning', 'Reasoning']].concat(req ? [['counter', 'Counterpoint']] : []);
  const allScored = parts.every(([k]) => work.check.self[k]);
  const goal = req ? 'Aim for 9 to 12 sentences.' : 'Aim for 6 to 8 sentences.';
  const scoreRows = parts.map(([k, name]) => `<div class="score" role="group" aria-label="${name} score"><b>${name}</b>${[1, 2, 3, 4].map((p) =>
    `<button type="button" class="pt" data-act="score" data-k="${k}" data-p="${p}" aria-pressed="${work.check.self[k] === p}">${p}</button>`).join('')}</div>`).join('');

  let compare = `<div class="card dashed"><h2>Step 2: Compare With the Coach</h2><p class="muted small">Unlocks after you score every part.</p></div>`;
  if (work.check.revealed) {
    const res = coachResults();
    compare = `<div class="card"><h2>Step 2: Compare With the Coach</h2><table class="compare"><thead><tr><th>Part</th><th>You</th><th>Coach</th></tr></thead><tbody>
      ${res.map((r) => `<tr><td><b>${r.name}</b></td><td>${work.check.self[r.key] || '-'}</td><td>${r.res ? `Needs a look: ${esc(r.res.title)}` : 'Looks solid'}</td></tr>`).join('')}
      </tbody></table><p class="small muted">When your score and the Coach disagree, reread that part out loud. Who is right?</p></div>`;
  } else if (allScored) {
    compare = `<div class="card"><h2>Step 2: Compare With the Coach</h2><button class="btn ghost" type="button" data-act="reveal">Show the Coach's Checks</button></div>`;
  }

  const finish = work.check.revealed ? `<div class="card stack"><h2>Step 3: Partner Read and Reflect</h2>
      <p class="small">Your partner reads your CER out loud, then asks: What question does your claim answer? Where did this evidence come from? Why does that prove your claim?${req ? ' Who would disagree, and what is your answer?' : ''}</p>
      <div class="field"><label for="c_fix">What is one thing you will fix before you turn it in?</label><input type="text" id="c_fix" data-bind="check.fix" value="${esc(work.check.fix)}"></div>
      <div class="field"><label for="c_hard">The hardest part was...</label><input type="text" id="c_hard" data-bind="check.hard" value="${esc(work.check.hard)}"></div>
      <div class="field"><label for="c_next">Next time I will...</label><input type="text" id="c_next" data-bind="check.next" value="${esc(work.check.next)}"></div>
      <div class="row"><button class="btn" type="button" data-act="finish" ${work.check.applied ? 'disabled' : ''}>${work.check.applied ? 'Levels Updated' : 'Finish and Update My Levels'}</button><span id="finishout" class="small" aria-live="polite">${work.check.applied ? esc(work.check.summary || '') : ''}</span></div></div>` : '';

  main().innerHTML = `<div class="wrap"><div class="grid2"><div class="work">
      <div class="row"><h1>Assemble and Check</h1></div>
      <div class="card stack"><h2>Your Plan, in Order</h2><p class="small muted">Write your CER on lined paper as full sentences. ${goal}</p>
        <dl class="planlist">${planHTML()}</dl>
        <div class="row"><button class="btn" type="button" data-act="print">Print My Plan</button><a href="#/s/7">Back to Stations</a></div></div>
    </div><div class="side">
      <div class="card stack"><h2>Step 1: Score Yourself First</h2><p class="muted small">4 Exemplary · 3 Proficient · 2 Progressing · 1 Beginning. The Coach's checks stay hidden until you score each part.</p>${scoreRows}</div>
      ${compare}${finish}
    </div></div></div>`;
  focusMain();
}

function applyLevels() {
  const res = coachResults();
  const msgs = [];
  ['claim', 'evidence', 'reasoning'].forEach((m) => {
    const r = res.find((x) => x.key === m);
    const self = work.check.self[m] || 0;
    const L = levels[m];
    if (!r.res && self >= 3 && work.stuck[m] < 2) {
      L.streak += 1;
      if (L.streak >= 2 && L.level < 4) { L.level += 1; L.streak = 0; msgs.push(`${MOVES[m]} moves to ${LEVELS[L.level - 1]}.`); }
    } else if (r.res) {
      L.streak = 0;
      if (L.level > 1 && self >= 3) { /* overrated: hold the level */ }
      else if (L.level > 1) { L.level -= 1; msgs.push(`${MOVES[m]} gets a little more support next time.`); }
    } else {
      L.streak = 0;
    }
  });
  saveLevels(levels);
  work.check.applied = true;
  work.check.summary = msgs.length ? msgs.join(' ') : 'Your levels stay the same. Keep going.';
  work.done[8] = true;
  save();
}

// ---------------------------------------------------------------- steps card + warm-up
function renderSteps() {
  paintChrome(0);
  main().innerHTML = `<div class="wrap"><div class="grid2"><div class="work"><div class="card steps"><h1>The Six Steps</h1>
    <p class="muted">Read the question. Find the evidence. Answer it. Prove it. Explain why. Check it.</p>
    <ol>${STEPS.map((s) => `<li><b>${esc(s.t)}</b><ul>${s.qs.map((q) => `<li>${esc(q)}</li>`).join('')}</ul></li>`).join('')}</ol></div></div>
    <div class="side"><div class="card"><h2>Where C, E and R Fit</h2><p><b>Claim</b> answers the question in one sentence someone could disagree with.</p>
    <p><b>Evidence</b> is facts, quotes or details from sources, with where they came from.</p><p><b>Reasoning</b> explains why the evidence proves the claim, using ideas from class.</p>
    <p><b>Counterpoint</b> names who would disagree and answers them.</p></div>
    <p><a href="${prompt ? '#/s/1' : '#/'}">Back</a></p></div></div></div>`;
  focusMain();
}

function warmCheck() {
  const ins = [...document.querySelectorAll('#warm input')];
  let right = 0;
  ins.forEach((inp, i) => {
    const ok = STEPS[i].key.test(inp.value);
    inp.parentElement.classList.toggle('right', ok);
    if (ok) right++;
  });
  const missed = STEPS.map((s, i) => (STEPS[i].key.test(ins[i].value) ? null : `${i + 1}. ${s.t}`)).filter(Boolean);
  $('#warmout').textContent = right === 6 ? 'All six. Nice.' : `${right} of 6. Check: ${missed.join(' ')}`;
}

// ---------------------------------------------------------------- print
function printPlan() {
  let el = $('#printPlan');
  if (!el) { el = document.createElement('div'); el.id = 'printPlan'; document.body.appendChild(el); }
  if (!work) { window.print(); return; }
  el.innerHTML = `<div class="nameline">Name <span></span> Period <span style="flex:0 0 .8in"></span></div>
    <h1>CER Coach: My Plan</h1><p><b>Question:</b> ${esc(prompt.question)}</p><dl>${planHTML()}</dl>`;
  window.print();
}

// ---------------------------------------------------------------- events
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.bind && work) {
    setPath(t.dataset.bind, t.type === 'checkbox' ? t.checked : t.value);
    save();
  }
  if (t.dataset.open && work) { work.custom.question = t.value; prompt.question = t.value; paintChrome(1); save(); }
  if (t.dataset.src && work) {
    const [i, k] = t.dataset.src.split('.');
    work.custom.sources[+i][k] = t.value; save();
  }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.name === 'ver' && work) { work.version = t.value; save(); }
  if (t.dataset.bind && t.type === 'radio') { setPath(t.dataset.bind, t.value); save(); }
  if (t.dataset.bind && t.type === 'checkbox') { setPath(t.dataset.bind, t.checked); save(); }
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'next') onNext(+b.dataset.n);
  if (act === 'coachq') { const n = +b.dataset.n; const fl = flagsFor(n); showFlags(fl); pending = snapshot(n); }
  if (act === 'begin') { work.done[1] = true; save(); go(2); }
  if (act === 'reset' && confirm('Start over on this question? Your answers for it will be erased.')) { clearWork(prompt.id); prompt = null; route(); }
  if (act === 'warmcheck') warmCheck();
  if (act === 'stuck' || act === 'showq') {
    revealed[(act === 'stuck' ? 's:' : 'q:') + b.dataset.path] = true;
    work.stuck[b.dataset.move] = (work.stuck[b.dataset.move] || 0) + 1; save();
    const n = +location.hash.split('/')[2];
    const keep = captureFocus(); renderStation(n); restoreFocus(keep);
  }
  if (act === 'tab') { sourceTab = +b.dataset.i; const v = $('.viewer'); if (v) v.outerHTML = viewer(); }
  if (act === 'addrow') { work.log.push(blankRow()); save(); renderStation(3); }
  if (act === 'delrow') { const i = +b.dataset.i; work.log.splice(i, 1); work.chosen = work.chosen.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)); save(); renderStation(3); }
  if (act === 'pick') {
    const i = +b.dataset.i;
    work.chosen = b.checked ? [...work.chosen, i] : work.chosen.filter((x) => x !== i);
    save(); renderStation(5);
  }
  if (act === 'addsrc') { work.custom.sources.push({ type: 'link', title: '', url: '', excerpt: '', citation: '' }); save(); renderStart(); }
  if (act === 'delsrc') { work.custom.sources.splice(+b.dataset.i, 1); save(); renderStart(); }
  if (act === 'score') { work.check.self[b.dataset.k] = +b.dataset.p; save(); renderCheck(); }
  if (act === 'reveal') { work.check.revealed = true; save(); renderCheck(); }
  if (act === 'finish') { applyLevels(); renderCheck(); }
  if (act === 'print') printPlan();
});
$('#printBtn').addEventListener('click', printPlan);

function captureFocus() { return document.activeElement?.id; }
function restoreFocus(id) { if (id) document.getElementById(id)?.focus(); }

window.addEventListener('hashchange', route);
route();
