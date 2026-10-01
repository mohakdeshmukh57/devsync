# DevSync Vercel-ready

This version fixes the old build script. It is a Vite + React app and Vercel should run:

    npm install
    npm run build

Set these Vercel environment variables:

    VITE_SUPABASE_URL
    VITE_SUPABASE_PUBLISHABLE_KEY

Run `supabase/schema.sql` once in the Supabase SQL Editor.
