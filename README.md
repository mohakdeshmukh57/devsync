# DevSync 0.4 — collaborative coding workspace

React + Vite front end, Supabase (auth, Postgres, Storage, Realtime), Vercel hosting.

## What was wrong (and fixed)

**Meetings could not be created** because the old `meeting_members` row-level-security policy read from
`meeting_members` inside its own policy. Postgres rejects that ("infinite recursion detected in policy"),
so every meeting/members query failed. All membership checks now go through a `SECURITY DEFINER`
helper (`is_meeting_member`) — see `supabase/setup.sql`. The app also creates meetings through the
`create_meeting` RPC and shows actionable errors if the database setup hasn't been run.

Other bugs fixed in the app: file creation crashed (missing state), cleanup crashed (`saveTimer` undefined),
opening a file crashed (`collab` undefined), run output never appeared (nobody listened for the runner's
messages), toasts on the workspace never rendered, "Rename" did nothing, the TV screen showed nothing on
load, ICE candidates could be dropped in video calls, API functions used a signature Vercel doesn't call,
and typing replaced the whole document in the CRDT (so concurrent edits were not merged).

## Setup

1. **Supabase → SQL Editor:** paste and run `supabase/setup.sql` once. It is idempotent and also repairs
   databases created from the older scripts (which are removed).
2. **Supabase → Realtime settings:** turn **off** "Allow public access" so the private-channel policies apply.
3. **Supabase → Authentication:** if "Confirm email" is on, new users must click the email link before signing in
   (the app tells them). Turn it off for instant sign-up while developing.
4. **Environment variables** (Vercel → Settings → Environment Variables, or a local `.env`):
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. Optional: TURN (`VITE_TURN_*`) for video calls on strict
   networks, `JUDGE0_URL` + `JUDGE0_HEADERS_JSON` for other languages and the terminal, `AI_*` for the assistant.
5. **Deploy:** `npm install && npm run build` (Vercel does this). Locally: `npm run dev` for the app; use
   `vercel dev` if you also want the `/api` functions.

## Features

- Meetings: create, search, rename/delete (owner only, others get an error), copy invite link, join by link
- Editor: tabs with close buttons, line/column/character status bar, auto-indent, auto-closing brackets and quotes,
  Tab/Shift+Tab indent, Format button (JSON prettify, trailing-space trim), settings (font size, tab size, auto-close), saved in the browser
- Real-time editing with **Yjs** (CRDT): simultaneous typing in the same file merges instead of overwriting
- Run: JavaScript and Python run in the browser in a terminable Web Worker (10 s / 60 s limits, Stop button);
  Python's first run downloads the runtime. Other languages and the terminal use `/api/run-code` (Judge0). Ctrl/Cmd+Enter runs.
  HTML/CSS refresh the preview; JS linked from an HTML file runs in the preview and its console output appears in Output
- Preview: desktop/tablet/phone widths, refresh, open in new tab, console capture
- Files: folders, rename, duplicate, move, delete, filter, upload (text → files, anything else → private Storage "Assets"), ZIP download.
  Changes appear for collaborators immediately
- Command palette (Ctrl/Cmd+K, arrow keys + Enter), split panels, focus mode, TV/Room mode
- Video/audio calls and screen sharing (WebRTC, Supabase Realtime signaling), team chat, presence

## Limits to know about

- Video calls are peer-to-peer mesh: great for small groups (≈2–5); add a TURN server for restrictive networks.
- Shared cursors/selections of other people are not drawn (text itself is merged live).
- The terminal and non-JS/Python languages need a Judge0-compatible runner; without one the app says so.
- ZIP download includes text files; binary assets are downloaded individually from the Assets list.
