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
4. Store the Anthropic key as a Worker secret:
   ```bash
   wrangler secret put ANTHROPIC_API_KEY
   ```
5. Copy the `https://….workers.dev` URL Wrangler prints.

## 2b. SITEWALK_KEY (optional, but easy to forget)

If `SITEWALK_KEY` is **not** set, the Worker still runs. CORS limits callers to the GitHub Pages origin, but anyone who can hit that origin (or call the Worker from a non-browser client) can spend Anthropic credits. The check is off until you set the secret — it does not fail closed.

**From a phone (no Wrangler):**
1. Open https://dash.cloudflare.com → **Workers & Pages** → your `sitewalk-ai` worker.
2. **Settings** → **Variables and Secrets**.
3. Add secret name `SITEWALK_KEY`, value = a long random string you invent, encrypt/save.
4. Redeploy if the dashboard asks you to.

**From a computer:**
```bash
wrangler secret put SITEWALK_KEY
```

The Worker then requires header `X-SiteWalk-Key` on every POST. The phone UI does not send that header yet — do not set the secret until the app is updated to send it, or AI checks will 401.

## 3. Paste into the app
1. Open https://danstewart5.github.io/SiteWalk/ on the phone.
2. Scroll to **AI Code-Check Photo**.
3. Paste the Worker URL → **Save Worker URL**.
4. Take a test photo with **AI Code-Check Photo**.

If the network fails, the app shows *AI check unavailable offline — item saved to punch list (unverified by AI)* and files a punch item prefixed `UNVERIFIED BY AI` so it is not treated as a passed check.

## Security (already in the Worker)
- CORS origin is `https://danstewart5.github.io` — that is the live Pages host (path `/SiteWalk/` is not part of the origin). If you later add a custom domain, update `ALLOWED_ORIGIN` in `worker.js` or phone calls will fail with a silent CORS error.
- To reopen CORS for local testing, change `ALLOWED_ORIGIN` back to `*` (comment is in the file).
- Optional `SITEWALK_KEY` stops strangers from burning credits once you wire the header.
- Anthropic key never lives in `index.html`.

Full detail: `AI_BACKEND_SETUP.md`.
