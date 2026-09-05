# SiteWalk — current snapshot for Claude

Public app (no xAI login): https://danstewart5.github.io/SiteWalk/

Public repo: https://github.com/danstewart5/SiteWalk

Do not use Grok sandbox preview URLs — they redirect to xAI auth.

The live GitHub Pages site is the **full app** (dashboard, walk camera, punch, RFIs, trades, pipeline, clock, safety). Source of truth for code review is `current/`.

## Do not touch unless asked

- Walk camera/recording in `current/walk-view.tsx`
- Trade routing (`routeItem`, notifications)
- Punch / RFI / change-order data models
- Land-to-closing map (`pipeline-view.tsx`)

## Parked

- Twilio / SendGrid hands-off send
- Chapter 2 GPS geofencing (100m, 5-minute out buffer)
