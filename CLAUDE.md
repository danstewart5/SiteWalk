# SiteWalk — current snapshot (for Claude and Grok)

Two public links (no login):

- **App (phone):** https://danstewart5.github.io/SiteWalk/
- **Source:** this repo (GitHub Pages deploys straight from `main`, no build step).

**Live phone app** is root `index.html` + `walk.js` + `sw.js`, plus `ai-backend/worker.js` (Cloudflare Worker). That's it — the whole app is one HTML file and one JS file, no framework, no build.

`current/` is a parked TypeScript/React snapshot. No build script or Pages workflow reads it. It will go stale relative to `index.html` — do not "sync" changes into it unless someone is reviving that tree on purpose.

Do not use Grok sandbox preview URLs.

## What the live app actually does (as of 2026-09-19)

**Start Walk-Around is the only entry point — there is no mode picker.** An earlier note in this file (below, now corrected) described a video-walk/photo-only mode split as "landed in live app" at cache `sitewalk-v42`; that was wrong — no mode-picker code (`swWalkMode`, `captureWalkStill()`, etc.) was ever actually written to `index.html`/`walk.js`, only this file described it. The actual product decision, made the same day, superseded that split anyway: one always-on walk engine, no picker. Camera preview, mic, live speech-to-text, voice-triggered snap, and punch-list tagging all start together on **Start Walk-Around** and stay on together until **Stop**, every time.

The one real optional control is **"Also save a video of this walk"** (checkbox above the Start button, persisted in `swSaveVideoEnabled`) — when on, a continuous video (camera + a separate mic track) records for the whole session and is handed to the user via the OS share sheet (`navigator.share`) or a browser download as `sitewalk-video-<timestamp>.webm`/`.mp4` when the walk ends. This is a real, working save, not a placeholder.

Saying a trigger phrase ("take a photo", "snap a photo", "get a picture of this", "photo this/that" — see `SNAP_TRIGGER_RE` in `walk.js`) grabs a still from the live `<video>` frame via `voiceTriggeredSnap()`. That function only reads canvas pixels from the existing feed — it never calls `stop()` on any track, never re-calls `getUserMedia`, and never touches `recognition`, so a snap cannot interrupt or restart continuous listening. A 1.5s cooldown (`lastSnapTriggerAt`) guards against a browser firing one `onresult` final result twice for the same utterance. If the trigger phrase is embedded in a longer sentence, the remainder (with the phrase stripped) still goes through normal punch/change/RFI classification via `fileVoiceUtterance`. Every photo (voice-triggered, Snap-button, or uploaded) carries `ts`, `trade`, `source` (`voice`/`manual`), and — for voice snaps — `transcriptText`, so a still can be matched back to what was being said; the existing 60s photo↔item linking window (`tryLinkPhotoToRecentItem`/`tryLinkItemToRecentPhoto`) still does the punch-list matching.

