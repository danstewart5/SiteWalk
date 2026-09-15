# SiteWalk — current snapshot for Claude

Two public links (no xAI login):

- **App (phone):** https://danstewart5.github.io/SiteWalk/
- **Source (you):** this repo. Start here.

**Live phone app** (what Pages actually serves) is root `index.html` plus the root `*-module.html` files and `ai-backend/worker.js`. Edit those for Worker URL, `X-SiteWalk-Key`, CORS, offline punch items.

`current/` is a parked TypeScript/React snapshot. No build script or Pages workflow reads it. It will go stale relative to `index.html` — do not “sync” Worker/header changes into it unless someone is reviving that tree on purpose.

Do not use Grok sandbox preview URLs.

## Do not touch unless asked

- Walk camera/recording in `current/walk-view.tsx` (parked snapshot, not the live page)
- Trade routing (`routeItem`, notifications)
- Punch / RFI / change-order data models in the parked snapshot
- Land-to-closing map (`pipeline-view.tsx`)

## Parked

- Twilio / SendGrid hands-off send
- Chapter 2 GPS geofencing (100m, 5-minute out buffer) — reference implementation in `gps-clock-in-module.html`, not merged; needs a paid geocoding key and a native wrapper (Capacitor) for background tracking
- Firebase Firestore persistence (`firebase-backend-module.html`) — cross-device sync, needs a real Firebase project
- Daily Log and Safety Incident Log modules (`daily-log-module.html`, `safety-module.html`) — never merged, no live UI
- `current/` React tree (see above)

## 2026-09-14: dashboard, submittals, clock in/out merged into the live app

`dashboard-module.html`, `submittals-module.html`, and `rfi-module.html` used to sit at repo root as standalone, never-merged "File N of 7" snippets with their own mismatched localStorage keys (`swRFIs` vs the real `swRfis`, etc.) — none of them were reachable from `index.html`. They've been deleted. Submittals and a manual Clock In/Out (no geofencing) are now real sections in `index.html`/`walk.js`, and the dashboard is a live section reading directly from the in-app arrays (`punch`, `changes`, `rfis`, `submittals`, `clockEvents`) instead of a disconnected page. RFI functionality was already live in `walk.js` before this — the old `rfi-module.html` was a redundant, never-used duplicate.
