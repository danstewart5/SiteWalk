export type PipelineStage = {
  id: string;
  stage: string;
  happens: string;
  owner: string;
  docs: string;
  stalls: string;
  tools: string;
  draft: boolean;
};

export type PipelineQuestion = {
  id: string;
  question: string;
  answer: string;
};

export const DEFAULT_PIPELINE_QUESTIONS: PipelineQuestion[] = [
  {
    id: "killers",
    question:
      "Which of these stages has actually killed deals or blown timelines across the ~300-home work?",
    answer: "",
  },
  {
    id: "vendors",
    question:
      "Where do outside people get leaned on (lawyers, agents, lenders) — names, and would any sit as a preferred vendor in the app?",
    answer: "",
  },
  {
    id: "city",
    question:
      "Calgary vs Victoria: which city is the land pipeline for first, and what’s a typical permit wait in that municipality?",
    answer: "",
  },
  {
    id: "packet",
    question: "What’s the one packet of paperwork that should be pre-filled every single time?",
    answer: "",
  },
  {
    id: "zoning",
    question:
      "For “price the house” / zoning lookup: where do we need real city data vs a rough first-pass estimate?",
    answer: "",
  },
];

export const PIPELINE_QUESTIONS = DEFAULT_PIPELINE_QUESTIONS.map((q) => q.question);

