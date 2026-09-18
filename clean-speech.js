// Strips filler and mumble from raw speech. Does NOT strip words that
// carry meaning on a job site (right, left, well, so).
const FILLER = /\b(um|uh|er|ah|like|you know|i mean|basically|actually|literally|okay|ok|yeah|yep|yup|got it|hold on|one sec|thanks|thank you|alright|all right|hmm|mhm|uh-huh)\b/gi;

function cleanSpeech(text) {
  if (!text) return '';
  let t = String(text).replace(/\s+/g, ' ').trim();
  t = t.replace(FILLER, '');
  t = t.replace(/\s+/g, ' ').trim();
  // leftover punctuation after a stripped filler: "Um, the wall" → ", the wall"
  t = t.replace(/^[,.\s]+|[,.\s]+$/g, '');
  t = t.replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/\s+/g, ' ').trim();
  return t;
}

// Returns null when the utterance is chatter. Short punch items like
// "Fix outlet" / "Patch drywall" must survive.
function summarizeNote(text) {
  const clean = cleanSpeech(text);
  if (!clean || clean.length < 6) return null;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

if (typeof module !== 'undefined') module.exports = { cleanSpeech, summarizeNote };
