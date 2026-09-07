/**
 * SiteWalk AI code-check — Cloudflare Worker
 *
 * Holds the Anthropic API key as a Worker secret (ANTHROPIC_API_KEY).
 * Never put that key in index.html or this file in plaintext for production.
 *
 * Deploy: see /AI_BACKEND_SETUP.md
 */

const MODEL = 'claude-sonnet-4-5';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
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
      return json({ error: 'POST a JSON body with { image, trade }' }, 405);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: 'ANTHROPIC_API_KEY secret is not set on this Worker' }, 500);
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const image = payload && payload.image;
    const trade = (payload && payload.trade) || 'General';
    if (!image || typeof image !== 'string' || image.indexOf('data:image') !== 0) {
      return json({ error: 'image must be a data:image… URL' }, 400);
    }

    const comma = image.indexOf(',');
    const header = image.slice(0, comma);
    const data = image.slice(comma + 1);
    const mimeMatch = header.match(/data:(image\/[a-zA-Z0-9.+-]+)/);
    const mediaType = mimeMatch ? mimeMatch[1] : 'image/jpeg';

    const prompt =
      'You are a construction field inspector. Look at this jobsite photo for the trade "' +
      trade +
      '". List likely building-code, safety, or workmanship issues that are visible. ' +
      'Be conservative: only flag what you can actually see. Use short bullet points. ' +
      'If nothing obvious is wrong, say so in one sentence. Do not invent code section numbers unless you are sure.';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
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

    const raw = await res.text();
    let dataJson;
    try {
      dataJson = JSON.parse(raw);
    } catch (e) {
      return json({ error: 'Bad response from Anthropic', detail: raw.slice(0, 300) }, 502);
    }
    if (!res.ok) {
      const msg = (dataJson.error && dataJson.error.message) || raw.slice(0, 300);
      return json({ error: msg }, res.status);
    }

    const blocks = dataJson.content || [];
    const text = blocks
      .filter(function (b) { return b.type === 'text'; })
      .map(function (b) { return b.text; })
      .join('\n')
      .trim();

    return json({ result: text || 'No text returned.' });
  },
};
