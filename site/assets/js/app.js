// CER Coach student app: a start screen, then the six steps (Read, Find, Answer, Prove, Explain, Check).
import { STEPS, F, VERSIONS, EXAMPLE, TASK_WORDS, MOVES, SELF_QUESTION, needsCounter, evidenceNeeded, youtubeId, toSeconds } from './content.js';
import { RULES } from './rules.js';
import { blankWork, blankRow, loadWork, saveWork, clearWork, loadLevels, saveLevels, loadLast, saveLast, loadMeta, saveMeta } from './store.js';

// ---------------------------------------------------------------- state
let prompt = null;      // the loaded question
let work = null;        // this student's work on it
let levels = loadLevels();
let meta = loadMeta();  // seen the six-steps intro, CERs finished
let sourceTab = 0;
let pending = null;     // snapshot of answers already pushed back on; a second Next keeps them
let selfShown = false;  // Prompted level: the student is asked to self-question first
let stuck = false;      // this step's Stuck? help is open
let rung = 0;           // Explain: which piece of evidence is showing
let openRow = 0;        // Find: which evidence row is open

const $ = (s, el = document) => el.querySelector(s);
const main = () => $('#main');
const esc = (s = '') => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wide = () => window.matchMedia('(min-width: 761px)').matches;

function getPath(path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), work); }
function setPath(path, v) {
  const ks = path.split('.'); let o = work;
  ks.slice(0, -1).forEach((k) => { if (o[k] == null) o[k] = {}; o = o[k]; });
  o[ks.at(-1)] = v;
}
const save = () => work && saveWork(work);
const lvl = (move) => (move ? levels[move].level : 2);
const ctxBase = () => ({ question: prompt?.question || '' });

// ---------------------------------------------------------------- loading
async function getJSON(url) { const r = await fetch(url, { cache: 'no-cache' }); if (!r.ok) throw new Error(url); return r.json(); }

async function loadPrompt(id) {
  if (id === 'open') {
    prompt = { id: 'open', title: 'Your Own Question', question: '', version: 'Full', sources: [], wordBank: [] };
  } else {
    // Practice questions are static files; teacher-built CERs come from the API.
    prompt = await getJSON(`/prompts/${encodeURIComponent(id)}.json`)
      .catch(() => getJSON(`/api/prompts/${encodeURIComponent(id)}`));
    if (!Array.isArray(prompt.sources)) prompt.sources = [];
    if (!Array.isArray(prompt.wordBank)) prompt.wordBank = [];
  }
  work = loadWork(prompt.id) || blankWork(prompt.id, prompt.version || 'Full');
  if (!work.log.length) work.log.push(blankRow());
  if (prompt.id === 'open') {
    work.custom = work.custom || { question: '', sources: [] };
    prompt.question = work.custom.question;
    prompt.sources = work.custom.sources;
  }
  saveLast(prompt.id);
  sourceTab = 0;
}

