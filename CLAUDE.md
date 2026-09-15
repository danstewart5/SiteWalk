# SiteWalk — current snapshot (for Claude and Grok)

Two public links (no login):

- **App (phone):** https://danstewart5.github.io/SiteWalk/
- **Source:** this repo (GitHub Pages deploys straight from `main`, no build step).

**Live phone app** is root `index.html` + `walk.js` + `sw.js`, plus `ai-backend/worker.js` (Cloudflare Worker). That's it — the whole app is one HTML file and one JS file, no framework, no build.

`current/` is a parked TypeScript/React snapshot. No build script or Pages workflow reads it. It will go stale relative to `index.html` — do not "sync" changes into it unless someone is reviving that tree on purpose.

Do not use Grok sandbox preview URLs.

## What the live app actually does (as of 2026-09-14)

Tapping **Start Walk-Around** is the one entry point: opens the rear camera live, starts AI voice listening, and auto-tags the current trade from what it hears (Cloudflare Worker `/classify` when a Worker URL is configured, a local keyword heuristic offline). Tap **Snap** to take a photo — it inherits whatever trade the AI just heard. Tap **End Walk** and it asks "Generate the report now?" (yes/no).

UI is five tabs behind a fixed bottom nav (phone-app style, not one long scrolling page):

- **🎥 Walk** — Start Walk-Around (camera, voice, live trade tag, Snap, photo gallery for the current walk)
- **✅ Items** — Punch List (now with a Resolved toggle), Change Orders (client approve/decline), RFIs (Open/Answered), Submittals (Pending/Approved), Safety Incident/Near-Miss Log (type, description, person involved, corrective action, optional photo)
- **⏱ Time** — manual Clock In/Out (flags anyone clocked in 16+ hours with no clock-out) + Daily Log (date, weather, crew count, trades on site, delays, notes)
- **📊 Board** — Open Items Dashboard, live-computed from the actual in-app arrays (not a separate page, not stale)
- **⚙️ Setup** — Trade Contacts (email/SMS per trade — opens the phone's own Mail/Messages), AI Worker Setup (Worker URL + optional shared key), Report (generate/print, rolls up everything above by trade)

Every item type persists to `localStorage` under real, live keys (see `LS` object at the top of `walk.js`): `swPunch`, `swChanges`, `swRfis`, `swSubmittals`, `swClockEvents`, `swDailyLogs`, `swSafety`, `swPhotos`, `swTradeContacts`.

All seven of the original "File N of 7 — INSTRUCTIONS FOR GROK" standalone module snippets (RFI, Daily Log, Submittals, Safety, GPS Clock-In, Firebase Backend, Dashboard) are now resolved one way or another: RFI/Daily Log/Submittals/Safety/Dashboard are merged into the live app above; GPS geofencing and Firebase sync are explicitly parked (see below), not abandoned by accident.

## Known open issue — NOT yet fixed

**Camera still opens front/selfie-facing on the user's phone**, even after a fix (commit `0f17af1`) that tries `facingMode: { exact: 'environment' }` → soft `'environment'` → `video: true` in `getWalkStream()` in `walk.js`. The live server confirmed serving that fix, so it's either (a) still a stale client cache, or (b) the fallback chain genuinely isn't landing on the rear camera on this device — `facingMode` constraints are notoriously unreliable across iOS Safari/webviews.

**Next step, not yet answered by the user:** does the live in-page video preview show (the `#walkVideo` embedded box), or does the phone's native system camera app pop up over the page? Those are two different code paths:
- Live preview wrong-facing → the `getWalkStream()` fallback chain in `walk.js` needs the more robust fix: after getting *any* stream, call `enumerateDevices()` (labels are populated post-permission) and swap to a device whose label matches `/back|rear/i` if the current track reports `getSettings().facingMode === 'user'` or an ambiguous/absent facingMode.
- Native camera app pops up → that means `getWalkStream()` is failing entirely and falling through to the `photoInput` file-input fallback (`capture="environment"` attribute) — iOS Safari has historically been flaky about honoring that hint, and there's no further web-level control once the native picker takes over.

Do not re-attempt the same `exact`/`ideal` facingMode fix again without first learning which path is actually running — it's already been tried once.

## Do not touch unless asked

- Walk camera/recording in `current/walk-view.tsx` (parked snapshot, not the live page)
- Trade routing (`routeItem`, notifications) in the parked snapshot
- Punch / RFI / change-order data models in the parked snapshot
- Land-to-closing map (`pipeline-view.tsx`)

## Parked (deliberately, not forgotten)

- Twilio / SendGrid hands-off send for RFIs/trade notifications — current app opens the phone's own Mail/Messages app instead (`mailto:`/`sms:` links), which needs no backend
- Chapter 2 GPS geofencing (100m radius, 5-minute out buffer, auto clock in/out) — reference implementation was in the now-deleted `gps-clock-in-module.html` (see git history if reviving); needs a paid Google Maps/Mapbox geocoding key and a native wrapper (Capacitor) for background tracking, since plain mobile browser tabs suspend GPS watchers when backgrounded. Manual Clock In/Out (no geofencing) is what's live instead.
- Firebase Firestore persistence — cross-device sync of any of the above; everything today is `localStorage`-only, one phone = one copy of the data. Needs a real Firebase project.
- `current/` React tree (see top of this file)

## Deploy notes

- No build step. Push to `main` → GitHub Pages serves it directly, usually within a minute or two.
- **Always bump `const CACHE = 'sitewalk-vNN'` in `sw.js`** on any change to `index.html`/`walk.js` — the service worker caches JS assets cache-first, so without a bump, phones can keep serving stale JS indefinitely even after the HTML updates (HTML itself is network-first, so it always looks current, which makes stale-JS bugs confusing — the page *looks* updated but doesn't *behave* updated).
- `index.html` registers the service worker itself now (commit `6da2120` fixed a real gap — it never used to) and auto-reloads once on `controllerchange`, so new deploys should now self-apply without a manual cache clear. If someone reports "nothing happens when I tap X" right after a deploy, suspect stale client-side SW/cache before suspecting new code — verify what the *server* is actually serving with `curl` against the live URL before changing anything.
- `v1.0` is tagged at commit `6da2120` as the first stable baseline (one-button walk flow + tabbed nav + live Submittals/Clock-In-Out/Dashboard/Daily-Log/Safety + working SW registration).
