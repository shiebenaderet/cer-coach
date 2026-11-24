// All student-facing wording lives here so it matches the paper set.

export const MOVES = {
  claim: 'Claim',
  evidence: 'Evidence',
  reasoning: 'Reasoning',
};

// Support levels, per move. 1 = most support, 4 = on your own.
export const LEVELS = ['Model', 'Guided', 'Prompted', 'Solo'];

// Versions match the paper set and the reading levels.
export const VERSIONS = ['Quick', 'Clear', 'Full', 'Deep'];
export const needsCounter = (v) => v === 'Full' || v === 'Deep';
export const evidenceNeeded = (v) => (v === 'Quick' || v === 'Clear' ? 2 : 3);

export const STEPS = [
  { t: 'Read the question.', short: 'Read', key: /question|read|unpack/i,
    line: 'Figure out what the question is really asking before you look for answers.',
    ex: '"Should our school start later?" asks me to decide yes or no, and why.',
    qs: ['What is it really asking me to do?', 'Which words do I need to understand?'] },
  { t: 'Find the evidence.', short: 'Find', key: /evidence|source|find|gather/i,
    line: 'Collect facts, quotes and details from the sources, and write down where each came from.',
    ex: 'Doctors say schools should start at 8:30 or later (American Academy of Pediatrics, 2014).',
    qs: ['What do the sources say or show?', 'Who made each source, and when?', 'Where can someone find it?'] },
  { t: 'Answer it.', short: 'Answer', key: /answer|claim/i,
    line: 'Write your claim: one sentence that answers the question and that someone could disagree with.',
    ex: 'Our school should start later because students would get the sleep doctors say they need.',
    qs: ['Does my claim answer the question?', 'Could someone disagree?', 'Can my evidence prove it?'] },
  { t: 'Prove it.', short: 'Prove', key: /prove|proof|support|choose|best/i,
    line: 'Choose the evidence that proves your claim best.',
    ex: 'The doctors\' recommendation proves it more directly than a story about one tired student.',
    qs: ['Which evidence proves my claim most directly?', 'Did I say where it came from?'] },
  { t: 'Explain why.', short: 'Explain', key: /explain|why|reason/i,
    line: 'Explain how each piece of evidence proves your claim. This is your reasoning.',
    ex: 'This proves my claim because the people who study kids\' health most are warning against early starts.',
    qs: ['What does this evidence show?', 'Why does it prove my claim?', 'What idea from class does it connect to?'] },
  { t: 'Check it.', short: 'Check', key: /check|revise|review|fix/i,
    line: 'Answer the other side, reread your work, and fix what is weak.',
    ex: 'Some people say sports would end later. But sleep affects learning every day.',
    qs: ['Who would disagree, and what is my answer?', 'Did I return to my claim?', 'Would a partner follow it?'] },
];

// Which of the six steps each station practices.
export const STATION_STEP = { 2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 8: 5 };

export const STATIONS = [
  { n: 1, id: 'setup', name: 'Set Up', move: null },
  { n: 2, id: 'unpack', name: 'Unpack', move: 'claim', title: 'Unpack the Question' },
  { n: 3, id: 'gather', name: 'Gather', move: 'evidence', title: 'Gather Evidence' },
  { n: 4, id: 'claim', name: 'First Claim', move: 'claim', title: 'Write a First Claim' },
  { n: 5, id: 'choose', name: 'Choose', move: 'evidence', title: 'Choose Your Best Evidence' },
  { n: 6, id: 'reason', name: 'Reasoning', move: 'reasoning', title: 'Build Reasoning' },
  { n: 7, id: 'stress', name: 'Stress Test', move: 'claim', title: 'Stress Test Your Claim' },
  { n: 8, id: 'check', name: 'Check', move: null, title: 'Assemble and Check' },
];

// Field wording. q = full question (Model, Guided). short = the move cue (Prompted, Solo).
export const F = {
  task: { q: 'Circle the task word in the question. What does it ask you to do?', short: 'Task', starter: 'The question asks me to', rows: 1 },
  words: { q: 'Which words or names in the question do you need to understand first?', short: 'Key words', starter: 'Words I need to know:', rows: 1 },
  own: { q: 'Say the question in your own words.', short: 'Restate', starter: 'The question is really asking', rows: 2 },
  says: { q: 'What does it say or show?', short: 'What it says', starter: 'The source says', rows: 2 },
  who: { q: 'Who made the source, and when?', short: 'Who and when', starter: '', rows: 1 },
  where: { q: 'Where? (page, paragraph, article)', short: 'Where', starter: '', rows: 1 },
  shows: { q: 'What does it show about the question?', short: 'What it shows', starter: 'This shows', rows: 2 },
  first: { q: 'Answer the question in one sentence. This is your first-try claim.', short: 'Claim', starter: 'The answer is ... because ...', rows: 2 },
  rshows: { q: 'What does this evidence show?', short: 'Shows', starter: 'This shows that', rows: 2 },
  proves: { q: 'Why does it prove your claim?', short: 'Proves', starter: 'This proves my claim because', rows: 3 },
  connects: { q: 'Which idea or word from class does it connect to?', short: 'Connects', starter: 'This connects to', rows: 1 },
  counter: { q: 'Who might disagree with your claim, and what evidence would they point to?', short: 'Counterpoint', starter: 'Some people might say ... because ...', rows: 3 },
  answer: { q: 'How would you answer them? Use your evidence.', short: 'Your answer', starter: 'But', rows: 3 },
  final: { q: 'Rewrite your claim. Make it stronger or more exact if your evidence pushed it somewhere new.', short: 'Final claim', starter: 'My final claim:', rows: 2 },
};

export const TASK_WORDS = ['describe', 'decide', 'explain why', 'compare', 'judge how much', 'list'];
export const HELP_WORDS = ['since', 'which shows', 'because', 'however', 'mostly', 'so', 'although', 'this means'];

// Worked examples on a different topic, shown at Model level or on request.
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
