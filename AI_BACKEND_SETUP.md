# SiteWalk AI Code-Check — one-time setup

The phone app can take a photo. It cannot hold an Anthropic API key in a public GitHub Pages file. This Worker is the lockbox.

Takes about 10–15 minutes. Free tier is enough for a pilot.

## What you will have at the end

1. A URL like `https://sitewalk-ai.YOURNAME.workers.dev`
2. That URL pasted into the **AI Code-Check Photo** box on the phone
3. Photos sent only when you tap the button — not in the background

## 1. Anthropic API key

1. Create an account at https://console.anthropic.com
2. Create an API key
3. Copy it once. Do not commit it to GitHub.

Cost is a fraction of a cent per photo on the model in `ai-backend/worker.js`.

## 2. Cloudflare Worker

1. Sign up at https://dash.cloudflare.com (free)
2. Install Wrangler if you don’t have it:

```bash
npm install -g wrangler
wrangler login
```

3. From this repo:

```bash
cd ai-backend
wrangler deploy
```

If Cloudflare asks for a worker name, `sitewalk-ai` is fine.

4. Store the key as a **secret** (this does not go in the file):

```bash
wrangler secret put ANTHROPIC_API_KEY
```

Paste the key when prompted.

5. Copy the `*.workers.dev` URL Wrangler prints.

## 3. Hook it to the phone

1. Open https://danstewart5.github.io/SiteWalk/ (live Pages — not a Netlify preview)
2. In **AI Code-Check Photo**, paste the Worker URL
3. Leave **Shared key** blank until `SITEWALK_KEY` is set on the Worker
4. Tap **Save Worker URL & key**
5. Take a test photo

If the URL is missing, the button stays inert and tells you so. That is intentional.

## 4. Optional shared key (after the live page is deployed)

Do **not** set `SITEWALK_KEY` the same night you only merge code.

1. Confirm the live Pages app shows the Shared key field
2. Then `wrangler secret put SITEWALK_KEY` (or Cloudflare dashboard → Worker → Settings → Variables and Secrets)
3. Save the same string in the app
4. Run one live photo check before using it on site

Until that secret exists, the Worker skips the header check (fail-open). Phone only sends `X-SiteWalk-Key` when a key is saved locally.

Phone-oriented version of this list: `PHONE_SETUP.md`.

## Security notes

- The Anthropic key lives only in the Cloudflare secret store.
- `index.html` never contains the Anthropic key. The optional shared key lives only in this phone’s `localStorage` (`swAiKey`).
- CORS is locked to `https://danstewart5.github.io`. Path `/SiteWalk/` is not part of the origin. Localhost, `file://`, and Netlify previews will fail CORS and look like a dead network. To reopen for local/dev, set `ALLOWED_ORIGIN` back to `*` in `worker.js`.
- Anyone who has the Worker URL can spend Anthropic credits until `SITEWALK_KEY` is set on both sides.

## Files

- `ai-backend/worker.js` — the function
- `index.html` — phone UI; stores the Worker URL in `localStorage` key `swAiEndpoint` and the optional shared key in `swAiKey`
- `PHONE_SETUP.md` — short checklist including the merge-then-secret order
