const LANGUAGE_NAMES = {
  javascript: ['javascript', 'JavaScript', 'node.js'],
  typescript: ['typescript', 'TypeScript'],
  python: ['python', 'Python'],
  java: ['java', 'Java'],
  c: ['c', 'C'],
  cpp: ['cpp', 'C++'],
  csharp: ['csharp', 'C#'],
  go: ['go', 'Go'],
  rust: ['rust', 'Rust'],
  php: ['php', 'PHP'],
  ruby: ['ruby', 'Ruby'],
  swift: ['swift', 'Swift'],
  kotlin: ['kotlin', 'Kotlin'],
  dart: ['dart', 'Dart'],
  sql: ['sql', 'SQL'],
  shell: ['bash', 'Bash', 'Shell'],
};

let cachedLanguages = null;
let cachedAt = 0;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function authHeaders() {
  const result = { 'content-type': 'application/json' };
  if (process.env.JUDGE0_HEADERS_JSON) {
    try {
      Object.assign(result, JSON.parse(process.env.JUDGE0_HEADERS_JSON));
    } catch {
      // Ignore malformed optional header JSON; the request will fail cleanly.
    }
  }
  if (process.env.JUDGE0_API_KEY) {
    result['x-rapidapi-key'] = process.env.JUDGE0_API_KEY;
  }
  if (process.env.JUDGE0_API_HOST) {
    result['x-rapidapi-host'] = process.env.JUDGE0_API_HOST;
  }
  if (process.env.JUDGE0_BEARER_TOKEN) {
    result.authorization = `Bearer ${process.env.JUDGE0_BEARER_TOKEN}`;
  }
  return result;
}

async function getLanguages(baseUrl) {
  const now = Date.now();
  if (cachedLanguages && now - cachedAt < 10 * 60 * 1000) return cachedLanguages;
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/languages`, {
    headers: authHeaders(),
  });
  if (!response.ok) throw new Error(`Runner language lookup failed (${response.status}).`);
  cachedLanguages = await response.json();
  cachedAt = now;
  return cachedLanguages;
}

function findLanguage(languages, requested) {
  const candidates = (LANGUAGE_NAMES[requested] || [requested]).map(v => v.toLowerCase());
  return languages.find(item => {
    const names = [item.name, ...(item.aliases || [])].filter(Boolean).map(v => String(v).toLowerCase());
    return names.some(n => candidates.includes(n));
  });
}

async function handle(req) {
  if (req.method !== 'POST') return json({ error: 'POST required' }, 405);

  const baseUrl = process.env.JUDGE0_URL;
  if (!baseUrl) {
    return json({
      error: 'Secure execution is not connected yet. Add JUDGE0_URL and the required private authentication headers in Vercel.',
    }, 503);
  }

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON.' }, 400); }

  const language = String(body.language || '').toLowerCase();
  const source = String(body.code || '');
  const stdin = String(body.stdin || '');

  if (!LANGUAGE_NAMES[language]) return json({ error: `Language ${language} is not enabled.` }, 400);
  if (!source.trim()) return json({ error: 'Code is empty.' }, 400);
  if (source.length > 200_000) return json({ error: 'Code is too large for a single run.' }, 413);
  if (stdin.length > 20_000) return json({ error: 'Input is too large.' }, 413);

  try {
    const languages = await getLanguages(baseUrl);
    const runtime = findLanguage(languages, language);
    if (!runtime) return json({ error: `No runtime matching ${language} is available on the configured runner.` }, 400);

    const payload = {
      language_id: runtime.id,
      source_code: source,
      stdin,
      cpu_time_limit: 2,
      wall_time_limit: 5,
      memory_limit: 128000,
      max_file_size: 2000,
      enable_per_process_and_thread_time_limit: true,
      enable_per_process_and_thread_memory_limit: true,
    };

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/submissions?base64_encoded=false&wait=true`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json({ error: result.message || result.error || `Runner returned ${response.status}.` }, response.status);
    }

    return json({
      status: result.status,
      stdout: result.stdout || '',
      stderr: result.stderr || '',
      compile_output: result.compile_output || '',
      message: result.message || '',
      time: result.time,
      memory: result.memory,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Execution service failed.' }, 502);
  }
}

// Vercel Functions Web Standard export (a bare `export default function(req)` would receive a Node request).
export default {
  async fetch(request) {
    return handle(request);
  },
};
