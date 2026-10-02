function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!baseUrl || !apiKey || !model) {
    return json({
      error: 'AI assistant is not configured. Add AI_BASE_URL, AI_API_KEY and AI_MODEL in Vercel.',
    }, 503);
  }

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }

  const prompt = String(body.prompt || '').trim();
  const file = body.file || {};
  if (!prompt) return json({ error: 'Enter a question for the assistant.' }, 400);

  const system = `You are DevSync Assistant, a concise coding teammate.\n\nCurrent file: ${file.name || 'unknown'}\nLanguage: ${file.language || 'unknown'}\nCode:\n${String(file.content || '').slice(0, 12000)}`;

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return json({ error: result.error?.message || `AI provider returned ${response.status}.` }, response.status);
    const text = result.choices?.[0]?.message?.content || '';
    return json({ text });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'AI provider failed.' }, 502);
  }
}
