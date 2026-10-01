# DevSync launch checklist

1. Supabase Auth: enable email/password, then use the included login/register UI.
2. Supabase database: run `supabase/schema.sql` in SQL Editor.
3. Storage: project assets use the private `project-assets` bucket.
4. Collaboration: Yjs + Supabase Realtime Broadcast is wired to each file channel.
5. Audio/video: WebRTC mesh + Supabase Realtime Presence/Broadcast signaling are wired.
6. Screen share: browser `getDisplayMedia()` replaces the outgoing video track.
7. Code execution: web projects run in a sandboxed preview; other languages go through the Netlify function to an external sandbox runner.
8. TV/Room mode: `/tv/<meeting-id>` shows the current HTML/CSS/JS output.
9. Netlify: use `npm run build`, publish `dist`.
10. Domain: after deployment, add the custom domain in Netlify Domain management.
