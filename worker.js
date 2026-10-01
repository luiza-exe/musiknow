const ALLOWED_ORIGIN    = 'https://muzicanow.netlify.app';
const APP_SECRET        = 'ohRF3zIrxcFBeb9vFdHgAI1Roq9Bka7c';
const RATE_LIMIT_MAX    = 70;
const RATE_LIMIT_WINDOW = 60 * 1000;
const rateLimitStore    = new Map();

const PROXY_ALLOWED_HOSTS = ['www.songsterr.com', 'songsterr.com'];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const secret = request.headers.get('X-App-Secret');
    const url    = new URL(request.url);

    const cors = {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-App-Secret',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: cors });

    // ════════════════════════════════════════════════════════════════════════
    // GET /proxy?url=...  — proxy Songsterr, protejat doar de APP_SECRET
    // Nu facem Origin check aici: browser-ul nu trimite intotdeauna Origin
    // la fetch-uri simple (no-cors, same-site navigations etc.).
    // Securitatea vine din faptul ca APP_SECRET nu e public + whitelist host.
    // ════════════════════════════════════════════════════════════════════════
    if (request.method === 'GET' && url.pathname === '/proxy') {
      if (secret !== APP_SECRET)
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403, headers: { ...cors, 'Content-Type': 'application/json' }
        });

      const targetUrl = url.searchParams.get('url');
      if (!targetUrl)
        return new Response(JSON.stringify({ error: 'Missing url param' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
        });

      let targetHost;
      try { targetHost = new URL(targetUrl).hostname; }
      catch {
        return new Response(JSON.stringify({ error: 'Invalid url' }), {
          status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      if (!PROXY_ALLOWED_HOSTS.includes(targetHost))
        return new Response(JSON.stringify({ error: 'Host not allowed' }), {
          status: 403, headers: { ...cors, 'Content-Type': 'application/json' }
        });

      let upstream;
      try {
        upstream = await fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, */*',
            'Referer': 'https://www.songsterr.com/',
          },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: 'Upstream fetch failed', detail: e.message }), {
          status: 502, headers: { ...cors, 'Content-Type': 'application/json' }
        });
      }

      if (!upstream.ok)
        return new Response(JSON.stringify({ error: 'Upstream error ' + upstream.status }), {
          status: upstream.status, headers: { ...cors, 'Content-Type': 'application/json' }
        });

      const body = await upstream.text();
      return new Response(body, {
        status: 200,
        headers: {
          ...cors,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // POST /  — logica Groq (neschimbata), cu Origin check strict
    // ════════════════════════════════════════════════════════════════════════
    if (request.method !== 'POST')
      return new Response('Method not allowed', { status: 405, headers: cors });

    if (origin !== ALLOWED_ORIGIN)
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' }
      });

    if (secret !== APP_SECRET)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' }
      });

    const ip  = request.headers.get('CF-Connecting-IP') || 'unknown';
    const now = Date.now();
    const rl  = rateLimitStore.get(ip) || { count: 0, windowStart: now };
    if (now - rl.windowStart > RATE_LIMIT_WINDOW) { rl.count = 0; rl.windowStart = now; }
    rl.count++;
    rateLimitStore.set(ip, rl);
    if (rl.count > RATE_LIMIT_MAX)
      return new Response(JSON.stringify({ error: 'Prea multe cereri!' }), {
        status: 429, headers: { ...cors, 'Content-Type': 'application/json' }
      });

    let body;
    try { body = await request.json(); }
    catch { return new Response(JSON.stringify({ error: 'JSON invalid' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }); }

    const { messages, systemPrompt } = body;
    if (!messages?.length)
      return new Response(JSON.stringify({ error: 'messages array required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

    const apiKey = env.GROQ_API_KEY;
    if (!apiKey)
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY lipsă.' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });

    const groqMessages = [];
    if (systemPrompt) groqMessages.push({ role: 'system', content: systemPrompt });
    for (const m of messages) groqMessages.push({ role: m.role, content: m.content });

    let res;
    try {
      res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: groqMessages,
          temperature: 0.4,
          max_tokens: 1024,
        }),
      });
    } catch {
      return new Response(JSON.stringify({ error: 'Nu s-a putut contacta Groq.' }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: 'Eroare Groq.', detail: err }), { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    console.log(`[musiknow] ip=${ip} req=${rl.count}`);
    return new Response(JSON.stringify({ text }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }
};
