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

Tap **End Walk** / Stop to finish. **Generate Summary** jumps to the Walk Summary sub-tab.

UI is five tabs behind a fixed bottom nav (phone-app style, not one long scrolling page):

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
