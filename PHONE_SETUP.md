# SiteWalk — phone-only Worker setup checklist

Do this once from a phone browser (or desktop). Takes ~10 minutes. Free tiers are enough to pilot.

## 1. Anthropic key
1. Open https://console.anthropic.com and sign up / log in.
2. Create an API key → copy it. Do not put it in GitHub or the phone page.

## 2. Cloudflare Worker
1. Open https://dash.cloudflare.com and sign up (free).
2. On a computer (or Termux / similar), install Wrangler once:
   ```bash
   npm install -g wrangler
   wrangler login
   ```
3. From the SiteWalk repo:
   ```bash
   cd ai-backend
   wrangler deploy
   ```
   Name suggestion: `sitewalk-ai`.
4. Store secrets (paste when prompted):
   ```bash
   wrangler secret put ANTHROPIC_API_KEY
   wrangler secret put SITEWALK_KEY
   ```
   For `SITEWALK_KEY`, invent any long random string (shared password). You will not type it into the phone UI yet — the hardened Worker expects header `X-SiteWalk-Key` when this secret is set. For the simplest phone pilot you can skip `SITEWALK_KEY` until you are ready; the Worker only enforces it if the secret exists.
5. Copy the `https://….workers.dev` URL Wrangler prints.

## 3. Paste into the app
1. Open https://danstewart5.github.io/SiteWalk/ on the phone.
2. Scroll to **AI Code-Check Photo**.
3. Paste the Worker URL → **Save Worker URL**.
4. Take a test photo with **AI Code-Check Photo**.

If the network fails, the app shows a friendly offline message and still saves a punch-list note instead of a hard error.

## Security (already in the Worker)
- CORS is limited to `https://danstewart5.github.io` (see comment in `worker.js` to open it again for local testing).
- Optional `X-SiteWalk-Key` / `SITEWALK_KEY` stops random people from burning your Anthropic credits if they find the Worker URL.
- Anthropic key never lives in `index.html`.

Full detail: `AI_BACKEND_SETUP.md`.
