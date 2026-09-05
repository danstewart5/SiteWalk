import { TRADES, type WalkNote } from "./types";

const CHATTER =
  /^(yeah|yep|yup|ok|okay|uh|um|hmm|hold on|one sec|thanks|thank you|right|got it|hello|hey|sure|alright|all right)\.?$/i;

export function parseWalkSpeech(text: string): { tag: WalkNote["tag"]; trade: string } {
  const t = text.toLowerCase();
  const trade = TRADES.find((tr) => t.includes(tr.toLowerCase())) || "General";
  let tag: WalkNote["tag"] = "Note";
  if (/\brfi\b|request for info|need a decision/.test(t)) tag = "RFI";
  else if (/safety|hazard|near[- ]miss|injury|unsecured/.test(t)) tag = "Safety";
  else if (/change order|\bextra work\b|owner wants|add pot/.test(t)) tag = "Change";
  else if (/daily log|weather|crew of|delay/.test(t)) tag = "Log";
  else if (/punch|deficient|touch[- ]up|missing|fix this|caulk/.test(t)) tag = "Punch";
  return { tag, trade };
}

/** Drop chatter / short asides so talking to a sub doesn't become a punch item. */
export function shouldFileUtterance(text: string) {
  const t = text.trim();
  if (t.length < 10) return false;
  if (CHATTER.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  const parsed = parseWalkSpeech(t);
  if (parsed.tag !== "Note") return words.length >= 3;
  if (parsed.trade !== "General") return words.length >= 4;
  return words.length >= 6;
}