export const DEFAULT_PIPELINE: PipelineStage[] = [
  {
    id: "source",
    stage: "Land sourcing",
    happens:
      "Scout lots and assemblies: MLS, off-market, stale listings, municipal surplus. Check frontage, services, slope, and whether it actually pencils before anyone writes an offer.",
    owner: "Boss (dev) — Danno flags field constraints if it’s an infill beside an active job.",
    docs: "Title search, site survey if it exists, tax roll, utility atlas, old permits.",
    stalls: "Wrong lot shape / no lane / services too far. Time wasted chasing land that never works.",
    tools: "Realtor feed, driving the area, city map. Not in SiteWalk yet.",
    draft: true,
  },
  {
    id: "offer",
    stage: "Land purchase / offer",
    happens:
      "Offer with subjects: financing, due diligence, environmental, and permit feasibility. Deposit, dates, and who pays for what get written in here.",
    owner: "Boss + lawyer. Danno not in this loop unless it’s a lot next to a job already running.",
    docs: "APS / contract of purchase, subject removal checklist, deposit receipt.",
    stalls: "Subject dates too tight. Seller won’t extend while the city is slow.",
    tools: "Lawyer / realtor. Email and PDF.",
    draft: true,
  },
  {
    id: "finance",
    stage: "Financing / lender approval",
    happens:
      "Construction loan or draw facility. LTC, budget, appraisal, personal covenant. Draw schedule has to match how the house is actually built.",
    owner: "Boss + lender / broker. Super provides budget reality from the field.",
    docs: "Pro forma, appraisal, corporate docs, insurance binder, draw schedule.",
    stalls: "Appraisal comes in light. Lender wants more equity. Draws lag the trades.",
    tools: "Bank portal, broker, spreadsheets. Preferred-lender list is a later SiteWalk add.",
    draft: true,
  },
  {
    id: "zoning",
    stage: "Zoning check",
    happens:
      "Confirm zone, OCP/ASP, setbacks, height, FSR/FAR, parking, suites. Flag if it needs a variance or rezoning before design goes too far.",
    owner: "Boss / designer. Confirm with city planner, not a forum post.",
    docs: "Zoning bylaw extract, site plan overlay, any existing variances.",
    stalls: "Assuming the listing’s zoning is current. Infill rules changed and nobody re-checked.",
    tools: "City zoning map. “Price the house” in Chapter 6 should hook real city data here — confirm how rough is good enough for v1.",
    draft: true,
  },
  {
    id: "permit-app",
    stage: "Permitting application",
    happens:
      "Building permit (and development permit if needed): architectural, structural, energy, civil, truss layouts. Incomplete packages bounce.",
    owner: "Designer / coordinator. Danno reviews constructability before it goes in.",
    docs: "Full BP set, energy model, engineers’ letters, fees, owner authorization.",
    stalls: "Missing details. Truss shop drawings late. Energy path not decided (prescriptive vs performance).",
    tools: "City e-apply portal. Email. This is the packet that should be a checklist in the app.",
    draft: true,
  },
  {
    id: "permit-wait",
    stage: "Permit approval wait",
    happens:
      "File sits in municipal queue. Comments come back in rounds. Meanwhile carrying cost on the land.",
    owner: "City owns the clock. Boss / designer answers comments. Super stays off the site until BP is in hand.",
    docs: "Comment letters, resubmittals, fee invoices.",
    stalls: "This is usually the longest quiet stall. Victoria/CRD wait vs Calgary wait — ask which city this pipeline is for and what “normal” months looks like.",
    tools: "City portal status. Calendar. Not automated.",
    draft: true,
  },
  {
    id: "design",
    stage: "Design / architectural",
    happens:
      "Floor plans, elevations, structural, HVAC/plumbing/electrical rough intent, interior package. Owner changes after permit are change orders later.",
    owner: "Architect / designer. Boss signs. Danno should see a constructability pass.",
    docs: "Permit set vs “issued for construction.” Interior finish schedule, cabinet shop drawings (already a SiteWalk submittal type).",
    stalls: "Owner keeps changing kitchens. Structural doesn’t match the architectural roof.",
    tools: "Designer CAD. SiteWalk submittals for shop drawings once we’re in the ground.",
    draft: true,
  },
  {
    id: "precon",
    stage: "Pre-construction / trade lineup",
    happens:
      "Bid or repeat-crew lineup: sitework, concrete, framing, roof, windows, mech/elec/plumb, drywall, finishing. Lock scope and allowances.",
    owner: "Danno runs the lineup. Boss signs dollars.",
    docs: "Bid compare, scopes, COIs, WCB, contracts / POs.",
    stalls: "Cheap bid with holes in the scope. Crew not actually available the week we need them.",
    tools: "SiteWalk trade directory + routing (Chapter 4) is the field end of this. Preferred vendor list (cabinets, tubs, lawyer, lender) starts here.",
    draft: true,
  },
  {
    id: "break",
    stage: "Ground-breaking",
    happens:
      "Locates, demo/strip, excavation, services, footings. First inspection is usually forming/rebar or underground.",
    owner: "Danno + sitework / concrete. City inspector.",
    docs: "BP posted on site, locates, engineered footing sizes, survey pins.",
    stalls: "Utilities late. Ground water. Inspector no-show. Working without the card in the window.",
    tools: "SiteWalk daily log, GPS clock-in, safety. Camera walk for existing conditions.",
    draft: true,
  },
  {
    id: "build",
    stage: "Framing → rough-in → finishing",
    happens:
      "Frame, roof, windows, mech/elec/plumb rough, insulation, drywall, then finish trades. This is where SiteWalk already lives day to day.",
    owner: "Danno. Trades execute. Boss on money and owner changes.",
    docs: "RFIs, change orders, submittals, punch, safety, daily log — all in SiteWalk now.",
    stalls: "Material lead times, incomplete rough, unpaid extras, inspection fails that cascade.",
    tools: "SiteWalk (walk camera, RFIs, punch, COs, trade texts, report).",
    draft: true,
  },
  {
    id: "inspect",
    stage: "Inspections",
    happens:
      "Typical sequence: underground / footing, framing, insulation/vapour, final. Book ahead; fail once and the whole schedule slides.",
    owner: "Danno books. City inspects. Trade fixes.",
    docs: "Inspection requests, fail notes, re-inspection.",
    stalls: "Calling it in before the trade is actually ready. That’s a SiteWalk punch/safety problem as much as a city problem.",
    tools: "City book-it line/portal. SiteWalk punch + daily log to prove we’re ready.",
    draft: true,
  },
  {
    id: "close",
    stage: "Occupancy / closing",
    happens:
      "Final inspection, occupancy/completion certificate, lawyer closing, keys, deficiency list that follows the owner in.",
    owner: "Boss + lawyer. Danno walks the deficiency list.",
    docs: "Occupancy, New Home Warranty enrollment (if it applies), as-builts, manuals, keys.",
    stalls: "One leftover inspection. Warranty paperwork. Owner punch that never ends.",
    tools: "SiteWalk punch list is the deficiency log. Closing is still lawyer.",
    draft: true,
  },
  {
    id: "payout",
    stage: "Invoicing / final payout",
    happens:
      "Holdbacks, final draws, trade payouts, deficiency holdback release. Don’t pay 100% against an open punch list.",
    owner: "Boss / bookkeeper. Danno signs that the work is actually done.",
    docs: "Progress claims, holdback ledger, lien waivers, final CO list.",
    stalls: "Paying a trade before punch is closed. Draw documentation the lender won’t accept.",
    tools: "Accounting software. SiteWalk punch + change orders should feed this later — not built yet.",
    draft: true,
  },
];
