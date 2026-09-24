# SiteWalk — current snapshot (for Claude and Grok)

Two public links (no login):

- **App (phone):** Netlify, https://sitewalk-app.netlify.app (per `ALLOWED_ORIGINS` in `ai-backend/worker.js`). The GitHub Pages copy at https://danstewart5.github.io/SiteWalk/ also serves `main` while the repo is public.
- **Source:** this repo (no build step; both hosts serve `main` as-is).

**Live phone app** is root `index.html` + `walk.js` + `sw.js`, plus `ai-backend/worker.js` (Cloudflare Worker). That's it — the whole app is one HTML file and one JS file, no framework, no build.

`current/` is a parked TypeScript/React snapshot. No build script or Pages workflow reads it. It will go stale relative to `index.html` — do not "sync" changes into it unless someone is reviving that tree on purpose.

Do not use Grok sandbox preview URLs.

## What the live app actually does (as of 2026-09-19)

**Start Walk-Around is the only entry point — there is no mode picker.** An earlier note in this file (below, now corrected) described a video-walk/photo-only mode split as "landed in live app" at cache `sitewalk-v42`; that was wrong — no mode-picker code (`swWalkMode`, `captureWalkStill()`, etc.) was ever actually written to `index.html`/`walk.js`, only this file described it. The actual product decision, made the same day, superseded that split anyway: one always-on walk engine, no picker. Camera preview, mic, live speech-to-text, voice-triggered snap, and punch-list tagging all start together on **Start Walk-Around** and stay on together until **Stop**, every time.

The one real optional control is **"Also save a video of this walk"** (checkbox above the Start button, persisted in `swSaveVideoEnabled`) — when on, a continuous video (camera + a separate mic track) records for the whole session and is handed to the user via the OS share sheet (`navigator.share`) or a browser download as `sitewalk-video-<timestamp>.webm`/`.mp4` when the walk ends. This is a real, working save, not a placeholder.

Saying a trigger phrase ("take a photo", "snap a photo", "get a picture of this", "photo this/that" — see `SNAP_TRIGGER_RE` in `walk.js`) grabs a still from the live `<video>` frame via `voiceTriggeredSnap()`. That function only reads canvas pixels from the existing feed — it never calls `stop()` on any track, never re-calls `getUserMedia`, and never touches `recognition`, so a snap cannot interrupt or restart continuous listening. A 1.5s cooldown (`lastSnapTriggerAt`) guards against a browser firing one `onresult` final result twice for the same utterance. If the trigger phrase is embedded in a longer sentence, the remainder (with the phrase stripped) still goes through normal punch/change/RFI classification via `fileVoiceUtterance`. Every photo (voice-triggered, Snap-button, or uploaded) carries `ts`, `trade`, `source` (`voice`/`manual`), and — for voice snaps — `transcriptText`, so a still can be matched back to what was being said; the existing 60s photo↔item linking window (`tryLinkPhotoToRecentItem`/`tryLinkItemToRecentPhoto`) still does the punch-list matching.

Tap **End Walk** / Stop to finish. **Generate Summary** jumps to the Walk Summary sub-tab.