**Transcript filter (2026-09-22, cache `sitewalk-v62`).** Continuous listening no longer turns every sentence into an item. Every finalized sentence goes to `handleSpokenUtterance()` in `walk.js`, which first appends it verbatim to `currentWalk.rawTranscript` (the full record, shown as "Full Transcript" in the report's walk log, each line tagged Item/Review/Dismissed/Chatter/Photo/Note this), then asks `assessUtterance()`: a clear observation (defect wording `DEFECT_RE`, safety, change-order/RFI keywords via `classifyText`, drawing ref) → `fileVoiceUtterance()` exactly as before (shared punch/change/RFI/Safety shapes, AI Worker `/classify` still used when configured); building/trade/cost mention without a clear problem, or an observation wrapped in chatter (`CHATTER_RE`) → `reviewQueue` (LS `swReviewQueue`); pure small talk → raw transcript only. "Note this"/"log this"/"flag this" at the start of a sentence (`NOTE_TRIGGER_RE`) forces that sentence — or, said alone, the next one within 20s — to be filed. Push-to-talk notes are always filed (deliberate capture). The review bucket shows on the Walk → Summary sub-tab (and a "🔎 N to review" button on the Walk view); "Add as item" (`promoteReviewItem`) files it with its original timestamp, walk and lease-walk context; "Dismiss" only removes it from the queue. Pending review items also appear in the report. `voice-value-add.js` no longer creates its own duplicate punch/safety entries — `processVoiceValue()` now only tallies spoken `$` amounts, and only for filed items; `safetySeverity()` feeds the filter and stamps `severity` on voice safety entries.

Tap **End Walk** / Stop to finish. **Generate Summary** jumps to the Walk Summary sub-tab.

**Report is manual-only, photos inline (2026-09-22, cache `sitewalk-v61`).** `window.endWalk()` no longer switches to the Report tab or calls `generateReport()` — the report builds only when the user presses Generate Report (`#genBtn`, `#homeGenerateReportBtn`, or Print). The old per-trade photo gallery in the report is gone: `reportItemSection()` renders each punch / change order / RFI / safety-log item with its type badge, trade tag, location, cost estimate, status, and its photo(s) directly underneath (`reportPhotosHtml()` — one photo shown at up to 320px, two or more as a row of 76px thumbnails; tap opens the existing lightbox). `tryLinkPhotoToRecentItem()` now also links to items that already have a photo (extras go in `entry.photos`, `entry.photo` stays the primary; read both via `itemPhotos()`) and to `safetyLogs`. Photos not linked to any item show as their own "Photo" entries in the report body.

**Nav restructured to a Home dashboard, 2026-09-19** — went through three revisions same day, each pasted as a full brief and each superseding the last before the previous one was even reported back: (1) flat accordion list of four Procore-style blocks, (2) flat accordion list of seven pillars, (3) **current, cache `sitewalk-v49`** — a moody dark-wood-paneled landing *scene* (`.home-scene` in `index.html`) with a central glowing green "Start Walk-Around" pill button (`#homeStartWalkBtn`, moss green `#4CAF6E`), seven pillars arranged radially around it as literal architectural-column shapes (`.home-pillar[data-block="land|preconstruction|design|field|scheduling|safety|financial"]`, positioned via `--angle`/`--radius` CSS custom properties and a `rotate(θ) translate(r,0) rotate(-θ) translate(-50%,-50%)` transform — 0deg = 3 o'clock, so `--angle:-90deg` is the top; the trailing `translate(-50%,-50%)` centres each pillar regardless of label height (fixed 2026-09-22, cache `sitewalk-v56` — before that, pillars were a quarter-turn off and unevenly offset). **The ring is a dial** (2026-09-22, cache `sitewalk-v58`): a `.home-dial` face (rim, groove, one tick per pillar slot) under the pillars turns with them; drag anywhere on `.home-pillars` to rotate via a `--spin` offset added to every pillar's angle, with momentum on release, or tap `#homeDialLeft`/`#homeDialRight` to step one pillar (360/7°). It always snaps so a pillar sits at 12 o'clock under the fixed `.home-dial-pointer` above the Start button (IIFE after the pillar click wiring in `walk.js`); the held pillar gets `.pressed` (scale 1.45 + copper glow). A plain tap still opens the drilldown; a drag swallows the click. No pointer capture — it would retarget the click off the pillar. `.home-pillars` is `touch-action: none`, so a vertical swipe starting on the ring spins it instead of scrolling the page. Pillar `:hover` styles sit behind `@media (hover: hover)` because phones leave hover stuck on the last-touched pillar, each scaling up via `.pillar-visual` on hover/touch), a black-framed "window" showing `assets/photos/hero-framing.jpg`, and a sharp-cornered gold `#e0a94a` "Generate Report" button (`#homeGenerateReportBtn`) — both quick-action buttons fire immediately (`showTab('walk')`+`window.startWalk()`, `showTab('report')`+`window.generateReport()`) without entering a pillar first, unchanged from the two earlier revisions. Don't resurrect either earlier version if it turns up in scrollback.

Tapping any `.home-pillar`, or the small `#homeMoreLink` ("⋯ More") link at the bottom of the scene, calls `openHomeDrilldown(block)` in `walk.js`: adds `.showing-drilldown` to `#tab-home` (CSS then hides `.home-scene` and shows `.home-drilldown`) and expands only the matching `.home-block[data-block=...]` (or none, for the More link). `.home-drilldown` holds the exact same seven `.home-block` accordions + `.home-admin` section from the earlier revisions, unchanged — `.home-chapter-btn[data-tab]`/`.home-admin-btn[data-tab]` still just call the pre-existing `showTab(name)` against the same `tab-*` panels below, nothing about the panels themselves ever changed across any revision. `#homeDrilldownBack` removes `.showing-drilldown` to return to the scene. `disabled` chapter buttons with no `data-tab` (Land Acquisition, Ch.6 Land-to-Contract Pipeline/Victoria Land, Ch.9 Price-the-House, Ch.5 Invoicing, Ch.7 Consulting Business Rollout, Ch.8 Developer Dashboard) are placeholders — none of that functionality exists in the live app; Ch.6/Ch.9's real reference material is the parked `current/pipeline.ts`/`pipeline-view.tsx`, not anything live.

**Not yet phone-tested** — this session had no browser automation available, so the radial pillar layout (`--radius: min(33vw, 132px)` on a `min(84vw, 360px)` stage) was sized by arithmetic against common phone viewport widths, not verified by an actual render. If pillars look clipped, overlapping the center button, or misaligned on a real device, that's the first thing to check.

Pillar mapping (chapter numbers are the user's own external roadmap numbering, not something derived from this repo; RFIs/Change Orders/Submittals/Drawing Refs/Drawings/Daily Log/Job Cost/Dashboard/Report/Setup aren't individually chapter-numbered by the user — placement below is this session's judgment call, not dictated by the brief):
1. **Land & Acquisition** — Land Acquisition (placeholder) + Ch.6 Land-to-Contract Pipeline/Victoria Land (placeholder)
2. **Preconstruction & Estimating** — Ch.3 Punch List & Estimating (`punch`, live — punch list only, no estimating tool yet) + Ch.9 Price-the-House (placeholder)
3. **Design & Drawings** — Drawing References (`drawingrefs`, live) + Drawings & Plans (`drawings`, live) + Submittals (`submittals`, live)
4. **Field Operations & Walk-Around** — Ch.1 Walk-Around (`walk`, live) + RFIs (`rfis`, live)
5. **Scheduling & Resources** — Ch.2 GPS Clock-In (`clock`, live as manual clock in/out only — geofencing still parked, see below) + Ch.4 Trade Routing (`contacts`, live only as manual per-trade email/SMS contacts — the real routing engine, `routeItem`, is still parked in `current/routing.ts`) + Daily Log (`dailylog`, live)
6. **Safety & Quality** — Safety Log (`safety`, live)
7. **Financial Management & Invoicing** — Ch.5 Invoicing (placeholder, nothing live) + Job Cost Dashboard (`jobcost`, live — budget vs actual, not literal invoicing) + Change Orders (`changes`, live)

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

## LeaseFlow — Hold mode (shipped 2026-09-22)

A Build/Hold mode toggle (`.home-mode-btn[data-mode]`, persisted `swHomeMode`, applied as `data-home-mode` on `#tab-home`) sits above the home scene, next to a shared flag bar (`#homeFlagBar`, `renderFlagBar()` in `walk.js`) that spans both modes — a red "Units in Arrears" or yellow "Lease Renewal Due Soon" pill is visible without switching modes, same as an open punch item count. The Start Walk-Around / Generate Report buttons are unaffected by the mode switch, per spec.

**Build mode** (default) is the unchanged seven-pillar radial scene. **Hold mode** swaps in seven LeaseFlow pillars (`.home-pillar-hold`) at the same seven angles, with matching drilldown accordions (`.home-block-hold`, gold `#b98430` top border) — CSS hides whichever set doesn't match `data-home-mode`, so this is one shared stage, not a ninth pillar tile.

LeaseFlow chapters, all live except Commercial Extras: **Units & Properties** (`units` tab — Property is root, can be `jobLinked` to the current job-site name/address or stand alone as an acquired rental; Unit belongs to a Property), **Tenants** (`tenants`, its own record, not a generic contact), **Leases** (`leases` — links a Unit + Tenant with start/end/renewal dates, rent amount, residential/commercial type), **Rent & Payments** (`rentroll` — a Payment ledger per lease, a computed rent roll, and a CSV export via `exportRentRollCsv()`), **Arrears & Collections** (`arrears` — a read-only computed list off the same rent-roll math, no collections workflow, no notice-period/RTB handling), **Maintenance & Walk-throughs** (`leasewalk` — "Start Lease Walk" sets `leaseWalkContext` then calls the *same* `window.startWalk()` Chapter-1 engine, no forked camera/mic code; context clears in `window.endWalk()`), **Commercial Extras** (`commercial` — titled/scaffolded only, no working UI, deliberately not built this pass).

Rent roll math (`computeRentRoll()`/`monthsElapsed()` in `walk.js`) is a simple accrual: one month's rent per elapsed month since lease start (the start date's day-of-month is the recurring due day), balance = accrued rent minus logged payments. It's deliberately not a real amortization/proration engine.

Shared schema extension, not a fork: `fileEntry()` now stamps every punch/change/RFI item with `source` (`'lease-walk'` when `leaseWalkContext` is set, else `'job-site'`), `property_id`, and `unit_id`. A lease-walk condition item and a job-site item live in the same `punch`/`changes`/`rfis` arrays, same Chapter 1 engine, distinguished only by these fields.

New LS keys: `swProperties`, `swUnits`, `swTenants`, `swLeases`, `swPayments`, `swHomeMode`. All wired into `clearAllData()` — Setup's Reset App wipes LeaseFlow data too, and there's a new "LeaseFlow Storage Note" section in Setup calling out that everything here is still localStorage/single-device, same known limitation as the rest of the app, not solved this pass.

**Phone-tested:** no — this session tested with headless Chromium + Playwright against a local static server (mode toggle, drilldown, full CRUD flow, rent-roll/arrears math, CSV download, and the Start Lease Walk → Chapter 1 handoff all verified with zero console errors). Real-device verification (especially the radial pillar layout on Hold mode, and that CSV download/share behaves the same as the existing video-save flow) is still outstanding.

## Hartwig partner logo (2026-09-22, cache `sitewalk-v60`)

The logo sits just below the framed window photos in the home scene: `<img class="home-logo" src="hartwig-logo.png">` right after `.home-window`, `width: min(64%, 230px)`, `opacity: 0.85` with a drop shadow, so it's softened into the wood but clearly readable. Placement history, all same day, each superseding the last at the user's request: an "In Partnership With" band above the Build/Hold toggle (v55–v58), then a faint soft-light watermark across the pillar dial (v59, too faint to see), then here — don't bring either earlier version back. Copper `#B98A60` is also the active Build/Hold toggle colour and the pillar glow.

**`hartwig-logo.png` is a stand-in**: it was cut out of a JPEG screenshot of the Hartwig landing page (alpha keyed on copper-ness, filled flat `#B98A60`), because no original file was ever supplied — swap in the original transparent PNG when there is one (same filename, no code change).

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
- Chapter 2 GPS geofencing (100m radius, 5-minute out buffer, auto clock in/out) — reference implementation is still in the repo at `gps-clock-in-module.html` (not deleted, never merged); needs a paid Google Maps/Mapbox geocoding key and a native wrapper (Capacitor) for background tracking, since plain mobile browser tabs suspend GPS watchers when backgrounded. Manual Clock In/Out (no geofencing) is what's live instead. (An earlier, redundant standalone GPS prototype called `gps` also existed in the repo root — deleted 2026-09-16 as dead weight; `gps-clock-in-module.html` is the real reference doc.)
- Firebase Firestore persistence — cross-device sync of any of the above; reference migration doc is `firebase-backend-module.html` (still in the repo, never merged). Everything today is `localStorage`-only, one phone = one copy of the data. Needs a real Firebase project.
- `current/` React tree (see top of this file)

## Deploy notes

- No build step. Push to `main` → GitHub Pages serves it directly, usually within a minute or two.
- **Always bump `const CACHE = 'sitewalk-vNN'` in `sw.js`** on any change to `index.html`/`walk.js` — the service worker caches JS assets cache-first, so without a bump, phones can keep serving stale JS indefinitely even after the HTML updates (HTML itself is network-first, so it always looks current, which makes stale-JS bugs confusing — the page *looks* updated but doesn't *behave* updated).
- `index.html` registers the service worker itself now (commit `6da2120` fixed a real gap — it never used to) and auto-reloads once on `controllerchange`, so new deploys should now self-apply without a manual cache clear. If someone reports "nothing happens when I tap X" right after a deploy, suspect stale client-side SW/cache before suspecting new code — verify what the *server* is actually serving with `curl` against the live URL before changing anything.
- `v1.0` is tagged at commit `6da2120` as the first stable baseline (one-button walk flow + tabbed nav + live Submittals/Clock-In-Out/Dashboard/Daily-Log/Safety + working SW registration).
