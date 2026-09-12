/**
 * SiteWalk AI backend — Cloudflare Worker
 *
 * Three routes, all POST, all behind the same CORS + shared-key gate:
 *   /            (or /photo-check) — existing AI code-check photo flow
 *   /classify    — voice-to-punch-list: classify one spoken sentence into
 *                  {type, trade, text, costImpact}
 *   /transcribe  — speech-to-text for phones without SpeechRecognition
 *                  (iOS Safari), via Workers AI Whisper. Needs the `AI`
 *                  binding in wrangler.toml — no separate API key.
 *
 * Holds the Anthropic API key as a Worker secret (ANTHROPIC_API_KEY).
 * Optional shared secret: SITEWALK_KEY (dashboard or `wrangler secret put SITEWALK_KEY`).
 * If SITEWALK_KEY is unset, the header check is skipped (open gate — easy to forget).
 * Never put those keys in index.html or this file in plaintext for production.
 *
 * Deploy: see /AI_BACKEND_SETUP.md and /PHONE_SETUP.md
 */

const MODEL = 'claude-sonnet-4-5';
const TRADES = ['General', 'Plumbing', 'Electrical', 'Framing', 'Drywall', 'Roofing', 'Concrete', 'Landscaping', 'Other'];

// Tightened to the live GitHub Pages origin (host only; /SiteWalk/ is not part of origin).
// If you add a custom domain later, change ALLOWED_ORIGIN or the phone will get a silent CORS failure.
// To revert to open CORS for local/dev testing, change ALLOWED_ORIGIN back to '*'.
const ALLOWED_ORIGIN = 'https://danstewart5.github.io';

const CORS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-SiteWalk-Key',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (request.method !== 'POST') {
      return json({ error: 'POST a JSON body. See /AI_BACKEND_SETUP.md for routes.' }, 405);
    }

    // Shared-secret check. Unset SITEWALK_KEY = check skipped (does not fail closed).
    // Clients should send header: X-SiteWalk-Key: <same value>
    if (env.SITEWALK_KEY) {
      const provided = request.headers.get('X-SiteWalk-Key') || '';
      if (provided !== env.SITEWALK_KEY) {
        return json({
          error: 'Missing or invalid X-SiteWalk-Key header. Set the same shared secret on the Worker (SITEWALK_KEY) and in the app request.',
        }, 401);
      }
    }

    const path = new URL(request.url).pathname;
    if (path === '/classify') return handleClassify(request, env);
    if (path === '/transcribe') return handleTranscribe(request, env);
    return handlePhotoCheck(request, env);
  },
};

async function handlePhotoCheck(request, env) {
    if (!env.ANTHROPIC_API_KEY) {
      return json({
        error: 'ANTHROPIC_API_KEY secret is not set on this Worker. Run: wrangler secret put ANTHROPIC_API_KEY',
      }, 500);
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return json({ error: 'Invalid JSON body. Send { image: "data:image/…", trade: "…" }' }, 400);
    }

    const image = payload && payload.image;
    const trade = (payload && payload.trade) || 'General';
    if (!image || typeof image !== 'string' || image.indexOf('data:image') !== 0) {
      return json({
        error: 'Bad or missing photo. image must be a data:image… URL (JPEG/PNG from the phone camera).',
      }, 400);
    }

    const comma = image.indexOf(',');
    if (comma < 0) {
      return json({ error: 'Bad photo data URL (missing comma after media type).' }, 400);
    }
    const header = image.slice(0, comma);
    const data = image.slice(comma + 1);
    if (!data || data.length < 100) {
      return json({ error: 'Photo data looks empty or too small. Try another picture.' }, 400);
    }
    const mimeMatch = header.match(/data:(image\/[a-zA-Z0-9.+-]+)/);
    const mediaType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    const prompt =
      'You are a construction field inspector. Look at this jobsite photo for the trade "' +
      trade +
      '". List likely building-code, safety, or workmanship issues that are visible. ' +
      'Be conservative: only flag what you can actually see. Use short bullet points. ' +
      'If nothing obvious is wrong, say so in one sentence. Do not invent code section numbers unless you are sure.';

    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 600,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: mediaType, data: data },
                },
                { type: 'text', text: prompt },
              ],
            },
          ],
        }),
      });
    } catch (e) {
      return json({
        error: 'Could not reach Anthropic API. Check Worker network / try again.',
        detail: String(e && e.message ? e.message : e).slice(0, 200),
      }, 502);
    }

    const raw = await res.text();
    let dataJson;
    try {
      dataJson = JSON.parse(raw);
    } catch (e) {
      return json({ error: 'Bad response from Anthropic', detail: raw.slice(0, 300) }, 502);
    }
    if (!res.ok) {
      const msg = (dataJson.error && dataJson.error.message) || raw.slice(0, 300);
      // Clearer messaging for common billing / auth failures
      const lower = String(msg).toLowerCase();
      if (res.status === 401 || res.status === 403) {
        return json({
          error: 'Anthropic rejected the API key (unauthorized). Check ANTHROPIC_API_KEY secret.',
          detail: msg,
        }, res.status);
      }
      if (res.status === 429 || lower.includes('rate') || lower.includes('quota') || lower.includes('billing') || lower.includes('credit')) {
        return json({
          error: 'Anthropic billing/rate limit issue. Check plan, credits, or wait and retry.',
          detail: msg,
        }, res.status);
      }
      return json({ error: msg }, res.status);
    }

    const blocks = dataJson.content || [];
    const text = blocks
      .filter(function (b) { return b.type === 'text'; })
      .map(function (b) { return b.text; })
      .join('\n')
      .trim();

    return json({ result: text || 'No text returned.' });
}