**Nav restructured to a Home dashboard, 2026-09-19** — went through three revisions same day, each pasted as a full brief and each superseding the last before the previous one was even reported back: (1) flat accordion list of four Procore-style blocks, (2) flat accordion list of seven pillars, (3) **current, cache `sitewalk-v49`** — a moody dark-wood-paneled landing *scene* (`.home-scene` in `index.html`) with a central glowing green "Start Walk-Around" pill button (`#homeStartWalkBtn`, moss green `#4CAF6E`), seven pillars arranged radially around it as literal architectural-column shapes (`.home-pillar[data-block="land|preconstruction|design|field|scheduling|safety|financial"]`, positioned via `--angle`/`--radius` CSS custom properties and a `rotate(θ) translate(r,0) rotate(-θ) translate(-50%,-50%)` transform — 0deg = 3 o'clock, so `--angle:-90deg` is the top; the trailing `translate(-50%,-50%)` centres each pillar regardless of label height (fixed 2026-09-22, cache `sitewalk-v56` — before that, pillars were a quarter-turn off and unevenly offset). **The ring is a dial** (2026-09-22, cache `sitewalk-v58`): a `.home-dial` face (rim, groove, one tick per pillar slot) under the pillars turns with them; drag anywhere on `.home-pillars` to rotate via a `--spin` offset added to every pillar's angle, with momentum on release, or tap `#homeDialLeft`/`#homeDialRight` to step one pillar (360/7°). It always snaps so a pillar sits at 12 o'clock under the fixed `.home-dial-pointer` above the Start button (IIFE after the pillar click wiring in `walk.js`); the held pillar gets `.pressed` (scale 1.45 + copper glow). A plain tap still opens the drilldown; a drag swallows the click. No pointer capture — it would retarget the click off the pillar. `.home-pillars` is `touch-action: none`, so a vertical swipe starting on the ring spins it instead of scrolling the page. Pillar `:hover` styles sit behind `@media (hover: hover)` because phones leave hover stuck on the last-touched pillar, each scaling up via `.pillar-visual` on hover/touch), a black-framed "window" showing `assets/photos/hero-framing.jpg`, and a sharp-cornered gold `#e0a94a` "Generate Report" button (`#homeGenerateReportBtn`) — both quick-action buttons fire immediately (`showTab('walk')`+`window.startWalk()`, `showTab('report')`+`window.generateReport()`) without entering a pillar first, unchanged from the two earlier revisions. Don't resurrect either earlier version if it turns up in scrollback.

Tapping any `.home-pillar`, or the small `#homeMoreLink` ("⋯ More") link at the bottom of the scene, calls `openHomeDrilldown(block)` in `walk.js`: adds `.showing-drilldown` to `#tab-home` (CSS then hides `.home-scene` and shows `.home-drilldown`) and expands only the matching `.home-block[data-block=...]` (or none, for the More link). `.home-drilldown` holds the exact same seven `.home-block` accordions + `.home-admin` section from the earlier revisions, unchanged — `.home-chapter-btn[data-tab]`/`.home-admin-btn[data-tab]` still just call the pre-existing `showTab(name)` against the same `tab-*` panels below, nothing about the panels themselves ever changed across any revision. `#homeDrilldownBack` removes `.showing-drilldown` to return to the scene. `disabled` chapter buttons with no `data-tab` (Land Acquisition, Ch.6 Land-to-Contract Pipeline/Victoria Land, Ch.9 Price-the-House, Ch.7 Consulting Business Rollout, Ch.8 Developer Dashboard; Ch.5 Invoicing went live 2026-09-23) are placeholders — none of that functionality exists in the live app; Ch.6/Ch.9's real reference material is the parked `current/pipeline.ts`/`pipeline-view.tsx`, not anything live.

**Not yet phone-tested** — this session had no browser automation available, so the radial pillar layout (`--radius: min(33vw, 132px)` on a `min(84vw, 360px)` stage) was sized by arithmetic against common phone viewport widths, not verified by an actual render. If pillars look clipped, overlapping the center button, or misaligned on a real device, that's the first thing to check.

Pillar mapping (chapter numbers are the user's own external roadmap numbering, not something derived from this repo; RFIs/Change Orders/Submittals/Drawing Refs/Drawings/Daily Log/Job Cost/Dashboard/Report/Setup aren't individually chapter-numbered by the user — placement below is this session's judgment call, not dictated by the brief):
1. **Land & Acquisition** — Land Acquisition (placeholder) + Ch.6 Land-to-Contract Pipeline/Victoria Land (placeholder)
2. **Preconstruction & Estimating** — Ch.3 Punch List & Estimating (`punch`, live — punch list only, no estimating tool yet) + Ch.9 Price-the-House (placeholder)
3. **Design & Drawings** — Drawing References (`drawingrefs`, live) + Drawings & Plans (`drawings`, live) + Submittals (`submittals`, live)
4. **Field Operations & Walk-Around** — Ch.1 Walk-Around (`walk`, live) + RFIs (`rfis`, live)
5. **Scheduling & Resources** — Ch.2 GPS Clock-In (`clock`, live: manual clock in/out + foreground-only GPS auto clock, background tracking still parked, see below) + Ch.4 Trade Routing (`contacts`, live only as manual per-trade email/SMS contacts — the real routing engine, `routeItem`, is still parked in `current/routing.ts`) + Daily Log (`dailylog`, live)
6. **Safety & Quality** — Safety Log (`safety`, live)
7. **Financial Management & Invoicing** — Ch.5 Invoicing (`invoices`, live since 2026-09-23, see below) + Job Cost Dashboard (`jobcost`, live — budget vs actual, not literal invoicing) + Change Orders (`changes`, live)

Outside the seven pillars, admin/overview layer — Ch.7 Consulting Business Rollout (placeholder) + Ch.8 Developer Dashboard (placeholder, distinct from the live Open Items Dashboard) + Open Items Dashboard (`dashboard`, live) + Report (`report`, live) + Setup (`setup`, live)

The chapter tab-panels themselves are otherwise unchanged — five functional groupings (Walk/Items/Time/Board/Setup) still describes what each panel does, it's just reached through Home → block → chapter now instead of a flat always-visible nav row:

- **🎥 Walk** — Start Walk-Around (camera, voice, live trade tag, voice-triggered + manual Snap, optional video-save, photo gallery)
- **✅ Items** — Punch List (now with a Resolved toggle), Change Orders (client approve/decline), RFIs (Open/Answered), Submittals (Pending/Approved), Safety Incident/Near-Miss Log (type, description, person involved, corrective action, optional photo)
- **⏱ Time** — manual Clock In/Out (flags anyone clocked in 16+ hours with no clock-out) + Daily Log (date, weather, crew count, trades on site, delays, notes)
- **📊 Board** — Open Items Dashboard, live-computed from the actual in-app arrays (not a separate page, not stale)
- **⚙️ Setup** — Trade Contacts (email/SMS per trade — opens the phone's own Mail/Messages), AI Worker Setup (Worker URL + optional shared key), Report (generate/print, rolls up everything above by trade)

Every item type persists to `localStorage` under real, live keys (see `LS` object at the top of `walk.js`): `swPunch`, `swChanges`, `swRfis`, `swSubmittals`, `swClockEvents`, `swDailyLogs`, `swSafety`, `swPhotos`, `swTradeContacts`.

All eight of the original "File N of 7/8 — INSTRUCTIONS FOR GROK" standalone module snippets (RFI, Daily Log, Submittals, Safety, Dashboard, Trade Directory, GPS Clock-In, Firebase Backend) are now resolved one way or another: RFI/Daily Log/Submittals/Safety/Dashboard are merged into the live app above; GPS geofencing and Firebase sync are explicitly parked (see below), not abandoned by accident. `trade-directory-module.html` was deleted — it never contained real content (the file body was just the placeholder string `content1`), and the practical need is already covered live by Setup's manual Trade Contacts email/SMS.

## Decision — single always-on walk engine, no mode split (2026-09-19, supersedes an earlier same-day mode-split note)

Earlier the same day, a note here proposed a video-walk-vs-photo-only mode picker with two audio policies. **That decision was reversed before any of it was built** — the actual requirement is one walk engine for every session: camera, mic, live speech-to-text, voice-triggered snap, and punch-list tagging are all always on together, no picker. Do not reintroduce a mode split without being asked again.

**Status: built and pushed 2026-09-19** (`index.html` + `walk.js` + `sw.js`, cache `sitewalk-v43`) — needs a real phone test (Android Chrome + iOS Safari) to confirm voice snap doesn't interrupt listening and that video-save actually produces a usable file, per the isolation/testing notes below (not yet phone-tested by an agent session).

What shipped:

- **Trigger-phrase snap** — `SNAP_TRIGGER_RE` in `walk.js` matches phrases like "take a photo" / "snap a photo" / "get a picture of this" inside a finalized (not interim) Web Speech transcript. A 1.5s cooldown (`lastSnapTriggerAt`) absorbs duplicate `onresult` firings for one utterance. If real content remains after stripping the trigger phrase, it's still filed normally through `fileVoiceUtterance`.
- **Isolation** — `voiceTriggeredSnap()` only does a `canvas.drawImage` grab off the existing `<video>` element (via `snapFromVideo`); it never calls `stop()` on a track, never re-calls `getUserMedia` for the camera, and never touches `recognition`. Continuous listening's own `onend` restart loop is untouched by a snap.
- **Structured photo metadata** — `saveWalkPhoto(src, meta)` now takes an optional metadata object; every photo gets `source` (`'manual'` or `'voice'`) and voice snaps additionally get `transcriptText` (the full utterance that triggered them), on top of the pre-existing `ts`/`trade`/`time`. The existing 60-second bidirectional photo↔punch-item linking (`tryLinkPhotoToRecentItem`/`tryLinkItemToRecentPhoto`) is unchanged and still does the item-matching.
- **Real video-save** — a checkbox ("Also save a video of this walk", `#saveVideoToggle`, persisted in `swSaveVideoEnabled`) opts into `MediaRecorder` on the walk's existing camera track plus a *separate* `getUserMedia({audio:true})` track (kept independent from whatever SpeechRecognition is doing internally, since the Web Speech API never exposes its own mic as a `MediaStream`). On Stop, the recorder finalizes to a `Blob` and `saveVideoFile()` hands it to the user via `navigator.share` (files) when available, falling back to a plain `<a download>` blob-URL click. Filename: `sitewalk-video-<ISO timestamp>.<mp4|webm>`.

Not done / worth knowing:

- No haptic/beep/flash acknowledgment on a voice snap yet (status-line text only, via `setWalkStatus`).
- No dedicated on-device keyword spotter — still riding the browser's own continuous Web Speech transcript, which is inherently the noisier/higher-latency option the earlier review note warned about. If false-triggers turn out to be a real field problem, that's the next lever to pull.
- iOS Safari's `navigator.share`/download-blob support for video files specifically hasn't been phone-verified in this session (browser automation wasn't available) — confirm on an actual iPhone before relying on it.

## Transcript filter, review bucket, inline-photo report (2026-09-23, cache `sitewalk-v68`)

**walk.js was restored first.** Commit `85db471` replaced `walk.js` with a 27-line stub that loaded the real file from jsDelivr (`cdn.jsdelivr.net/gh/danstewart5/SiteWalk@7e9d633/walk.js`) and patched `endWalk`. That breaks the moment the repo goes private, and it depends on a third-party CDN. The full file is back (from `a0d24b5`). Don't reintroduce a CDN loader for app code.

- **One capture path.** Every final sentence (continuous recognition and the push-to-talk fallback) goes through `handleFinalUtterance()`: it is logged word for word with `logTranscript()` (notes log + the walk's `transcript`, each line has an `id` and an `outcome`), then the snap trigger is handled, then `fileVoiceUtterance()` classifies the rest.
- **Filter.** `scoreUtterance()` (local) returns `high` (file it), `low` (Review bucket) or `none` (transcript only). Safety keywords → Safety & Quality log (`Hazard Observed`); code/spec/inspection keywords → same log as `Quality Issue`. With a Worker URL set, `/classify` now returns `isItem`, `confidence`, `location`, `costImpact` (any type) and `type` can be `safety`/`quality`; `mergeAiClassification()` files at confidence ≥ 0.6, sends lower confidence to Review, and sends AI-vs-keyword disagreements to Review. An older Worker without `isItem` still works (local filter decides). **The Worker must be redeployed** to get the new fields.
- **Review bucket.** `reviewItems`, job-scoped LS `swReview`, shown on the Walk → Review sub-tab (count badge). Each card: Punch / Change Order / RFI / Safety / Quality / Not an item. Filing keeps the original timestamp and photos and updates the transcript line's outcome.
- **Shared item schema** (`fileEntry()`): `trade`, `location` (AI or `extractLocation()`), `costEstimate` (AI or `parseSpokenCost()`, punch and CO), `drawingRef`, `itemType` (`punch`/`change_order`/`rfi`) + `isChangeOrder`, `photos[]` (`photo` = first, kept for old data), `via` (`voice`/`manual`/`review`), `transcriptId`. Spoken costs no longer go into `budget.materials`.
- **voice-value-add.js deleted.** It ran on every sentence after `fileVoiceUtterance` and created a second punch item, added spoken dollar amounts to the materials *budget*, and wrote safety entries in a shape the Safety tab couldn't render. Its jobs are now done once, inside the pipeline above.
- **Photos.** Items hold several photos. A photo links to the most recent item (punch/CO/RFI/safety/review) filed in the last 60 s, even if it already has photos; an item links all unlinked photos from the 60 s before it. "Take a photo" inside an issue sentence holds the photo (`holdForId`) for the item from that same sentence.
- **Report is manual only.** `endWalk()` no longer switches tabs or generates the report; it stays on the Walk tab. Generate Report buttons: Walk screen (new), Report tab, Home gold button. The report lists Punch / COs / RFIs / Safety & Quality / Needs Review with photos inline (one photo beside the item, several as a row of 64px photos), then "Other Photos" (unlinked, captioned with what was being said), the existing submittal/log/invoice/cost sections, and the full walk transcript with each line's outcome at the end.

Tested with headless Chromium at 390px (fake camera): chatter → transcript only, borderline → Review, punch/CO/RFI/safety/quality routing, location + cost at capture, multi-photo linking, voice snap inside an issue sentence, Review → Punch, endWalk stays on Walk, manual report layout, mocked Worker replies (new and old response shapes). No page errors, no horizontal scroll. **Not phone-tested**, and the new Worker prompt hasn't been run against the real API.

## LeaseFlow — Hold mode (shipped 2026-09-22)

A Build/Hold mode toggle (`.home-mode-btn[data-mode]`, persisted `swHomeMode`, applied as `data-home-mode` on `#tab-home`) sits above the home scene, next to a shared flag bar (`#homeFlagBar`, `renderFlagBar()` in `walk.js`) that spans both modes — a red "Units in Arrears" or yellow "Lease Renewal Due Soon" pill is visible without switching modes, same as an open punch item count. The Start Walk-Around / Generate Report buttons are unaffected by the mode switch, per spec.

**Build mode** (default) is the unchanged seven-pillar radial scene. **Hold mode** swaps in seven LeaseFlow pillars (`.home-pillar-hold`) at the same seven angles, with matching drilldown accordions (`.home-block-hold`, gold `#b98430` top border) — CSS hides whichever set doesn't match `data-home-mode`, so this is one shared stage, not a ninth pillar tile.

LeaseFlow chapters, all live except Commercial Extras: **Units & Properties** (`units` tab — Property is root, can be `jobLinked` to the current job-site name/address or stand alone as an acquired rental; Unit belongs to a Property), **Tenants** (`tenants`, its own record, not a generic contact), **Leases** (`leases` — links a Unit + Tenant with start/end/renewal dates, rent amount, residential/commercial type), **Rent & Payments** (`rentroll` — a Payment ledger per lease, a computed rent roll, and a CSV export via `exportRentRollCsv()`), **Arrears & Collections** (`arrears` — a read-only computed list off the same rent-roll math, no collections workflow, no notice-period/RTB handling), **Maintenance & Walk-throughs** (`leasewalk` — "Start Lease Walk" sets `leaseWalkContext` then calls the *same* `window.startWalk()` Chapter-1 engine, no forked camera/mic code; context clears in `window.endWalk()`), **Commercial Extras** (`commercial` — titled/scaffolded only, no working UI, deliberately not built this pass).

Rent roll math (`computeRentRoll()`/`monthsElapsed()` in `walk.js`) is a simple accrual: one month's rent per elapsed month since lease start (the start date's day-of-month is the recurring due day), balance = accrued rent minus logged payments. It's deliberately not a real amortization/proration engine.

Shared schema extension, not a fork: `fileEntry()` now stamps every punch/change/RFI item with `source` (`'lease-walk'` when `leaseWalkContext` is set, else `'job-site'`), `property_id`, and `unit_id`. A lease-walk condition item and a job-site item live in the same `punch`/`changes`/`rfis` arrays, same Chapter 1 engine, distinguished only by these fields.

New LS keys: `swProperties`, `swUnits`, `swTenants`, `swLeases`, `swPayments`, `swHomeMode`. All wired into `clearAllData()` — Setup's Reset App wipes LeaseFlow data too, and there's a new "LeaseFlow Storage Note" section in Setup calling out that everything here is still localStorage/single-device, same known limitation as the rest of the app, not solved this pass.

**Phone-tested:** no — this session tested with headless Chromium + Playwright against a local static server (mode toggle, drilldown, full CRUD flow, rent-roll/arrears math, CSV download, and the Start Lease Walk → Chapter 1 handoff all verified with zero console errors). Real-device verification (especially the radial pillar layout on Hold mode, and that CSV download/share behaves the same as the existing video-save flow) is still outstanding.

## Role views — "View as" (2026-09-22, cache `sitewalk-v61`; reworked 2026-09-23, cache `sitewalk-v63`)

A four-button bar at the top of Home (`.home-role-btn[data-role]`, persisted `swRole`, applied as `data-role` on `#tab-home`): **Admin** (`all`, default), **Manager**, **Bookkeeper**, **Developer**.

**Every role now gets the same wood dial scene**: background, window, Hartwig logo, Build/Hold toggle, dial. This replaced the v61 tile-only dashboard at the user's request.
- **Admin and Manager** use the standard seven Build/Hold pillars, with Start Walk-Around in the centre.
- **Bookkeeper and Developer** get their own seven pillars per mode from `ROLE_DIALS` in `walk.js`. `renderRoleDial()` builds `.home-pillar-role` buttons into `.home-pillars`, at the same seven angles so the dial IIFE works unchanged, plus matching `.home-block-role` drilldown accordions. It sets `data-custom-dial` on `#tab-home`, and CSS then hides the standard pillars and blocks.
- The role dial rebuilds only on a role or mode change. Pillar badges (`.pillar-badge`, red = needs attention) refresh in place via `updateRoleBadges()`, called from `renderRoleView()`/`renderFlagBar()`, so a data change never swaps out a pillar mid-drag.
- Each role/mode also sets the centre button and the gold button (`center`/`report` in the config, run by `runHomeAction()`):
  - **Bookkeeper Build:** Job Cost, Payroll Hours, Flat-Contract Subs, Materials, Change Orders to Bill, Invoicing (live, badge = outstanding $), Reports. Centre button: Log Sub Payment (Job Cost → subs). Gold button: Generate Report.
  - **Bookkeeper Hold:** Rent & Payments, Arrears, Leases, Tenants, CSV Export, Deposits (placeholder), Reports. Centre button: Log Rent Payment. Gold button: Export Rent Roll (CSV).
  - **Developer Build:** All Jobs Overview (dashboard; multi-job rollup is the next phase), Budget vs Actual, Change-Order Exposure, Progress, Land Pipeline (Ch.6 placeholder), Price-the-House (Ch.9 placeholder), Reports. Centre button: Generate Report. Gold button: Open Items Dashboard.
  - **Developer Hold:** Properties & Units, Occupancy, Rent Roll, Arrears, Renewals, Maintenance Walks, Commercial (placeholder). Centre button: Generate Report. Gold button: Rent Roll.
- Drilldown shortcuts can scroll to a section of a tab (`goToTab(tab, scrollId)`), e.g. Flat-Contract Subs inside Job Cost.
- The live KPI tiles (`roleKpis()`, `#homeRoleView`) for any non-Admin role now sit in the drilldown, below the blocks. "⋯ Your numbers & all tools" opens it. `.home-admin` (Setup) stays hidden for non-Admin roles.

**Multiple jobs are live** as of cache `sitewalk-v64`, see the Jobs section below. The Developer "All Jobs Overview" pillar opens that rollup.

**A lens, not access control:** there's no login, and anyone can tap any role. Data is per-device `localStorage`, so role views only become truly useful once cross-device sync (parked Firebase) exists. The Setup backup file is the stopgap.

Tested with headless Chromium at 390px: all four role/mode dials, centre and gold button actions (including the CSV download), pillar → drilldown → tab shortcut, dial stepping on role pillars, persistence across reload, and Admin unchanged. No page errors, no horizontal scroll. Not phone-tested.

## Jobs: job tabs + All Jobs overview (2026-09-23, cache `sitewalk-v64`)

- **Tabs on Home.** A row of job tabs (`#homeJobTabs`, `renderJobTabs()`) sits under the View-as bar: `📊 All Jobs` · one tab per job (current one highlighted) · `+ New Job`. Tapping a job tab saves `swCurrentJob` and **reloads the page** (`switchJob()`). This is blocked while a walk is running. `+ New Job` prompts for a name and optional address.
- **Storage model.** `JOB_SCOPED` in `walk.js` lists the keys that belong to a job: photos, punch, changes, RFIs, submittals, clock events, daily logs, safety, notes, site name/address, materials, budget, drawings, walks, sub contracts, GPS sites. Each job stores them as `key@jobId`. The original job (`id: 'default'`) keeps the plain keys, so upgrading copies nothing; an existing install simply becomes that first job, named from its saved site name.
  - Right after `LS` is defined, the bootstrap rewrites those `LS` entries to the current job's keys. Every existing `persist*`/`loadJson(LS.x)` call therefore works per job without changes.
  - `LS_BASE` keeps the original key names. `jobKey(base, id)` builds a key for any job. `isAppKey(key)` recognizes every app key, including other jobs' copies.
  - Job list: `swJobs` (`[{id, name, address, created}]`). Editing the site name/address in the Walk header renames the job (`persistSiteInfo()`). Clock's site box defaults to the job name.
- **Shared across jobs, not job-scoped:** trade contacts, wage rates (per person), AI Worker setup, role/mode, auto-clock settings and all LeaseFlow data.
- **All Jobs overview** (`tab-jobs`, `renderJobsOverview()`). It shows combined tiles (budget % spent, open punch + RFIs, pending CO $, owed to subs, on the clock) plus one card per job: spend vs budget bar, open items, pending COs, owed to subs, last daily log, and Open / Delete buttons. `jobSummary(job)` reads a job's numbers straight from its stored keys and skips photos. `laborCostByEmployee(events)`/`totalHourlyLaborCost(events)` take an optional event list for this.
  - Reachable from the All Jobs tab, the Developer Build pillar, and Admin's drilldown.
  - Delete removes that job's keys. You can't delete the job you're in.
- **Clear All Data** now wipes every job's keys (any `isAppKey`) and reloads. **Backup** (format 2) now includes every job. Format-1 backups still restore, as the default job.
- Reports, the flag bar, role dials/badges and the Open Items Dashboard all show the **current job**. Only the All Jobs view rolls up across jobs.

Tested with headless Chromium at 390px:
- Upgrade from a pre-jobs install (data lands in the first job, named from its site name)
- New job, rename, switching back and forth (each job's data stays separate; contacts shared)
- Rollup math, Developer pillar badge, delete (no leftover keys)
- Backup with two jobs restored into a fresh browser
- Clear All

No page errors and no horizontal scroll. Not phone-tested.

## Ch.5 Invoicing (2026-09-23, cache `sitewalk-v65`)

`tab-invoices`, reached from Admin's Financial drilldown, the Bookkeeper Build "Invoicing" pillar and "Change Orders to Bill".
- **Storage.** Invoices are **per job** (`swInvoices` is in `JOB_SCOPED`). Business details (`swBusiness`: name, address, contact, GST/HST #, payment terms) and the number sequence (`swInvoiceSeq` → `INV-0001`, …) are shared, so numbers never repeat across jobs.
- **Invoice shape.** `{id, number, date, dueDate (+30 days by default), client {name, email, address}, lines [{desc, qty, rate, coTs?}], taxPct (default 5, then the last invoice's value), holdbackPct (default 0), notes, payments [{amount, date}], sentAt}`. A new invoice copies the last client, tax % and holdback %.
- **Math** (`invoiceTotals()`): subtotal = Σ qty × rate. Tax = subtotal × tax%. Total = subtotal + tax. Holdback = subtotal × holdback%, shown as "released later". **Amount due = total − holdback.** Balance = due − payments. The holdback exists for lien holdbacks but is just a number; there's no release workflow and no tracking of the holdback owed later.
- **Status** (`invoiceStatus()`): Draft (no `sentAt`) → Sent → Part paid / Overdue (sent, balance owing, past due date) → Paid. Drafts are excluded from every outstanding/invoiced total (`invoiceOutstanding()`).
- **Change orders.** "+ Approved COs" pulls every approved, not-yet-invoiced CO in as a line and stamps `invoiceId` on the CO. COs have no id, so the line links back by `coTs` = the CO's `ts`. Removing the line or deleting the invoice clears `invoiceId`, making the CO billable again. `unbilledChangeOrders()` drives the Bookkeeper "Change Orders to Bill" badge and its KPI tile.
- **Output.**
  - Print / Save PDF renders `invoicePrintHtml()` into `#invoicePrint` (outside `.container`) and adds `body.printing-invoice`. Print CSS then shows only that. The class is cleared by the next `showTab()` or the Report print button, **not** on `afterprint` (changed 2026-09-23, cache `sitewalk-v66`): on iOS Safari `window.print()` doesn't block, and `afterprint` can fire before the page is captured, which would print the whole app. The class only matters under `@media print`, so leaving it on while you stay on the Invoices tab is harmless.
  - Email Summary opens a `mailto:` with a plain-text summary (mailto can't attach the PDF) and marks the invoice Sent.
- **Editor behaviour.** Typing updates the invoice object and the totals in place, with no re-render, so focus is kept. On `change`, the list and flag bar refresh.
- **Hooks elsewhere:**
  - Flag bar: red "N Overdue Invoice(s)" pill
  - Bookkeeper KPIs: outstanding on invoices (red if any are overdue), collected on invoices
  - All Jobs: invoiced-to-date and outstanding tiles, plus a per-job invoiced/outstanding line
  - Report: an Invoices section

Tested with headless Chromium at 390px: business details, new invoice, CO import (the CO is marked, then freed on delete), manual line, tax + 10% holdback math, print layout, mark sent, overdue flag, partial payment, Bookkeeper badge/KPIs, All Jobs summary. No page errors, no horizontal scroll. **Still not phone-tested. No agent session can test on a real iPhone** (cloud container, headless Chromium only, no WebKit). When someone has an iPhone, check:
1. In Safari: Invoices → Print / Save PDF. The preview should show only the invoice, not the app.
2. Save as PDF on iOS: in the print sheet, tap Share (or pinch out on the preview), then Save to Files.
3. The same from the **home-screen app** (`manifest.json` is `display: standalone`, plus `apple-mobile-web-app-capable`). Older iOS versions were reported to ignore `window.print()` in standalone web apps. If nothing happens there, open the page in Safari instead, or add a fallback.
4. Two things to look at: long invoices breaking across pages, and whether the gold/grey backgrounds print (iOS drops backgrounds by default).

## Hartwig partner logo (2026-09-22, cache `sitewalk-v60`)

The logo sits just below the framed window photos in the home scene: `<img class="home-logo" src="hartwig-logo.png">` right after `.home-window`, `width: min(64%, 230px)`, `opacity: 0.85` with a drop shadow, so it's softened into the wood but clearly readable. Placement history, all same day, each superseding the last at the user's request: an "In Partnership With" band above the Build/Hold toggle (v55–v58), then a faint soft-light watermark across the pillar dial (v59, too faint to see), then here — don't bring either earlier version back. Copper `#B98A60` is also the active Build/Hold toggle colour and the pillar glow.

**`hartwig-logo.png` is a stand-in**: it was cut out of a JPEG screenshot of the Hartwig landing page (alpha keyed on copper-ness, filled flat `#B98A60`), because no original file was ever supplied — swap in the original transparent PNG when there is one (same filename, no code change).

## Labor cost (hourly + flat contract), GPS auto clock-in, backup file (2026-09-22, cache `sitewalk-v62`)

Direction from the user this pass: keep building the backend but **nothing that needs a Firebase project/account yet**. Subs are a mix of hourly and flat contract. Foreground-only GPS is fine for now, native app later. There's no "audit doc" yet, so don't wait on one.

- **Labor cost, two pay types.** `wages[name]` is now `{type: 'hourly'|'contract', rate}`. `wageFor()` still reads the old bare-number form as hourly, so existing data needs no migration. Job Cost has a pay-type dropdown per clocked person. Flat-contract people still get hours tracked but cost $0 there, because their cost lives in **Flat-Contract Subs** (`subContracts`, LS `swSubContracts`): each has an amount, % complete and a payments ledger. Cost to date = `max(earned, paid)`, where earned = % × amount, so a deposit counts as spent. Owed = earned − paid. `totalLaborCost()` = hourly + contracts, so budget-vs-actual, the Report and the role KPIs all include both. Bookkeeper view gains "owed to flat-contract subs" and "flat contracts committed" tiles.
- **GPS auto clock-in, foreground only** (Clock tab). There's no geocoding key: "Set this job site's location" captures the phone's current fix for the site name typed in (`geoSites`, LS `swGeoSites`, 100 m radius). The auto toggle (`swAutoClock`, `{enabled, employee}`) runs `watchPosition` while the app is open. A fix inside a site clocks the named employee in. After 5 minutes outside, it clocks them out. A 30s tick lets that timer expire while standing still, fixes worse than ±150 m are ignored, and when the app returns to the foreground it grabs a fresh fix. Browsers suspend GPS in the background, so the gap between fixes is stored on the event (`gapMin`). A clock-out after a gap of more than 10 min gets `review: true` and a ⚠️ in the log. With auto on, the geofence also clocks out a *manual* clock-in at a geofenced site once the person has been outside it for 5 min. Every clock event (manual too) now has `ts`, `method` (`manual`/`gps`) and, if a fix under 2 min old exists, `gps: {lat, lng, acc, site, distM, onSite}`, shown in the log as "📍 on site" / "📍 N m from X". `clockMs()` prefers `ts` over parsing the old `toLocaleString()` string. The native wrapper (Capacitor, background tracking) is still parked.
- **Backup & Move Data** (Setup). Saves one JSON file with every `LS` key except the AI Worker shared key, and restores it on another phone (replaces that phone's data, then reloads). This is a stopgap way to move data between phones, not sync. Firebase is still parked.

Tested with headless Chromium at 390px: simulated GPS arrive/leave/buffer-expiry, manual-punch GPS stamp, hourly + contract math, report, bookkeeper KPIs, and backup export → restore into a fresh browser context. No page errors, no horizontal scroll. **Not phone-tested**, and real GPS accuracy/permission prompts on iOS Safari in particular still need checking on a device.

## Known issues

**Rear-camera fix confirmed working on phone** (2026-09-16) — `getWalkStream()`'s `exact: 'environment'` → soft `'environment'` → `video: true` fallback chain in `walk.js` (commit `0f17af1`) now correctly opens the rear camera on the user's phone.

**Laptop still opens the front-facing webcam — this is expected, not a bug.** A laptop has one built-in camera, which faces the user; there is no `environment`-facing camera for any rung of the fallback chain to select, so `getWalkStream()` correctly falls through to `video: true` and gets the only camera available. Do not "fix" this — the app is designed for phone use during an actual walk-around.

## Do not touch unless asked

- Walk camera/recording in `current/walk-view.tsx` (parked snapshot, not the live page)
- Trade routing (`routeItem`, notifications) in the parked snapshot
- Punch / RFI / change-order data models in the parked snapshot
- Land-to-closing map (`pipeline-view.tsx`)

## Parked (deliberately, not forgotten)

- Twilio / SendGrid hands-off send for RFIs/trade notifications — current app opens the phone's own Mail/Messages app instead (`mailto:`/`sms:` links), which needs no backend
- Chapter 2 GPS geofencing: **foreground-only version is now live** (see the 2026-09-22 labor/GPS section above). Still parked: the background version (native wrapper) and address geocoding. Reference implementation is still in the repo at `gps-clock-in-module.html` (not deleted, never merged); needs a paid Google Maps/Mapbox geocoding key and a native wrapper (Capacitor) for background tracking, since plain mobile browser tabs suspend GPS watchers when backgrounded. Manual Clock In/Out (no geofencing) is what's live instead. (An earlier, redundant standalone GPS prototype called `gps` also existed in the repo root — deleted 2026-09-16 as dead weight; `gps-clock-in-module.html` is the real reference doc.)
- Firebase Firestore persistence — cross-device sync of any of the above; reference migration doc is `firebase-backend-module.html` (still in the repo, never merged). Everything today is `localStorage`-only, one phone = one copy of the data. Needs a real Firebase project.
- `current/` React tree (see top of this file)

## Deploy notes

- No build step. Push to `main` → Netlify (and GitHub Pages, while the repo is public) serves it directly, usually within a minute or two. Link-preview tags in `index.html` (`og:url`, `og:image`, `twitter:image`) point at the Netlify URL (2026-09-24, cache `sitewalk-v70`), so previews survive the repo going private.
- **Always bump `const CACHE = 'sitewalk-vNN'` in `sw.js`** on any change to `index.html`/`walk.js` — the service worker caches JS assets cache-first, so without a bump, phones can keep serving stale JS indefinitely even after the HTML updates (HTML itself is network-first, so it always looks current, which makes stale-JS bugs confusing — the page *looks* updated but doesn't *behave* updated).
- `index.html` registers the service worker itself now (commit `6da2120` fixed a real gap — it never used to) and auto-reloads once on `controllerchange`, so new deploys should now self-apply without a manual cache clear. If someone reports "nothing happens when I tap X" right after a deploy, suspect stale client-side SW/cache before suspecting new code — verify what the *server* is actually serving with `curl` against the live URL before changing anything.
- `v1.0` is tagged at commit `6da2120` as the first stable baseline (one-button walk flow + tabbed nav + live Submittals/Clock-In-Out/Dashboard/Daily-Log/Safety + working SW registration).
