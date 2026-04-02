const { validateRound } = require('./aiValidator');

function normalize(t) {
  if (!t) return '';
  return t.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

function startsWithLetter(a, l) { const n = normalize(a); return n.length > 0 && n.startsWith(normalize(l)); }
function containsCombo(a, c) { const n = normalize(a); return n.length > 1 && n.slice(1).includes(normalize(c)); }

function levenshtein(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    m[i][j] = a[i-1] === b[j-1] ? m[i-1][j-1] : 1 + Math.min(m[i-1][j], m[i][j-1], m[i-1][j-1]);
  return m[a.length][b.length];
}

function areSame(a, b) {
  const nA = normalize(a).replace(/^(el|la|los|las|un|una)\s+/, '');
  const nB = normalize(b).replace(/^(el|la|los|las|un|una)\s+/, '');
  if (nA === nB) return true;
  return nA.length >= 5 && nB.length >= 5 && levenshtein(nA, nB) <= 1;
}

async function calculateRoundScores(answers, letter, comboLetter, bastaPid) {
  const pids = Object.keys(answers);
  const scores = {}, details = {};
  if (!pids.length) return { scores, details };

  let cats = [];
  for (const pid of pids) { const c = Object.keys(answers[pid] || {}); if (c.length > cats.length) cats = c; }
  if (!cats.length) return { scores, details };

  for (const pid of pids) { scores[pid] = {}; details[pid] = {}; }

  // Format check - minimum 2 chars (allows U2, Go, etc)
  for (const cat of cats) for (const pid of pids) {
    const a = (answers[pid]?.[cat] || '').trim();
    if (!a) { details[pid][cat] = { answer: '', status: 'empty', base: 0, combo: 0, total: 0 }; continue; }
    if (normalize(a).length < 2) { details[pid][cat] = { answer: a, status: 'invalid', base: 0, combo: 0, total: 0, reason: 'Mínimo 2 caracteres' }; continue; }
    if (!startsWithLetter(a, letter)) { details[pid][cat] = { answer: a, status: 'invalid', base: 0, combo: 0, total: 0, reason: 'Letra incorrecta' }; continue; }
    details[pid][cat] = { answer: a, status: 'pending_ai', base: 0, combo: 0, total: 0 };
  }

  // AI
  const ai = await validateRound(answers, cats, letter);
  for (const cat of cats) for (const pid of pids) {
    const d = details[pid][cat];
    if (d.status !== 'pending_ai') continue;
    const r = ai[`${cat}|||${d.answer.toLowerCase()}`];
    if (r && !r.valid) { d.status = 'invalid'; d.reason = r.reason || 'Rechazada'; d.validatedBy = 'IA'; }
    else { d.status = 'pending_score'; d.validatedBy = 'IA'; }
  }

  // Unique vs repeated
  for (const cat of cats) {
    const valid = {};
    for (const pid of pids) if (details[pid][cat].status === 'pending_score') valid[pid] = details[pid][cat].answer;
    for (const pid of pids) {
      const d = details[pid][cat];
      if (d.status !== 'pending_score') { scores[pid][cat] = 0; continue; }
      let unique = true;
      for (const o of pids) if (o !== pid && valid[o] && areSame(d.answer, valid[o])) { unique = false; break; }
      d.base = unique ? 10 : 5;
      d.combo = comboLetter && containsCombo(d.answer, comboLetter) ? 10 : 0;
      d.status = unique ? 'unique' : 'repeated';
      d.total = d.base + d.combo;
      scores[pid][cat] = d.total;
    }
  }

  // Basta penalty
  if (bastaPid) {
    const pid = String(bastaPid);
    if (details[pid]) {
      const empty = cats.filter(c => details[pid][c]?.status === 'empty').length;
      if (empty > 0) { scores[pid]._penalty = -10; details[pid]._basta_penalty = { emptyCount: empty, penalty: -10 }; }
    }
  }

  return { scores, details };
}

function totalScore(s) { let sum = 0; for (const v of Object.values(s)) if (typeof v === 'number') sum += v; return sum; }

module.exports = { normalize, startsWithLetter, containsCombo, areSame, calculateRoundScores, totalScore };
