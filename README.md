# DevSync live foundation

A real collaborative coding workspace foundation built around Supabase and Netlify.

### Services wired into the app
- Supabase Auth + Postgres + Storage + Realtime
- Yjs collaborative editor updates over private Realtime channels
- WebRTC audio/video and screen sharing with Realtime signaling
- Netlify Function code-runner proxy
- TV/Room mode
- HTML/CSS/JavaScript local preview

### Setup
Run `supabase/schema.sql` in a Supabase project, then copy `config.example.js` to `config.js` and add the project's publishable browser key.

Install Netlify CLI for local development: `npm install` then `npm run dev`.

Before enabling non-web code execution, configure `CODE_RUNNER_URL` and (optionally) `CODE_RUNNER_API_KEY` in Netlify. The external runner must hard-sandbox arbitrary code.

For production WebRTC reliability, configure a TURN server in `config.js` using your own credentials.
