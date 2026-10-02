# DevSync 0.3 — collaborative coding workspace

DevSync now has the real application loop wired around Supabase + Vercel:

- Supabase email/password authentication
- Dashboard and real meeting creation
- Invite links and meeting membership
- Postgres-backed project files
- Folder creation and file management
- Private Supabase Storage for binary project assets
- Realtime presence, team chat and file synchronization
- CRDT-backed collaborative text synchronization with Yjs over Supabase Realtime
- WebRTC audio/video with browser screen sharing
- Responsive workspace inspired by the provided editor reference
- HTML/CSS/JS local-file linking and live preview
- Browser JavaScript execution in an isolated iframe
- Browser Python execution with Pyodide
- Server-side execution gateway for other languages through Judge0-compatible services
- Shared terminal through the same sandboxed runner
- TV / Room output mode
- Split editor panels, focus mode, command palette, download ZIP, editor settings
- Optional server-side AI assistant through an OpenAI-compatible endpoint

## 1. Vercel environment variables

Required in Vercel:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Optional WebRTC TURN variables:

```text
VITE_TURN_URL
VITE_TURN_USERNAME
VITE_TURN_CREDENTIAL
```

Optional secure code execution:

```text
JUDGE0_URL
JUDGE0_HEADERS_JSON
```

Optional AI assistant:

```text
AI_BASE_URL
AI_API_KEY
AI_MODEL
```

Do not put secret server credentials in `VITE_*` variables.

## 2. Supabase migration

The repository contains the original schema plus:

```text
supabase/migration_v2.sql
```

Run `migration_v2.sql` in the Supabase SQL Editor after the original schema has already been applied. It adds folders and authorizes the `call:<meeting-id>` Realtime channel used for WebRTC signaling.

For Realtime, keep the meeting/file/call channels private. Supabase's current Realtime authorization model uses RLS policies on `realtime.messages` and private channels for authenticated access.

## 3. Deploy

The project is a Vite app. Vercel builds it with:

```text
npm install
npm run build
```

The `api/` directory is automatically exposed as Vercel Functions.

## 4. Secure code execution

The browser handles HTML/CSS/JavaScript preview locally and Python in a browser sandbox. Other languages and the shared terminal call `/api/run-code`, which forwards to a Judge0-compatible execution service.

The server-side runner must enforce CPU, wall-time, memory, filesystem, process and output limits. This project never executes arbitrary user code directly in the Vercel application process.

Judge0 documents sandboxed execution, 90+ languages, and configurable time/memory constraints. Use a managed or self-hosted Judge0-compatible service and keep its credentials server-side.

## 5. WebRTC

DevSync uses WebRTC media with Supabase Realtime as the signaling channel. A STUN server is built in. For production reliability across restrictive NAT/firewall combinations, configure a TURN service.

## 6. Custom domain

After Vercel deployment succeeds, add your domain in:

Vercel → Project → Settings → Domains

Then point your domain's DNS records to Vercel as shown by the dashboard.
