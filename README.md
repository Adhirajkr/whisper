# Whisper — The Common Room

A no-email, no-password public chat room. Visitors create a temporary Supabase anonymous session, choose a unique display name, and exchange messages in real time.

## Stack
- Vite + vanilla JavaScript
- Supabase Auth (anonymous sign-ins)
- Supabase Postgres with Row Level Security
- Supabase Realtime

## Local setup
1. Copy `.env.example` to `.env.local`.
2. Add the Supabase project URL and **publishable/anon key**. Never put a service-role key in browser code.
3. In Supabase Dashboard → Authentication → Providers, enable **Anonymous Sign-Ins**.
4. The SQL migration in `supabase/migrations/20261113200000_whisper_room_hardening.sql` has already been applied to the linked Whisper project.
5. Run `npm install` and `npm run dev`.

## Vercel deployment
1. Import `Adhirajkr/whisper` into Vercel.
2. Framework preset: **Vite**; build command: `npm run build`; output directory: `dist`.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the Vercel environment.
4. Deploy.

## Current app behavior
- No email, password, or real-name field is requested.
- Display names are public, unique, and limited to 3–20 letters, numbers, or underscores.
- Messages are shared in one common room and update through Supabase Realtime.
- New messages receive a server-enforced seven-day expiry; expired messages are hidden from normal reads.
- The frontend currently renders plain text messages. The database has a reactions table, but reaction controls are not yet wired into this first frontend pass.

## Privacy and launch checklist
- Display names and messages are public. Do not use personal identifiers or share sensitive information.
- Anonymous sessions are browser/device-specific. Clearing browser data can lose the session and profile.
- Enable CAPTCHA/Turnstile and tune Auth rate limits before opening the room publicly.
- Seven-day expiry currently means messages become invisible after seven days. A scheduled cleanup job is still needed for physical deletion from the database.
- Add reporting, moderation, and abuse controls before sharing widely...
