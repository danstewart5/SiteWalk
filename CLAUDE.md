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
- Chapter 2 GPS geofencing (100m, 5-minute out buffer)
- `current/` React tree (see above)
