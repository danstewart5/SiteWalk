/* ---------- Voice value-add: punch, cost, safety from speech ---------- */
// Keyword tables and the rough cost tally used by the walk's transcript
// filter. Punch items and safety entries are filed by walk.js, not here.

const PUNCH_TRIGGER_RE = /\b(fix|repair|replace|patch|touch[- ]?up|needs? (?:to be )?(?:fixed|repaired|replaced|done)|punch (?:list|item)|add (?:a |this |that )?to (?:the )?punch)\b/i;
const COST_RE = /\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*(k|thousand)?/gi;
const SAFETY_WORDS = {
  high:   ['fall hazard','fall risk','unguarded','no guard','exposed wiring','live wire','arc flash','collapse','trench','excavation','no ppe','missing ppe','no hard hat','no harness'],
  medium: ['trip hazard','slippery','wet floor','debris','clutter','blocked exit','no signage','missing sign','sharp edge','protruding'],
  low:    ['housekeeping','clean up','sweep','organize','label','tag out']
};
const SAFETY_SEVERITY = { high: 'High', medium: 'Medium', low: 'Low' };

function currentTrade() {
  return (tradeSelect && tradeSelect.value) ? tradeSelect.value : 'General';
}

function tallyCostFromVoice(text) {
  let total = 0, m;
  COST_RE.lastIndex = 0;
  while ((m = COST_RE.exec(text)) !== null) {
    let n = parseFloat(m[1].replace(/,/g, ''));
    if (m[2]) n *= 1000;
    total += n;
  }
  if (total <= 0) return 0;
  const stamp = nowStamp();
  const entry = { text: text, amount: total, trade: currentTrade(), ts: stamp.ts, time: stamp.time, iso: stamp.iso, source: 'voice' };
  if (typeof pushToCurrentWalk === 'function') pushToCurrentWalk('costs', entry);
  budget.materials = (budget.materials || 0) + total;
  persistBudget();
  if (typeof renderJobCost === 'function') renderJobCost();
  setWalkStatus('info', 'Rough cost +$' + total.toLocaleString());
  return total;
}

// Severity of a spoken hazard by keyword, or null. Used by the transcript
// filter (walk.js assessUtterance) to decide whether a sentence is a real
// safety observation, and by logSafetyFromVoice to stamp the severity on
// the one Safety Log entry it creates.
function safetySeverity(text) {
  const lower = String(text || '').toLowerCase();
  for (const level of ['high', 'medium', 'low']) {
    for (const w of SAFETY_WORDS[level]) {
      if (lower.indexOf(w) !== -1) return { level: level, severity: SAFETY_SEVERITY[level], matched: w };
    }
  }
  return null;
}

// Runs only for sentences the transcript filter has already accepted as
// items (walk.js handleSpokenUtterance / promoteReviewItem), so a dollar
// figure in small talk never lands in the job budget. Punch items and
// safety entries are no longer created here — fileVoiceUtterance files
// them once, in the shared punch/change-order and Safety Log shapes.
function processVoiceValue(text) {
  if (!text) return;
  tallyCostFromVoice(text);
}
