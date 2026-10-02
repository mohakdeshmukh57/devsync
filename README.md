# DevSync Vercel-ready

This version fixes the old build script. It is a Vite + React app and Vercel should run:

    npm install
    npm run build

Set these Vercel environment variables:

    VITE_SUPABASE_URL
    VITE_SUPABASE_PUBLISHABLE_KEY

Run `supabase/schema.sql` once in the Supabase SQL Editor.

## What's new
- Invite links now work (`/meeting/<id>?invite=<token>` joins after sign-in)
- TV / Room mode (`/tv/<id>`): full-screen live preview for a second screen
- Live team presence, line numbers, Tab indent, Ctrl/Cmd+S, file download, toasts
- Fixed: remote edits not reaching the open editor, and being sent to the dashboard on token refresh
- New `pro-theme.css` with smoother animations
