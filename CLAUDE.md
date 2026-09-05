# SiteWalk — current snapshot for Claude

Public repo (no auth): https://github.com/danstewart5/SiteWalk

The live Grok sandbox preview is **behind xAI login**. Do not use Grok preview URLs. Use this GitHub repo instead.

## What is current

The field app was rebuilt as a React / TanStack / Zustand app in the Grok workspace. The GitHub repo still also has the older HTML modules (`rfi-module.html`, `gps-clock-in-module.html`, etc.). **The source of truth for the current app is the files under `current/`.**

Phone camera smoke test (top-level HTTPS, not iframed):
https://danstewart5.github.io/SiteWalk/walk.html

## Do not touch

When adding features, leave these alone unless the user explicitly asks:

- `current/walk-view.tsx` — camera + recording session (`walkActive` / shutter / fallback file input)
- Trade routing in `current/store.ts` (`routeItem`, `notifications`, `walkActive` gating)
- Punch / RFI / change-order data models in `current/types.ts`
- Land-to-closing map in `current/pipeline-view.tsx` / `current/pipeline.ts`

## What’s built

1. **Site walk** — Start recording walk, live camera or native capture fallback, photos save immediately, timer, GPS stamp. Iframe/sandbox often blocks `getUserMedia`; GitHub Pages walk.html is the phone test.
2. **Chapter 4 trade routing** — Punch / RFI / change order with a trade looks up the trade directory. No contact → **Unrouted** on the dashboard. Contact on file → queue SMS/email. MVP delivery is still the device `sms:` / `mailto:` compose (Twilio/SendGrid not wired). Reassigning a trade re-routes.
3. **Land-to-closing map** — More → Land-to-closing map. 13 pre-filled stages, Draft / Confirm per row, five persistent boss-session questions. This session is what unblocks chapters 6 and 8.

## Parked (do not start unless asked)

- Twilio SMS + SendGrid email (hands-off send). Same routing, swap delivery only. Failures must be visible like Unrouted.
- Chapter 2 GPS geofencing: 100m radius, all active sites, auto in, auto out with 5-minute buffer, manual fallback always visible. Plug into the existing clock log.

## Key files

| File | What |
|---|---|
| `current/walk-view.tsx` | Walk camera / recording UI |
| `current/store.ts` | Zustand persist store (walk, routing, pipeline, clock) |
| `current/routing.ts` | Trade lookup + message compose |
| `current/notify.ts` | Server send stub (Twilio/SendGrid if env, else device) |
| `current/route-status.tsx` | Unrouted / Ready to send / Text-Email buttons |
| `current/views.tsx` | Home, punch, RFI, change, trades, clock, etc. |
| `current/pipeline.ts` | Default land-to-closing stages + questions |
| `current/pipeline-view.tsx` | Boss-session map UI |
| `current/types.ts` | Shared types |

## Routing message shape (keep this)

`New {punch item|RFI|change order} on {site} ({trade}). {description}. Logged by {who} {when}. Reply or call {who} with questions.`
