# SiteWalk — current snapshot (for Claude and Grok)

Two public links (no login):

- **App (phone):** https://danstewart5.github.io/SiteWalk/
- **Source:** this repo (GitHub Pages deploys straight from `main`, no build step).

**Live phone app** is root `index.html` + `walk.js` + `sw.js`, plus `ai-backend/worker.js` (Cloudflare Worker). That's it — the whole app is one HTML file and one JS file, no framework, no build.

`current/` is a parked TypeScript/React snapshot. No build script or Pages workflow reads it. It will go stale relative to `index.html` — do not "sync" changes into it unless someone is reviving that tree on purpose.

Do not use Grok sandbox preview URLs.

## What the live app actually does (as of 2026-09-14)

Tapping **Start Walk-Around** is the one entry point *today*: opens the rear camera live, starts AI voice listening, and auto-tags the current trade from what it hears (Cloudflare Worker `/classify` when a Worker URL is configured, a local keyword heuristic offline). Tap **Snap** to take a photo — it inherits whatever trade the AI just heard. Tap **End Walk** and a **Generate Report** button appears in its place — tap it whenever you're ready and it jumps to the Setup tab where the report is displayed.

That single-entry flow is superseded by the mode-selection decision below. Do not keep collapsing both session types back into one Start button when that work lands.

UI is five tabs behind a fixed bottom nav (phone-app style, not one long scrolling page):