async function callAnthropic(env, { maxTokens, content, prefill }) {
  const messages = [{ role: 'user', content }];
  if (prefill) messages.push({ role: 'assistant', content: prefill });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages }),
  });
  const raw = await res.text();
  let dataJson;
  try {
    dataJson = JSON.parse(raw);
  } catch (e) {
    throw new Error('Bad response from Anthropic: ' + raw.slice(0, 300));
  }
  if (!res.ok) {
    const msg = (dataJson.error && dataJson.error.message) || raw.slice(0, 300);
    throw new Error(msg);
  }
  const blocks = dataJson.content || [];
  return blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

// Voice-to-punch-list: classify one spoken sentence into a structured item.
// Body: { text: string, trade?: string }
// Reply: { type: 'punch'|'change_order'|'rfi', trade: string, text: string, costImpact: number|null }
async function handleClassify(request, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY secret is not set on this Worker.' }, 500);
  }
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return json({ error: 'Invalid JSON body. Send { text: "..." }' }, 400);
  }
  const text = (payload && payload.text || '').trim();
  if (!text) return json({ error: 'Missing text.' }, 400);

  const prompt =
    'Classify this single spoken sentence from a construction site supervisor\'s walk-around.\n\n' +
    'Sentence: "' + text.replace(/"/g, '\\"') + '"\n\n' +
    'Valid trades: ' + TRADES.join(', ') + '\n\n' +
    'type is one of:\n' +
    '- "punch": a deficiency or defect to fix (default if unsure)\n' +
    '- "change_order": extra work or cost beyond original scope, billable to the client\n' +
    '- "rfi": a question that needs an answer from architect/engineer/owner before work can proceed\n\n' +
    'Pick the single most relevant trade from the valid trades list. Use "General" only if truly unclear.\n' +
    'If type is "change_order" and a dollar amount is stated or clearly implied, extract it as a plain number ' +
    '(e.g. "add three hundred dollars" -> 300). Otherwise costImpact is null.\n\n' +
    'Reply with ONLY a JSON object, no other text, in exactly this shape:\n' +
    '{"type":"punch|change_order|rfi","trade":"<one of the valid trades>","text":"<cleaned-up concise version of the sentence>","costImpact":<number or null>}';

  let raw;
  try {
    raw = await callAnthropic(env, {
      maxTokens: 300,
      content: [{ type: 'text', text: prompt }],
      prefill: '{',
    });
  } catch (e) {
    return json({ error: 'Classify failed: ' + (e && e.message ? e.message : e) }, 502);
  }

  let parsed;
  try {
    parsed = JSON.parse('{' + raw.replace(/^\{/, ''));
  } catch (e) {
    return json({ error: 'Model returned non-JSON.', detail: raw.slice(0, 300) }, 502);
  }
  const type = ['punch', 'change_order', 'rfi'].includes(parsed.type) ? parsed.type : 'punch';
  const trade = TRADES.includes(parsed.trade) ? parsed.trade : 'General';
  const cleanText = (typeof parsed.text === 'string' && parsed.text.trim()) || text;
  const costImpact = typeof parsed.costImpact === 'number' && isFinite(parsed.costImpact) ? parsed.costImpact : null;
  return json({ type, trade, text: cleanText, costImpact });
}

// Speech-to-text for phones without SpeechRecognition (iOS Safari), via Workers AI Whisper.
// Body: { audio: base64 (no data: prefix), mimeType?: string }
// Reply: { text: string }
async function handleTranscribe(request, env) {
  if (!env.AI) {
    return json({ error: 'Workers AI (AI binding) is not configured on this Worker. Add [ai] binding = "AI" to wrangler.toml and redeploy.' }, 500);
  }
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return json({ error: 'Invalid JSON body. Send { audio: "<base64>" }' }, 400);
  }
  const b64 = payload && payload.audio;
  if (!b64 || typeof b64 !== 'string') {
    return json({ error: 'Missing audio (base64-encoded clip, no data: prefix).' }, 400);
  }
  let bytes;
  try {
    const bin = atob(b64.indexOf(',') >= 0 ? b64.slice(b64.indexOf(',') + 1) : b64);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch (e) {
    return json({ error: 'Could not decode base64 audio.' }, 400);
  }
  if (bytes.length < 100) {
    return json({ error: 'Audio clip looks empty or too short.' }, 400);
  }

  let result;
  try {
    result = await env.AI.run('@cf/openai/whisper-large-v3-turbo', { audio: Array.from(bytes) });
  } catch (e) {
    return json({ error: 'Transcription failed: ' + (e && e.message ? e.message : e) }, 502);
  }
  const text = (result && (result.text || result.transcript) || '').trim();
  return json({ text });
}
