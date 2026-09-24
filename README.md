# SiteWalk

## Open the app (phone — no login)

https://sitewalk-app.netlify.app

If it looks stuck, pull to refresh once.

## Give this to Claude (source — private repo, needs GitHub access)

https://github.com/danstewart5/SiteWalk

Start at `CLAUDE.md`.

The live app (served by Netlify) is root `index.html` (and the other root `*-module.html` files). `current/` is a parked TypeScript/React snapshot — nothing in the Netlify deploy or Worker path reads it. Do not treat it as the phone source of truth.
