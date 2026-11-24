// Browser-only saving. Work for each question is kept separately; support levels carry across questions.

const safe = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: work stays in memory */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export function blankWork(promptId, version) {
  return {
    promptId, version,
    unpack: { task: '', words: '', own: '' },
    log: [blankRow(), blankRow(), blankRow()],
    claim: { first: '', tests: { answers: false, disagree: false, provable: false } },
    chosen: [],
    reasoning: {},
    stress: { counter: '', answer: '', final: '' },
    check: { self: {}, revealed: false, hard: '', next: '', fix: '', applied: false },
    stuck: { claim: 0, evidence: 0, reasoning: 0 },
    done: {},
    custom: null,
  };
}
export const blankRow = () => ({ says: '', who: '', where: '', shows: '', strength: '' });

export const loadWork = (id) => safe.get(`cer:work:${id}`);
export const saveWork = (w) => safe.set(`cer:work:${w.promptId}`, w);
export const clearWork = (id) => safe.del(`cer:work:${id}`);

const DEFAULT_LEVELS = { claim: { level: 2, streak: 0 }, evidence: { level: 2, streak: 0 }, reasoning: { level: 1, streak: 0 } };
export const loadLevels = () => ({ ...DEFAULT_LEVELS, ...(safe.get('cer:levels') || {}) });
export const saveLevels = (l) => safe.set('cer:levels', l);

export const loadLast = () => safe.get('cer:last');
export const saveLast = (id) => safe.set('cer:last', id);
