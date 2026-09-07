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

## 2b. SITEWALK_KEY — do this last, in this order

If `SITEWALK_KEY` is **not** set, the Worker still runs. CORS limits callers to the GitHub Pages origin, but anyone who can hit that origin (or call the Worker from a non-browser client) can spend Anthropic credits. The check is off until you set the secret — it does not fail closed.

**Order is mandatory. Do not set the Cloudflare secret the same night you only merge code.**

1. Merge header support (`index.html` sends `X-SiteWalk-Key` when a key is saved) → confirm the live Pages URL `https://danstewart5.github.io/SiteWalk/` actually has the **Shared key** field.
2. Only then set `SITEWALK_KEY` in Cloudflare (steps below).
3. Save the same string in the app’s **Shared key** field → **Save Worker URL & key**.
4. Test one photo check live on that Pages URL before trusting it on site.

Setting the secret before the live page can send the header will 401 every AI check.

**From a phone (no Wrangler):**
1. Open https://dash.cloudflare.com → **Workers & Pages** → your `sitewalk-ai` worker.
2. **Settings** → **Variables and Secrets**.
3. Add secret name `SITEWALK_KEY`, value = a long random string you invent, encrypt/save.
4. Redeploy if the dashboard asks you to.

**From a computer:**
```bash
wrangler secret put SITEWALK_KEY
```

The Worker then requires header `X-SiteWalk-Key` on every POST. The phone only sends that header when a shared key is saved in the app. Leave the field blank while the Worker secret is unset.

## 3. Paste into the app
1. Open https://danstewart5.github.io/SiteWalk/ on the phone — not a Netlify preview. Preview origins will fail CORS against the tightened Worker and look like a dead network.
2. Scroll to **AI Code-Check Photo**.
3. Paste the Worker URL. Leave **Shared key** blank until step 2b is done.
4. Tap **Save Worker URL & key**.
5. Take a test photo with **AI Code-Check Photo**.

If the network fails, the app shows *AI check unavailable offline — item saved to punch list (unverified by AI)* and files a punch item prefixed `UNVERIFIED BY AI` so it is not treated as a passed check.

## Security (already in the Worker)
- CORS origin is `https://danstewart5.github.io` — that is the live Pages host (path `/SiteWalk/` is not part of the origin). If you later add a custom domain, update `ALLOWED_ORIGIN` in `worker.js` or phone calls will fail with a silent CORS error.
- To reopen CORS for local testing, change `ALLOWED_ORIGIN` back to `*` (comment is in the file).
- Optional `SITEWALK_KEY` stops strangers from burning credits once the live app and the Worker both have the same key.
- Anthropic key never lives in `index.html`. The shared key is stored only in this phone’s `localStorage` (`swAiKey`), not in the repo.

Full detail: `AI_BACKEND_SETUP.md`.
