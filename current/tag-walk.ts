import { TRADES, type WalkNote } from "./types";

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
