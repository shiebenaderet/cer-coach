// All student-facing wording lives here so it matches the paper set.
// Plain words, short sentences: aim for about a 6th grade reading level.

export const MOVES = { claim: 'Claim', evidence: 'Evidence', reasoning: 'Reasoning' };

// Versions match the paper set and the reading levels.
export const VERSIONS = ['Quick', 'Clear', 'Full', 'Deep'];
export const needsCounter = (v) => v === 'Full' || v === 'Deep';
export const evidenceNeeded = (v) => (v === 'Quick' || v === 'Clear' ? 2 : 3);

// The six steps ARE the path: one step per screen, same names as the Steps Card and the paper set.
export const STEPS = [
  { n: 1, id: 'read', t: 'Read the question.', short: 'Read', title: 'Read the Question', move: 'claim', key: /question|read|unpack/i,
    line: 'Figure out what the question is really asking before you look for answers.',
    ex: '"Should our school start later?" asks me to decide yes or no, and why.',
    ask: 'What is it really asking me to do?',
    qs: ['What is it really asking me to do?', 'Which words do I need to understand?'] },
  { n: 2, id: 'find', t: 'Find the evidence.', short: 'Find', title: 'Find the Evidence', move: 'evidence', key: /evidence|source|find|gather/i,
    line: 'Collect facts, quotes and details from the sources, and write down where each came from.',
    ex: 'Doctors say schools should start at 8:30 or later (American Academy of Pediatrics, 2014).',
    ask: 'What do the sources say, and who said it?',
    qs: ['What do the sources say or show?', 'Who made each source, and when?', 'Where can someone find it?'] },
  { n: 3, id: 'answer', t: 'Answer it.', short: 'Answer', title: 'Answer the Question', move: 'claim', key: /answer|claim/i,
    line: 'Write your claim: one sentence that answers the question and that someone could disagree with.',
    ex: 'Our school should start later because students would get the sleep doctors say they need.',
    ask: 'Does my answer take a side someone could argue with?',
    qs: ['Does my claim answer the question?', 'Could someone disagree?', 'Can my evidence prove it?'] },
  { n: 4, id: 'prove', t: 'Prove it.', short: 'Prove', title: 'Choose Your Best Evidence', move: 'evidence', key: /prove|proof|support|choose|best/i,
    line: 'Choose the evidence that proves your claim best.',
    ex: "The doctors' advice proves it better than a story about one tired student.",
    ask: 'Which evidence proves my claim most directly?',
    qs: ['Which evidence proves my claim most directly?', 'Did I say where it came from?'] },
  { n: 5, id: 'explain', t: 'Explain why.', short: 'Explain', title: 'Explain Your Evidence', move: 'reasoning', key: /explain|why|reason/i,
    line: 'Explain how each piece of evidence proves your claim. This is your reasoning.',
    ex: "This proves my claim because the people who study kids' health most say early starts hurt.",
    ask: 'Why does this evidence prove my claim?',
    qs: ['What does this evidence show?', 'Why does it prove my claim?', 'What idea from class does it connect to?'] },
  { n: 6, id: 'check', t: 'Check it.', short: 'Check', title: 'Check Your Work', move: 'claim', key: /check|revise|review|fix/i,
    line: 'Answer the other side, reread your work, and fix what is weak.',
    ex: 'Some people say sports would end later. But sleep affects learning every day.',
    ask: 'Who would disagree, and what is my answer?',
    qs: ['Who would disagree, and what is my answer?', 'Did I return to my claim?', 'Would a partner follow it?'] },
];

// Field wording. q = the full question (Model, Guided). short = a short cue (Prompted, Solo).
export const F = {
  own: { q: 'Say the question in your own words.', short: 'In your own words', starter: 'The question is really asking', rows: 2 },
  says: { q: 'What does it say or show?', short: 'What it says', starter: '', rows: 2 },
  who: { q: 'Who made it, and when?', short: 'Who and when', starter: '', rows: 1 },
  where: { q: 'Where is it? (page, paragraph)', short: 'Where', starter: '', rows: 1 },
  whereVideo: { q: 'Time in the video (like 2:15)', short: 'Time', starter: '', rows: 1 },
  shows: { q: 'What does it show about the question?', short: 'What it shows', starter: 'This shows', rows: 2 },
  first: { q: 'Answer the question in one sentence.', short: 'Your claim', starter: 'The answer is ... because ...', rows: 2 },
  rshows: { q: 'What does this evidence show?', short: 'Shows', starter: 'This shows that', rows: 2 },
  proves: { q: 'Why does it prove your claim?', short: 'Proves', starter: 'This proves my claim because', rows: 3 },
  connects: { q: 'What idea or word from class does it connect to?', short: 'Connects to', starter: 'This connects to', rows: 1 },
  counter: { q: 'Who might disagree with you? What would they point to?', short: 'The other side', starter: 'Some people might say ... because ...', rows: 3 },
  answer: { q: 'How would you answer them? Use your evidence.', short: 'Your answer', starter: 'But', rows: 3 },
  final: { q: 'Write your final claim. Make it stronger if your evidence changed your mind.', short: 'Final claim', starter: 'My final claim:', rows: 2 },
};

export const TASK_WORDS = ['decide', 'explain why', 'compare', 'judge how much', 'describe'];

// Worked example on a different question, shown at the Model level or on request.
export const EXAMPLE = {
  question: 'Should our school start later in the morning?',
  own: 'The question is really asking if a later start time would be better for students.',
  log: {
    says: 'Doctors say middle and high schools should start at 8:30 a.m. or later.',
    who: "American Academy of Pediatrics, a group of children's doctors, 2014",
    where: 'Policy statement, opening summary',
    shows: "Experts on kids' health think early start times are a problem.",
  },
  first: 'Our school should start later because students would get the sleep doctors say they need.',
  rshows: "The experts on kids' health think early starts are a problem.",
  proves: "This proves my claim because the people who study kids' health the most are warning against early starts.",
  connects: 'This connects to what experts know about how much sleep teens need.',
  counter: 'Some people might say a later start would push sports and jobs later, because the school day would end later.',
  answer: 'But the doctors say sleep affects health and learning every day, which matters more than a later practice time.',
};

export const SELF_QUESTION = 'Before the Coach weighs in: what question should you ask yourself about this answer?';

// YouTube links of every common shape -> video id, or '' if not YouTube.
export function youtubeId(url = '') {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}
// "2:15", "1:02:15" or "135" -> seconds.
export function toSeconds(t = '') {
  const parts = String(t).trim().split(':').map((x) => parseInt(x, 10));
  if (parts.some(Number.isNaN)) return 0;
  return parts.reduce((s, p) => s * 60 + p, 0);
}