// ---------------------------------------------------------------- router
// #/          pick a question     #/s/0   start screen for the question
// #/s/1..6    the six steps       #/steps the Steps Card
async function route() {
  const [page, arg] = location.hash.replace(/^#\/?/, '').split('/');
  pending = null; selfShown = false; stuck = false;
  const wanted = new URLSearchParams(location.search).get('q');
  try {
    if (!prompt || (wanted && wanted !== prompt.id)) {
      const id = wanted || loadLast();
      prompt = null;
      if (id) await loadPrompt(id).catch(() => { prompt = null; });
    }
  } catch { prompt = null; }

  if (page === 'steps') return renderStepsCard();
  if (!prompt) return renderHome();
  if (page !== 's') return renderStart();
  let n = Math.min(6, Math.max(0, parseInt(arg, 10) || 0));
  if (!isOpen(n)) { n = firstOpen(); history.replaceState(null, '', `${location.search}#/s/${n}`); }
  if (n !== 5) rung = 0;
  if (n === 0) return renderStart();
  return renderStep(n);
}

const go = (n) => { location.hash = `#/s/${n}`; };
// A step is open once the one before it is done. Step 0 is the start screen.
const isOpen = (n) => n === 0 || work.done[n] || work.done[n - 1];
function firstOpen() { for (let k = 0; k <= 6; k++) if (!work.done[k]) return k; return 6; }

// ---------------------------------------------------------------- chrome
function paintChrome(current) {
  $('#topq').innerHTML = prompt?.question && !current ? `<b>Question:</b> ${esc(prompt.question)}` : '';
  const nav = $('#stations');
  if (!prompt || !current) { nav.hidden = true; return; }
  nav.hidden = false;
  nav.innerHTML = STEPS.map((s) => {
    const done = work.done[s.n];
    const inner = `<span class="bar"></span><span class="lbl"><b>${s.n}</b> ${esc(s.short)}${done ? ' ✓' : ''}</span>`;
    const label = `Step ${s.n}, ${esc(s.short)}${done ? ', done' : ''}`;
    if (s.n === current) return `<a href="#/s/${s.n}" class="${done ? 'done' : ''}" aria-current="step" aria-label="${label}, current">${inner}</a>`;
    return isOpen(s.n) ? `<a href="#/s/${s.n}" class="${done ? 'done' : ''}" aria-label="${label}">${inner}</a>`
      : `<span aria-label="${label}, locked">${inner}</span>`;
  }).join('');
}

function focusMain() { main().focus({ preventScroll: true }); window.scrollTo(0, 0); }

// The question, and the student's claim once they have one, at the top of every step.
function questionCard(n) {
  const claim = n >= 6 ? (work.stress.final || work.claim.first) : work.claim.first;
  const showClaim = n >= 4 && claim.trim();
  return `<details class="qcard" ${wide() ? 'open' : ''}><summary><span class="kicker">THE QUESTION</span>
      <span class="qline">${esc(prompt.question)}</span></summary>
    <p class="qfull">${esc(prompt.question)}</p>
    ${showClaim ? `<p class="myclaim"><b>${n >= 6 && work.stress.final ? 'My final claim:' : 'My claim:'}</b> ${esc(claim)}</p>` : ''}</details>`;
}

// ---------------------------------------------------------------- home + start
async function renderHome() {
  paintChrome(0);
  let list = [];
  try { list = await getJSON('/prompts/index.json'); } catch { list = []; }
  main().innerHTML = `<div class="wrap narrowish stack">
    <div class="card"><h1>CER Coach</h1>
      <p>Build a strong answer to any question, one step at a time: a <b>Claim</b>, the <b>Evidence</b> that proves it, and your <b>Reasoning</b>.</p>
      <p class="small muted">Your teacher will usually give you a link. Or pick a practice question.</p></div>
    <div class="card"><h2>Practice Questions</h2><div class="prompts">
      ${list.map((p) => `<a href="?q=${encodeURIComponent(p.id)}#/s/0"><b>${esc(p.title)}</b><br><span class="muted small">${esc(p.blurb || p.unit || '')}</span></a>`).join('')}
      <a href="?q=open#/s/0"><b>Use My Own Question</b><br><span class="muted small">Type any question and add your own sources.</span></a></div></div>
  </div>`;
  focusMain();
}

function renderStart() {
  paintChrome(0);
  const isOpenMode = prompt.id === 'open';
  const openForm = isOpenMode ? `<div class="card stack"><h2>Your Question and Sources</h2>
      <div class="field"><label for="oq">The question you are answering</label><textarea id="oq" class="short" data-open="question">${esc(work.custom.question)}</textarea></div>
      <div class="stack">${work.custom.sources.map((s, i) => customSourceRow(s, i)).join('')}</div>
      <div class="row"><button class="btn quiet small" type="button" data-act="addsrc">Add a Source</button></div></div>` : '';
  const version = `<fieldset class="card"><legend class="kicker">VERSION</legend>
      <p class="small muted">Use the version your teacher gave you.</p>
      <div class="choice">${VERSIONS.map((v) => `<label><input type="radio" name="ver" value="${v}" ${work.version === v ? 'checked' : ''}>${v}</label>`).join('')}</div></fieldset>`;
  const nSrc = prompt.sources.length;
  main().innerHTML = `<div class="wrap narrowish stack">
    <div class="card"><div class="kicker">${esc(prompt.unit || 'QUESTION')}</div><h1 style="margin-top:6px">${esc(prompt.question || 'Type your question below.')}</h1>
      <p class="muted small">${nSrc} source${nSrc === 1 ? '' : 's'} to use · You'll write your finished CER on paper</p></div>
    ${openForm}${version}${meta.seenSteps ? recallCard() : introCard()}
    <div class="row"><button class="btn" type="button" data-act="begin">${meta.seenSteps ? 'Start' : 'Got It. Start'}</button>
      <a href="/">Pick a different question</a><span class="spacer"></span>
      <button class="btn quiet small" type="button" data-act="reset">Start Over</button></div>
  </div>`;
  focusMain();
}

// First visit: teach the steps with an example. Later visits: recall them, never a gate.
function introCard() {
  return `<div class="card"><h2>Meet the Six Steps</h2>
    <p class="small muted">Every CER follows the same six steps. The examples answer a practice question: <i>${esc(EXAMPLE.question)}</i></p>
    <ol class="intro">${STEPS.map((s) => `<li><b>${esc(s.t)}</b> ${esc(s.line)}<span class="ex">Example: ${esc(s.ex)}</span></li>`).join('')}</ol>
    <p class="small">The steps stay at the top of the screen while you work.</p></div>`;
}
function recallCard() {
  return `<details class="card warmcard"><summary><b>Warm-Up: The Six Steps From Memory</b> <span class="small muted">(optional)</span></summary>
    <div class="warm" id="warm">${STEPS.map((s, i) => `<div class="wrow"><label for="w${i + 1}"><span>${i + 1}</span><input type="text" id="w${i + 1}" autocomplete="off"></label><button class="btn quiet small" type="button" data-act="showme" data-i="${i}" aria-label="Show step ${i + 1}">Show Me</button></div>`).join('')}</div>
    <div class="row" style="margin-top:12px"><button class="btn ghost small" type="button" data-act="warmcheck">Check Me</button><span id="warmout" class="small" aria-live="polite"></span></div></details>`;
}

function customSourceRow(s, i) {
  return `<div class="logrow"><div class="head"><span class="num">Source ${i + 1}</span><span class="spacer"></span><button class="btn quiet small" type="button" data-act="delsrc" data-i="${i}">Remove</button></div>
    <div class="cols"><div class="field"><label for="st${i}">Title</label><input type="text" id="st${i}" data-src="${i}.title" value="${esc(s.title)}"></div>
    <div class="field"><label for="su${i}">Link (optional)</label><input type="url" id="su${i}" data-src="${i}.url" value="${esc(s.url)}"></div>
    <div class="field wide"><label for="sc${i}">Who made it, and when?</label><input type="text" id="sc${i}" data-src="${i}.citation" value="${esc(s.citation)}"></div></div></div>`;
}

// ---------------------------------------------------------------- shared pieces
// One field. Help comes from the support level for this move, or from the step's Stuck? button.
function field(key, path, move, opts = {}) {
  const f = F[key];
  const L = lvl(move);
  const id = 'f_' + path.replace(/\./g, '_');
  const val = getPath(path) || '';
  const help = L === 1 || stuck;
  const label = opts.label || (L <= 2 || stuck ? f.q : f.short);
  const starter = opts.starter ?? f.starter;
  const ph = help && starter ? `placeholder="${esc(starter)}..."` : '';
  const tag = f.rows <= 1
    ? `<input type="text" id="${id}" data-bind="${path}" value="${esc(val)}" ${ph}>`
    : `<textarea id="${id}" data-bind="${path}" rows="${f.rows}" ${f.rows <= 2 ? 'class="short"' : ''} ${ph}>${esc(val)}</textarea>`;
  return `<div class="field ${opts.cls || ''}" data-field="${path}"><label for="${id}">${esc(label)}${opts.note ? ` <span class="hint">${esc(opts.note)}</span>` : ''}</label>
    ${help && starter ? `<div class="starter">Start like this: ${esc(starter)}</div>` : ''}${tag}<div class="pushslot" id="push_${id}" aria-live="polite"></div></div>`;
}

// Tap-to-pick pills (task words, strength).
function pills(name, path, options, labelFn = (o) => o) {
  const cur = String(getPath(path) || '');
  return `<div class="pills" role="radiogroup">${options.map((o) => `<label class="pill-opt ${cur === String(o) ? 'on' : ''}"><input type="radio" name="${name}" data-bind="${path}" value="${esc(o)}" ${cur === String(o) ? 'checked' : ''}>${esc(labelFn(o))}</label>`).join('')}</div>`;
}

function exampleHTML(n) {
  const e = EXAMPLE;
  const body = {
    1: `<p>${esc(e.own)}</p>`,
    2: `<p><b>Says:</b> ${esc(e.log.says)}<br><b>Who and when:</b> ${esc(e.log.who)}<br><b>Where:</b> ${esc(e.log.where)}<br><b>Shows:</b> ${esc(e.log.shows)}</p>`,
    3: `<p>${esc(e.first)}</p>`,
    4: `<p>${esc(STEPS[3].ex)}</p>`,
    5: `<p><b>Shows:</b> ${esc(e.rshows)}<br><b>Proves:</b> ${esc(e.proves)}<br><b>Connects:</b> ${esc(e.connects)}</p>`,
    6: `<p>${esc(e.counter)}<br>${esc(e.answer)}</p>`,
  }[n];
  return `<div class="example"><span class="kicker">EXAMPLE, DIFFERENT QUESTION: ${esc(e.question.toUpperCase())}</span>${body}</div>`;
}

function wordBankHTML() {
  const split = prompt.wordBank.map((w) => { const i = w.indexOf(':'); return i > 0 ? [w.slice(0, i).trim(), w.slice(i + 1).trim()] : [w.trim(), '']; });
  if (!split.some(([, d]) => d)) return `<div class="bank"><b>Word Bank:</b> ${split.map(([t]) => esc(t)).join(' · ')}</div>`;
  return `<div class="bank"><b>Word Bank</b><dl class="terms">${split.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl></div>`;
}

// The step header: title, one guiding question, and quiet help buttons.
function stepHeader(n) {
  const s = STEPS[n - 1];
  const L = lvl(s.move);
  const tools = [];
  if (L === 2) tools.push(`<button class="btn quiet small" type="button" data-act="toggle" data-t="ex" aria-expanded="false">See an Example</button>`);
  if (prompt.wordBank.length) tools.push(`<button class="btn quiet small" type="button" data-act="toggle" data-t="bank" aria-expanded="false">Word Bank</button>`);
  if (L >= 2 && !stuck) tools.push(`<button class="btn quiet small" type="button" data-act="stuck" data-move="${s.move}">Stuck?</button>`);
  return `<div class="stephead"><div><div class="kicker">STEP ${n} OF 6</div><h1>${esc(s.title)}</h1><p class="ask">${esc(s.ask)}</p></div>
      ${tools.length ? `<div class="tools">${tools.join('')}</div>` : ''}</div>
    ${L === 1 ? exampleHTML(n) : `<div id="tool_ex" hidden>${exampleHTML(n)}</div>`}
    ${prompt.wordBank.length ? `<div id="tool_bank" hidden>${wordBankHTML()}</div>` : ''}`;
}

// ---------------------------------------------------------------- the steps
function renderStep(n) {
  paintChrome(n);
  const s = STEPS[n - 1];
  let body = '';
  let nextLabel = n === 6 ? 'Check My Work' : 'Next';

  if (s.id === 'read') {
    body = `<fieldset class="field" data-field="unpack.task"><legend class="q">What does the question ask you to do?</legend>
        ${pills('task', 'unpack.task', TASK_WORDS)}<div class="pushslot" id="push_task" aria-live="polite"></div></fieldset>` +
      field('own', 'unpack.own', 'claim');
  }

  if (s.id === 'find') {
    const need = evidenceNeeded(work.version);
    if (openRow >= work.log.length) openRow = work.log.length - 1;
    body = `<p class="small muted">Find at least ${need + 1} pieces of evidence, so you have choices later.</p>
      <div class="log">${work.log.map((r, i) => (i === openRow ? logRowOpen(i) : logRowShut(i))).join('')}</div>
      <div class="row"><button class="btn quiet small" type="button" data-act="addrow">Add Another Piece</button></div>
      <div class="pushslot" id="push_logcount" aria-live="polite"></div>`;
  }

  if (s.id === 'answer') {
    body = field('first', 'claim.first', 'claim') +
      `<fieldset class="field" data-field="claim.tests"><legend class="q">Test your claim. Check each one that is true.</legend><div class="checks">
        ${chk('claim.tests.answers', 'It answers the question.')}${chk('claim.tests.disagree', 'Someone could disagree with it.')}${chk('claim.tests.provable', 'My evidence can prove it.')}
      </div><div class="pushslot" id="push_tests" aria-live="polite"></div></fieldset>`;
  }

  if (s.id === 'prove') {
    const need = evidenceNeeded(work.version);
    const rows = work.log.map((r, i) => ({ r, i })).filter(({ r }) => r.says.trim());
    body = `<p>Pick the <b>${need}</b> that prove your claim best. Tap the strongest first.</p>
      <div class="pick">${rows.map(({ r, i }) => {
        const rank = work.chosen.indexOf(i);
        return `<label><input type="checkbox" data-act="pick" data-i="${i}" ${rank > -1 ? 'checked' : ''}><span>${esc(r.says)}<br><span class="small muted">${esc(r.who)}${r.strength ? ` · strength ${esc(r.strength)}` : ''}</span></span>${rank > -1 ? `<span class="rankno">#${rank + 1}</span>` : ''}</label>`;
      }).join('') || '<p class="muted">Find some evidence in Step 2 first.</p>'}</div>
      <div class="pushslot" id="push_choose" aria-live="polite"></div>`;
  }

  if (s.id === 'explain') {
    const N = work.chosen.length;
    if (rung >= N) rung = Math.max(0, N - 1);
    const i = work.chosen[rung];
    const r = work.log[i];
    const nav = N > 1 ? `<div class="rungnav" role="group" aria-label="Evidence">${work.chosen.map((_, k) =>
      `<button type="button" class="btn small ${k === rung ? '' : 'quiet'}" data-act="rung" data-k="${k}" ${k === rung ? 'aria-current="true"' : ''}>Evidence ${k + 1}</button>`).join('')}</div>` : '';
    body = N ? `${nav}<div class="rung"><div class="ev"><b>Evidence ${rung + 1} of ${N}:</b> ${esc(r.says)} <span class="muted small">(${esc(r.who)}${r.where ? ', ' + esc(r.where) : ''})</span></div>
        ${field('rshows', `reasoning.${i}.shows`, 'reasoning')}${field('proves', `reasoning.${i}.proves`, 'reasoning')}${field('connects', `reasoning.${i}.connects`, 'reasoning')}</div>`
      : '<p class="muted">Pick your evidence in Step 4 first.</p>';
    if (rung < N - 1) nextLabel = 'Next Evidence';
  }

  if (s.id === 'check') return renderCheck();

  main().innerHTML = `<div class="wrap"><div class="grid2"><div class="work">
      ${questionCard(n)}
      ${stepHeader(n)}
      <div class="card stack">${body}</div>
      <div class="pushslot" id="push_self" aria-live="polite"></div>
      <div class="row"><a href="#/s/${n - 1}">Back</a><span class="spacer"></span><button class="btn" type="button" data-act="next" data-n="${n}">${nextLabel}</button></div>
    </div><div class="side">${sourcePanel()}</div></div></div>`;
  focusMain();
}

const chk = (path, text) => `<label><input type="checkbox" data-bind="${path}" ${getPath(path) ? 'checked' : ''}>${esc(text)}</label>`;

// ---------------------------------------------------------------- Find: one evidence row open at a time
function srcFor(row) { return row.src !== '' && row.src !== 'other' ? prompt.sources[+row.src] : null; }

function logRowOpen(i) {
  const r = work.log[i];
  const L = lvl('evidence');
  const src = srcFor(r);
  const isVideo = src?.type === 'video';
  const lab = (k) => (L <= 2 || stuck ? F[k].q : F[k].short);
  const opts = prompt.sources.map((s, k) => `<option value="${k}" ${String(r.src) === String(k) ? 'selected' : ''}>${k + 1}. ${esc(s.title || 'Source')}</option>`).join('');
  const input = (k, labelKey = k, multi = false) => {
    const id = `f_log_${i}_${k}`;
    return `<div class="field ${multi ? 'wide' : ''}"><label for="${id}">${esc(lab(labelKey))}</label>${multi
      ? `<textarea id="${id}" class="short" data-bind="log.${i}.${k}">${esc(r[k])}</textarea>`
      : `<input type="text" id="${id}" data-bind="log.${i}.${k}" value="${esc(r[k])}">`}</div>`;
  };
  return `<div class="logrow open"><div class="head"><span class="num">Evidence ${i + 1}</span><span class="spacer"></span>
      ${work.log.length > 1 ? `<button class="btn quiet small" type="button" data-act="delrow" data-i="${i}" aria-label="Remove evidence ${i + 1}">Remove</button>` : ''}</div>
    <div class="cols">
      <div class="field wide"><label for="f_log_${i}_src">Which source is it from?</label>
        <select id="f_log_${i}_src" data-act="pickSrc" data-i="${i}"><option value="">Choose a source</option>${opts}<option value="other" ${r.src === 'other' ? 'selected' : ''}>Something else (notes, class reading)</option></select>
        ${src ? `<div class="small muted">${esc(r.who)}</div>` : ''}</div>
      ${r.src === 'other' ? input('who') : ''}
      ${input('says', 'says', true)}
      ${input('where', isVideo ? 'whereVideo' : 'where')}
      ${input('shows', 'shows', true)}
      <div class="field wide"><span class="q small">How well does it answer the question?</span>
        ${pills(`str${i}`, `log.${i}.strength`, ['3', '2', '1'], (o) => ({ 3: '3 Proves it', 2: '2 Helps', 1: '1 Barely' }[o]))}</div>
    </div><div class="pushslot" id="push_log_${i}" aria-live="polite"></div></div>`;
}

function logRowShut(i) {
  const r = work.log[i];
  const summary = r.says.trim() ? esc(r.says.length > 90 ? r.says.slice(0, 90) + '...' : r.says) : '<span class="muted">Empty</span>';
  return `<button type="button" class="logrow shut" data-act="openrow" data-i="${i}" aria-label="Open evidence ${i + 1}">
    <span class="num">Evidence ${i + 1}</span><span class="sum">${summary}</span><span class="edit">Edit</span></button>
    <div class="pushslot" id="push_log_${i}" aria-live="polite"></div>`;
}

// ---------------------------------------------------------------- sources (side panel; a drawer on phones)
function sourcePanel() {
  const srcs = prompt.sources || [];
  if (!srcs.length) return `<div class="card"><h2>Sources</h2><p class="muted small">No sources are attached. Use your class readings and notes.</p></div>`;
  return `<details class="srcdrawer" ${wide() ? 'open' : ''}><summary class="btn ghost">Sources (${srcs.length})</summary>${viewer()}</details>`;
}

function viewer() {
  const srcs = prompt.sources;
  if (sourceTab >= srcs.length) sourceTab = 0;
  const s = srcs[sourceTab];
  const t = s.type || 'link';
  const tabs = srcs.map((x, i) => `<button type="button" role="tab" aria-selected="${i === sourceTab}" data-act="tab" data-i="${i}">${i + 1} ${esc(labelType(x.type))}</button>`).join('');
  let content = '';
  if (t === 'excerpt' || t === 'link') content = s.excerpt ? `<blockquote>${esc(s.excerpt)}</blockquote>` : '';
  if (t === 'pdf') content = `<iframe src="${esc(s.file)}" title="${esc(s.title || 'PDF source')}"></iframe>`;
  if (t === 'image') content = `<img src="${esc(s.file)}" alt="${esc(s.alt || s.title || '')}">`;
  if (t === 'doc') content = `${s.excerpt ? `<blockquote>${esc(s.excerpt)}</blockquote>` : ''}<p><a href="${esc(s.file)}" download>Download the document</a></p>`;
  if (t === 'video') {
    const id = youtubeId(s.url);
    const start = toSeconds(s.start);
    content = id ? `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}?rel=0${start ? `&start=${start}` : ''}" title="${esc(s.title || 'Video source')}" allow="encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>
      <p class="small muted">Pause on a quote you want. Write down the exact words and the time.</p>${s.excerpt ? `<blockquote>${esc(s.excerpt)}</blockquote>` : ''}` : '';
  }
  const open = s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${t === 'video' ? 'Open on YouTube' : 'Open the full original'}</a>` : '';
  return `<section class="card viewer" aria-label="Sources"><div class="tabs" role="tablist">${tabs}</div>
    <div class="body"><div class="kicker">SOURCE ${sourceTab + 1} · ${esc(labelType(t).toUpperCase())}</div><h3>${esc(s.title || '')}</h3>
    ${s.note ? `<p class="small muted">${esc(s.note)}</p>` : ''}${content}
    ${s.citation ? `<div class="cite"><b>Citation:</b> ${esc(s.citation)}</div>` : ''}${open}</div></section>`;
}
const labelType = (t) => ({ excerpt: 'Excerpt', pdf: 'PDF', image: 'Image', doc: 'Doc', link: 'Link', video: 'Video' }[t] || 'Source');

// ---------------------------------------------------------------- push-back, one question at a time
function flagsFor(n) {
  const out = [];
  const add = (slot, res) => res && out.push({ slot, ...res });
  const ctx = ctxBase();
  if (n === 1) {
    add('task', work.unpack.task ? null : { title: 'What does the question ask you to do?', nudge: 'Tap one: decide, explain why, compare...' });
    add('f_unpack_own', RULES.own(work.unpack.own, ctx));
  }
  if (n === 2) {
    work.log.forEach((r, i) => {
      if (r.says.trim() && !r.src) add(`log_${i}`, { title: 'Which source is this from?', nudge: 'Pick it from the list so someone can check it.' });
      else add(`log_${i}`, RULES.logRow(r));
    });
    add('logcount', RULES.logCount(work.log, evidenceNeeded(work.version)));
  }
  if (n === 3) {
    add('f_claim_first', RULES.claim(work.claim.first, ctx));
    add('tests', RULES.claimTests(work.claim.tests));
  }
  if (n === 4) add('choose', RULES.choose(work.chosen, work.log, evidenceNeeded(work.version)));
  if (n === 5) {
    const i = work.chosen[rung];
    if (i !== undefined) {
      const r = work.reasoning[i] || {};
      add(`f_reasoning_${i}_shows`, RULES.rshows(r.shows || ''));
      add(`f_reasoning_${i}_proves`, RULES.proves(r.proves || '', { says: work.log[i]?.says }));
      add(`f_reasoning_${i}_connects`, RULES.connects(r.connects || ''));
    }
  }
  if (n === 6) {
    const required = needsCounter(work.version);
    add('f_stress_counter', RULES.counter(work.stress.counter, { required }));
    add('f_stress_answer', RULES.answer(work.stress.answer, { required, counter: work.stress.counter.trim() }));
    add('f_stress_final', RULES.final(work.stress.final, ctx));
  }
  return out;
}

const snapshot = (n) => JSON.stringify([n, rung, work.unpack, work.log, work.claim, work.chosen, work.reasoning, work.stress]);

function onNext(n) {
  document.querySelectorAll('.pushslot').forEach((el) => { el.innerHTML = ''; });
  document.querySelectorAll('.flagged').forEach((el) => el.classList.remove('flagged'));
  const L = lvl(STEPS[n - 1].move);
  // Solo: no push-back while working; the Check step still runs the checks.
  const flags = L >= 4 && n !== 6 ? [] : flagsFor(n);
  if (flags.length) {
    const snap = snapshot(n);
    if (pending === snap) { advance(n); return; }
    if (L === 3 && !selfShown) {
      selfShown = true;
      $('#push_self').innerHTML = `<div class="push self"><span class="mark">?</span><div><b>${esc(SELF_QUESTION)}</b>
        <span class="small">Fix anything you notice, then tap Next. Or <button class="btn quiet small" type="button" data-act="coachq" data-n="${n}">Show the Coach's Question</button></span></div></div>`;
      return;
    }
    showFlag(flags[0], n);
    pending = snap;
    return;
  }
  advance(n);
}

