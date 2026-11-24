// Rule-based push-back. Each check returns null (fine) or a push-back message.
// Nothing leaves the browser.

const STOP = new Set(('a an the of to in on for and or but is are was were be been it its this that these those ' +
  'what which who whom why how did do does should would could can will with as at by from into than then there their ' +
  'they them our we you your i my me he she his her not no yes').split(' '));

export const words = (s = '') => (s.toLowerCase().match(/[a-z0-9']+/g) || []);
export const keyWords = (s) => words(s).filter((w) => w.length > 2 && !STOP.has(w));
const count = (s) => words(s).length;

// share of b's key words that also appear in a
export function overlap(a, b) {
  const A = new Set(keyWords(a).map(stem));
  const B = keyWords(b).map(stem);
  if (!B.length) return 0;
  return B.filter((w) => A.has(w)).length / B.length;
}
function stem(w) { return w.replace(/(ing|ed|es|s)$/, ''); }

const msg = (title, nudge) => ({ title, nudge });

export const RULES = {
  own(v, ctx) {
    if (!v.trim()) return msg('Say the question in your own words first.', 'Try explaining it to a 6th grader.');
    if (overlap(ctx.question, v) > 0.8 && count(v) <= count(ctx.question) + 3)
      return msg("Say it like you'd explain it to a 6th grader.", 'You mostly copied the question. What is it really asking?');
    return null;
  },
  task(v) {
    if (!v.trim()) return msg('What does the question ask you to do?', 'Look for the task word: decide, explain why, compare...');
    return null;
  },
  logRow(row) {
    if (!row.says.trim()) return null; // empty rows are ignored
    if (!row.who.trim() || !row.where.trim())
      return msg('Where did this come from?', 'Someone checking your work needs to find it. Fill in who made it and where.');
    if (!row.shows.trim()) return msg('What does this show about the question?', 'A fact on its own is not evidence yet.');
    return null;
  },
  logCount(rows, need) {
    const n = rows.filter((r) => r.says.trim()).length;
    if (n < need + 1)
      return msg('What else in the sources could help?', `Log at least ${need + 1} pieces so you have choices. Look for a number, a quote, or an event.`);
    return null;
  },
  claim(v, ctx) {
    const t = v.trim();
    if (!t) return msg('Answer the question in one sentence.', '');
    if (/^(i think|in my opinion|i believe|i feel)\b/i.test(t))
      return msg("Say it like you're sure.", "Drop the 'I think' and state it.");
    if (/^(yes|no|maybe)[.!]?$/i.test(t) || count(t) < 8)
      return msg("Yes or no isn't enough.", "Add the why: '...because...'");
    if (ctx.question && overlap(t, ctx.question) === 0)
      return msg('Does this answer the question at the top?', 'Use some of its words in your claim.');
    return null;
  },
  claimTests(tests) {
    if (!tests.answers || !tests.disagree || !tests.provable)
      return msg('Your claim did not pass every test yet.', 'Fix the claim until you can check all three boxes.');
    return null;
  },
  choose(chosen, rows, need) {
    if (chosen.length < need) return msg(`Choose ${need} pieces of evidence.`, 'Which ones prove your claim most directly?');
    const weak = chosen.find((i) => String(rows[i]?.strength) === '1');
    if (weak !== undefined)
      return msg('Is there a stronger piece in your log?', 'You picked one you rated 1. What proves your claim most directly?');
    return null;
  },
  rshows(v) {
    if (!v.trim()) return msg('What does this evidence show?', '');
    return null;
  },
  proves(v, ctx) {
    const t = v.trim();
    if (!t) return msg('Why does it prove your claim?', "Finish: 'This proves my claim because...'");
    if (ctx.says && overlap(ctx.says, t) > 0.6)
      return msg('You told me what it says. Now tell me why it matters.', "Finish this in your head first: 'This matters for my claim because...'");
    if (!/\b(because|so|this shows|this means|proves|therefore|which means)\b/i.test(t))
      return msg('How does this prove your claim?', "Use 'because' or 'so' to connect it to your claim.");
    return null;
  },
  connects(v) {
    if (!v.trim()) return msg('Which idea from class does this connect to?', 'Check the word bank for this question.');
    return null;
  },
  counter(v, ctx) {
    if (!ctx.required) return null;
    if (!v.trim()) return msg('Who would argue with you?', 'What would they point to?');
    if (count(v) < 8) return msg('Say more about the other side.', 'Name who would disagree and why.');
    return null;
  },
  answer(v, ctx) {
    if (!ctx.required && !ctx.counter) return null;
    if (!v.trim()) return msg('How would you answer them?', 'Use your evidence, not just your opinion.');
    return null;
  },
  final(v, ctx) { return RULES.claim(v, ctx); },
};