- **🎥 Walk** — Start Walk-Around (camera, voice, live trade tag, Snap, photo gallery for the current walk)
- **✅ Items** — Punch List (now with a Resolved toggle), Change Orders (client approve/decline), RFIs (Open/Answered), Submittals (Pending/Approved), Safety Incident/Near-Miss Log (type, description, person involved, corrective action, optional photo)
- **⏱ Time** — manual Clock In/Out (flags anyone clocked in 16+ hours with no clock-out) + Daily Log (date, weather, crew count, trades on site, delays, notes)
- **📊 Board** — Open Items Dashboard, live-computed from the actual in-app arrays (not a separate page, not stale)
- **⚙️ Setup** — Trade Contacts (email/SMS per trade — opens the phone's own Mail/Messages), AI Worker Setup (Worker URL + optional shared key), Report (generate/print, rolls up everything above by trade)

Every item type persists to `localStorage` under real, live keys (see `LS` object at the top of `walk.js`): `swPunch`, `swChanges`, `swRfis`, `swSubmittals`, `swClockEvents`, `swDailyLogs`, `swSafety`, `swPhotos`, `swTradeContacts`.

All eight of the original "File N of 7/8 — INSTRUCTIONS FOR GROK" standalone module snippets (RFI, Daily Log, Submittals, Safety, Dashboard, Trade Directory, GPS Clock-In, Firebase Backend) are now resolved one way or another: RFI/Daily Log/Submittals/Safety/Dashboard are merged into the live app above; GPS geofencing and Firebase sync are explicitly parked (see below), not abandoned by accident. `trade-directory-module.html` was deleted — it never contained real content (the file body was just the placeholder string `content1`), and the practical need is already covered live by Setup's manual Trade Contacts email/SMS.

## Decision — walk session modes + voice snap (2026-09-19)

**Status: decided, not built.** Live app is still one Start Walk-Around button. Do not implement from this note unless asked; this is the product contract so the next pass does not merge the two modes again.

Reviewed by Grok 2026-09-19. Chapter 1 of the larger platform.

### Mode selection (start of every walk)

User picks a mode before the walk starts. Persist last-used mode on the device.

1. **Video walk-around** — camera + microphone stay live for the whole session; live speech-to-text runs throughout; one Start / End control for the session. Snap stays on screen as a backup shutter. "Record continuously" in v1 means keep the preview + mic + transcript live, **not** persist a full walk video file. Full walk-video persistence is a later storage/privacy/offline problem, not part of this decision.
2. **Photo-only walk-around** — camera on, no always-on ASR. User snaps stills manually. Optional tap-to-talk notes may reuse the existing iOS MediaRecorder fallback. This is the mode for loud areas, PPE, or anyone who does not want the phone listening the whole walk.

These are two session types with two audio policies. Do not hide Snap in video mode.

### Voice-triggered photo (video mode only)

Instead of requiring a thumb press, the user can say a trigger phrase while walking and talking. On detect, grab a still from the live video feed at that moment, save it as a session photo, and keep recording + transcribing with **no stop/restart** of the speech path.

Constraints agreed in review:

- **Detection.** Do not treat the live Web Speech transcript as a wake-word engine. Construction noise + common English (`snap picture`, snap line, snapshot) will false-fire. v1 may scan final transcripts with a conservative matcher, cooldown (1.5–2.5s), isolated-phrase rule, haptic/beep/flash ack, and a small variant list. Prefer a 3–4 syllable uncommon command over "snap picture" (`sitewalk snap` / `mark shot` class). Strip or tag the command so classify / punch extraction does not file it as an item. Plan a dedicated on-device keyword spotter if video mode becomes the default field path.
- **Frame grab.** Same live `<video>` element → `canvas.drawImage` → existing `compressImage` path. Do not open a second camera session or reconfigure capture mid-walk. Detection lag (often 300–1500ms on Web Speech) dominates; canvas grab is cheap. Prefer a short preview-frame ring buffer and grab at phrase *start*, not phrase end. User copy: point, say the phrase, hold a beat.
- **Isolation (release blocker).** Photo path must never `stop()` tracks, re-call `getUserMedia`, toggle `track.enabled`, replace `srcObject`, or touch `recognition` / `MediaRecorder`. One media stream for the whole video session. Speech owns its own `onend` restart loop. Voice and Snap button call the same writer. Test: snap must not kill listening on Android Chrome or collapse the iOS audio session.
- **Photo identity.** Filenames are for humans (`{siteSlug}_{YYYY-MM-DD}_{HHmmss}_{seq}.jpg`). Join keys are structured: `photoId`, `sessionId`, `capturedAt` (ISO + epoch ms), `sessionOffsetMs`, `source` (`voice` | `button`), `trigger`, `transcriptUtteranceId` (or char offsets), `trade`, `linkedItemId`. Keep the existing 60s photo↔punch window as fallback only. Do not encode punch text in the filename. Do not persist a full walk video as part of this feature.

### Shipping order (when this is built)

1. Mode picker + last-used default; photo-only must work with zero ASR.
2. Shared capture function; isolation tests on Android Chrome and iOS Safari.
3. Conservative phrase + cooldown + haptic; Snap remains visible.
4. Structured photo metadata + utterance-id linking; 60s window stays as backup.
5. Only then a real on-device spotter or persisted walk video.

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
- Full walk-video file persistence (see mode-selection decision above — preview + transcript only in v1)

## Deploy notes

- No build step. Push to `main` → GitHub Pages serves it directly, usually within a minute or two.
- **Always bump `const CACHE = 'sitewalk-vNN'` in `sw.js`** on any change to `index.html`/`walk.js` — the service worker caches JS assets cache-first, so without a bump, phones can keep serving stale JS indefinitely even after the HTML updates (HTML itself is network-first, so it always looks current, which makes stale-JS bugs confusing — the page *looks* updated but doesn't *behave* updated).
- `index.html` registers the service worker itself now (commit `6da2120` fixed a real gap — it never used to) and auto-reloads once on `controllerchange`, so new deploys should now self-apply without a manual cache clear. If someone reports "nothing happens when I tap X" right after a deploy, suspect stale client-side SW/cache before suspecting new code — verify what the *server* is actually serving with `curl` against the live URL before changing anything.
- `v1.0` is tagged at commit `6da2120` as the first stable baseline (one-button walk flow + tabbed nav + live Submittals/Clock-In-Out/Dashboard/Daily-Log/Safety + working SW registration).