function showFlag(f, n) {
  // Find: open the row the question is about.
  const m = /^log_(\d+)$/.exec(f.slot);
  if (n === 2 && m && +m[1] !== openRow) { openRow = +m[1]; renderStep(2); }
  const slot = document.getElementById(`push_${f.slot}`) || $('#push_self');
  slot.innerHTML = `<div class="push" role="status"><span class="mark">?</span><div><b>${esc(f.title)}</b>${f.nudge ? `<span class="small">${esc(f.nudge)}</span>` : ''}
    <span class="small muted">Fix it, or tap ${n === 6 ? 'Check My Work' : 'Next'} again to keep your answer.</span></div></div>`;
  slot.closest('.field')?.classList.add('flagged');
  slot.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

function advance(n) {
  pending = null; selfShown = false;
  if (n === 5 && rung < work.chosen.length - 1) { rung += 1; stuck = false; renderStep(5); window.scrollTo(0, 0); return; }
  if (n === 6) { work.check.stage = 'score'; save(); renderCheck(); return; }
  work.done[n] = true; save();
  go(n + 1);
}

// ---------------------------------------------------------------- Check: other side + final claim, then score
function coachResults() {
  const req = needsCounter(work.version);
  const need = evidenceNeeded(work.version);
  const ctx = ctxBase();
  const claimRes = RULES.claim(work.stress.final || work.claim.first, ctx);
  const evRows = work.chosen.map((i) => work.log[i]).filter(Boolean);
  const evRes = evRows.length < need ? { title: `Use ${need} pieces of evidence.` } : evRows.map((r) => RULES.logRow(r)).find(Boolean) || null;
  const reRes = work.chosen.map((i) => RULES.proves((work.reasoning[i] || {}).proves || '', { says: work.log[i]?.says })).find(Boolean) || null;
  const out = [{ key: 'claim', name: 'Claim', res: claimRes }, { key: 'evidence', name: 'Evidence', res: evRes }, { key: 'reasoning', name: 'Reasoning', res: reRes }];
  if (req) out.push({ key: 'counter', name: 'Other Side', res: RULES.counter(work.stress.counter, { required: true }) || RULES.answer(work.stress.answer, { required: true }) });
  return out;
}

function planHTML() {
  const req = needsCounter(work.version);
  const rows = [['Claim', work.stress.final || work.claim.first]];
  work.chosen.forEach((i, k) => {
    const r = work.log[i]; const z = work.reasoning[i] || {};
    rows.push([`Evidence ${k + 1}`, `${r.says} (${r.who}${r.where ? ', ' + r.where : ''})\n» ${z.shows || ''}\n» ${z.proves || ''}${z.connects ? '\n» Connects to: ' + z.connects : ''}`]);
  });
  if (req || work.stress.counter.trim()) rows.push(['Other Side', `${work.stress.counter}\n» ${work.stress.answer}`]);
  rows.push(['End', 'Come back to your claim in your last sentence.']);
  return rows.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b || '(empty)')}</dd>`).join('');
}

function renderCheck() {
  paintChrome(6);
  const req = needsCounter(work.version);
  if (work.check.stage !== 'score') {
    main().innerHTML = `<div class="wrap"><div class="grid2"><div class="work">
        ${questionCard(6)}${stepHeader(6)}
        <div class="card stack">
          ${field('counter', 'stress.counter', 'claim', { note: req ? '' : '(optional)' })}
          ${field('answer', 'stress.answer', 'claim', { note: req ? '' : '(optional)' })}
          ${field('final', 'stress.final', 'claim')}
        </div>
        <div class="pushslot" id="push_self" aria-live="polite"></div>
        <div class="row"><a href="#/s/5">Back</a><span class="spacer"></span><button class="btn" type="button" data-act="next" data-n="6">Check My Work</button></div>
      </div><div class="side">${sourcePanel()}</div></div></div>`;
    return focusMain();
  }

  const parts = [['claim', 'Claim'], ['evidence', 'Evidence'], ['reasoning', 'Reasoning']].concat(req ? [['counter', 'Other Side']] : []);
  const allScored = parts.every(([k]) => work.check.self[k]);
  const goal = req ? 'Aim for 9 to 12 sentences.' : 'Aim for 6 to 8 sentences.';
  const scoreRows = parts.map(([k, name]) => `<div class="score" role="group" aria-label="${name} score"><b>${name}</b>${[1, 2, 3, 4].map((p) =>
    `<button type="button" class="pt" data-act="score" data-k="${k}" data-p="${p}" aria-pressed="${work.check.self[k] === p}">${p}</button>`).join('')}</div>`).join('');
  let compare = '';
  if (work.check.revealed) {
    compare = `<div class="card"><h2>What the Coach Sees</h2><table class="compare"><thead><tr><th>Part</th><th>You</th><th>Coach</th></tr></thead><tbody>
      ${coachResults().map((r) => `<tr><td><b>${r.name}</b></td><td>${work.check.self[r.key] || '-'}</td><td>${r.res ? `Take a look: ${esc(r.res.title)}` : 'Looks solid'}</td></tr>`).join('')}
      </tbody></table><p class="small muted">If you and the Coach disagree, reread that part out loud. Who is right?</p></div>
      <div class="card stack"><h2>Partner Read</h2>
      <p class="small">Your partner reads your CER out loud, then asks: What does your claim answer? Where is this evidence from? Why does it prove your claim?${req ? ' What about the other side?' : ''}</p>
      <div class="field"><label for="c_fix">One thing I will fix:</label><input type="text" id="c_fix" data-bind="check.fix" value="${esc(work.check.fix)}"></div>
      <div class="field"><label for="c_next">Next time I will:</label><input type="text" id="c_next" data-bind="check.next" value="${esc(work.check.next)}"></div>
      <div class="row"><button class="btn" type="button" data-act="finish" ${work.check.applied ? 'disabled' : ''}>${work.check.applied ? 'Finished' : 'Finish'}</button><span id="finishout" class="small" aria-live="polite">${work.check.applied ? esc(work.check.summary || '') : ''}</span></div></div>`;
  } else if (allScored) {
    compare = `<div class="row"><button class="btn ghost" type="button" data-act="reveal">See What the Coach Sees</button></div>`;
  }
  main().innerHTML = `<div class="wrap"><div class="grid2"><div class="work">
      ${questionCard(6)}
      <div class="stephead"><div><div class="kicker">STEP 6 OF 6</div><h1>Score Your Work</h1><p class="ask">Score yourself first. Then see what the Coach thinks.</p></div></div>
      <div class="card stack"><p class="small muted">4 Exemplary · 3 Proficient · 2 Progressing · 1 Beginning</p>${scoreRows}</div>
      ${compare}
      <div class="row"><button class="btn quiet small" type="button" data-act="backother">Back to the Other Side</button></div>
    </div><div class="side">
      <div class="card stack"><h2>Your Plan</h2><p class="small muted">Write your CER on lined paper in full sentences. ${goal}</p>
        <dl class="planlist">${planHTML()}</dl>
        <div class="row"><button class="btn" type="button" data-act="print">Print My Plan</button></div></div>
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
      if (L.streak >= 2 && L.level < 4) { L.level += 1; L.streak = 0; msgs.push(`You're ready to do ${MOVES[m]} with less help.`); }
    } else if (r.res) {
      L.streak = 0;
      if (L.level > 1 && self < 3) { L.level -= 1; msgs.push(`The Coach will give you a little more help with ${MOVES[m]}.`); }
    } else {
      L.streak = 0;
    }
  });
  saveLevels(levels);
  work.check.applied = true;
  work.check.summary = msgs.length ? msgs.join(' ') : 'Nice work. Keep practicing the six steps.';
  work.done[6] = true;
  meta.finished = (meta.finished || 0) + 1; saveMeta(meta);
  save();
}

