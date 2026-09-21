/* ---------- Voice value-add: punch, cost, safety from speech ---------- */
// Hooks into the existing speech transcript. Call processVoiceValue(text)
// from wherever the live transcript is handled (e.g. recognition.onresult).
// Creates punch items, tallies rough cost, and flags safety hazards by
// keyword — all stored in the same localStorage shape as the rest of the app.

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

function addPunchFromVoice(text) {
  const entry = {
    text: text.replace(PUNCH_TRIGGER_RE, '').trim() || text,
    trade: currentTrade(),
    ts: Date.now(),
    time: new Date().toLocaleString(),
    resolved: false,
    source: 'voice'
  };
  punch.push(entry);
  persistLists();
  if (typeof tryLinkItemToRecentPhoto === 'function') tryLinkItemToRecentPhoto(entry);
  if (typeof renderAllItems === 'function') renderAllItems();
  if (typeof renderSummary === 'function') renderSummary();
  setWalkStatus('ok', 'Punch item added');
  return entry;
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
  budget.materials = (budget.materials || 0) + total;
  persistBudget();
  if (typeof renderJobCost === 'function') renderJobCost();
  setWalkStatus('info', 'Rough cost +$' + total.toLocaleString());
  return total;
}

function flagSafetyFromVoice(text) {
  const lower = text.toLowerCase();
  let sev = null, matched = null;
  for (const level of ['high', 'medium', 'low']) {
    for (const w of SAFETY_WORDS[level]) {
      if (lower.indexOf(w) !== -1) { sev = level; matched = w; break; }
    }
    if (sev) break;
  }
  if (!sev) return null;
  const entry = {
    text: text,
    trade: currentTrade(),
    ts: Date.now(),
    time: new Date().toLocaleString(),
    severity: SAFETY_SEVERITY[sev],
    matched: matched,
    source: 'voice'
  };
  safetyLogs.push(entry);
  persistSafety();
  if (typeof renderSafety === 'function') renderSafety();
  if (typeof renderSummary === 'function') renderSummary();
  setWalkStatus('err', 'Safety: ' + SAFETY_SEVERITY[sev] + ' — ' + matched);
  return entry;
}

function processVoiceValue(text) {
  if (!text) return;
  if (PUNCH_TRIGGER_RE.test(text)) addPunchFromVoice(text);
  tallyCostFromVoice(text);
  flagSafetyFromVoice(text);
}

// Example hook — wire this into your existing recognition.onresult:
// recognition.onresult = function (e) {
//   const t = e.results[e.results.length - 1][0].transcript;
//   logNote(t, currentTrade());          // existing
//   processVoiceValue(t);                // new
// };