// ---------------------------------------------------------------- Steps Card
function renderStepsCard() {
  paintChrome(0);
  main().innerHTML = `<div class="wrap narrowish stack"><div class="card steps"><h1>The Six Steps</h1>
    <p class="muted">Read the question. Find the evidence. Answer it. Prove it. Explain why. Check it.</p>
    <ol>${STEPS.map((s) => `<li><b>${esc(s.t)}</b> ${esc(s.line)}<ul>${s.qs.map((q) => `<li>${esc(q)}</li>`).join('')}</ul></li>`).join('')}</ol></div>
    <div class="card"><h2>Where C, E and R Fit</h2><p><b>Claim:</b> one sentence that answers the question and that someone could disagree with.</p>
    <p><b>Evidence:</b> facts, quotes or details from sources, with where they came from.</p><p><b>Reasoning:</b> why the evidence proves the claim.</p>
    <p><b>Other side:</b> who would disagree, and your answer to them.</p></div>
    <p><a href="${prompt ? '#/s/0' : '#/'}">Back</a></p></div>`;
  focusMain();
}

function warmCheck() {
  const ins = [...document.querySelectorAll('#warm input')];
  let right = 0;
  ins.forEach((inp, i) => { const ok = STEPS[i].key.test(inp.value); inp.parentElement.classList.toggle('right', ok); if (ok) right++; });
  const missed = STEPS.filter((s, i) => !s.key.test(ins[i].value)).map((s) => `${s.n}. ${s.t}`);
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
  if (t.dataset.bind && work && t.type !== 'radio' && t.type !== 'checkbox') { setPath(t.dataset.bind, t.value); save(); }
  if (t.dataset.open && work) { work.custom.question = t.value; prompt.question = t.value; save(); }
  if (t.dataset.src && work) { const [i, k] = t.dataset.src.split('.'); work.custom.sources[+i][k] = t.value; save(); }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.name === 'ver' && work) { work.version = t.value; save(); }
  if (t.dataset.bind && t.type === 'radio') {
    setPath(t.dataset.bind, t.value); save();
    t.closest('.pills')?.querySelectorAll('.pill-opt').forEach((l) => l.classList.toggle('on', l.contains(t)));
  }
  if (t.dataset.bind && t.type === 'checkbox') { setPath(t.dataset.bind, t.checked); save(); }
  if (t.dataset.act === 'pickSrc') {
    const i = +t.dataset.i; const row = work.log[i];
    row.src = t.value;
    const s = srcFor(row);
    row.who = s ? (s.citation || s.title || '') : (row.src === 'other' ? '' : row.who);
    save(); renderStep(2); document.getElementById(`f_log_${i}_says`)?.focus();
  }
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b || b.tagName === 'SELECT') return;
  const act = b.dataset.act;
  if (act === 'next') onNext(+b.dataset.n);
  if (act === 'coachq') { const n = +b.dataset.n; const fl = flagsFor(n); if (fl.length) showFlag(fl[0], n); pending = snapshot(n); }
  if (act === 'begin') { work.done[0] = true; save(); if (!meta.seenSteps) { meta.seenSteps = true; saveMeta(meta); } go(1); }
  if (act === 'reset' && confirm('Start over on this question? Your answers for it will be erased.')) { clearWork(prompt.id); prompt = null; route(); }
  if (act === 'warmcheck') warmCheck();
  if (act === 'showme') { const i = +b.dataset.i; const inp = document.getElementById(`w${i + 1}`); inp.value = STEPS[i].t; inp.parentElement.classList.add('shown'); }
  if (act === 'stuck') {
    stuck = true;
    work.stuck[b.dataset.move] = (work.stuck[b.dataset.move] || 0) + 1; save();
    const n = +location.hash.split('/')[2];
    if (n === 6) renderCheck(); else renderStep(n);
  }
  if (act === 'toggle') {
    const box = document.getElementById(`tool_${b.dataset.t}`);
    if (box) { box.hidden = !box.hidden; b.setAttribute('aria-expanded', String(!box.hidden)); }
  }
  if (act === 'tab') { sourceTab = +b.dataset.i; const v = $('.viewer'); if (v) v.outerHTML = viewer(); }
  if (act === 'openrow') { openRow = +b.dataset.i; renderStep(2); }
  if (act === 'addrow') { work.log.push(blankRow()); openRow = work.log.length - 1; save(); renderStep(2); }
  if (act === 'delrow') {
    const i = +b.dataset.i; work.log.splice(i, 1);
    work.chosen = work.chosen.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x));
    openRow = Math.max(0, Math.min(openRow, work.log.length - 1)); save(); renderStep(2);
  }
  if (act === 'pick') {
    const i = +b.dataset.i;
    work.chosen = b.checked ? [...work.chosen, i] : work.chosen.filter((x) => x !== i);
    save(); renderStep(4);
  }
  if (act === 'rung') { rung = +b.dataset.k; pending = null; selfShown = false; stuck = false; renderStep(5); }
  if (act === 'addsrc') { work.custom.sources.push({ type: 'link', title: '', url: '', excerpt: '', citation: '' }); save(); renderStart(); }
  if (act === 'delsrc') { work.custom.sources.splice(+b.dataset.i, 1); save(); renderStart(); }
  if (act === 'score') { work.check.self[b.dataset.k] = +b.dataset.p; save(); renderCheck(); }
  if (act === 'reveal') { work.check.revealed = true; save(); renderCheck(); }
  if (act === 'backother') { work.check.stage = 'other'; save(); renderCheck(); }
  if (act === 'finish') { applyLevels(); renderCheck(); }
  if (act === 'print') printPlan();
});
$('#printBtn').addEventListener('click', printPlan);

window.addEventListener('hashchange', route);
route();
