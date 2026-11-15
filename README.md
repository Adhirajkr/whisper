# Chaattiko

**Chaattiko** is the public website name. The GitHub repository and Supabase project intentionally retain the existing name **Whisper**.

## Stack
- React 19 + Vite
- Supabase Auth, PostgreSQL, Row Level Security and Realtime
- Vercel static hosting

## Local setup
1. Install Node.js 20 or later.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. Run `npm run dev`.

## Vercel
Import `Adhirajkr/whisper` in Vercel, select branch `chaattiko-vercel-supabase` for preview, Framework Preset **Vite**, Build Command `npm run build`, Output Directory `dist`. Add both Vite environment variables for Preview and Production. Vercel will deploy commits on the connected branch automatically.

## Supabase setup still required
- Project name remains Whisper; project URL is already configured in `.env.example`.
- Add the Supabase publishable key as `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel. A publishable key is intended for browser use; never put a service-role/secret key in a Vite variable.
- Disable anonymous sign-ins for this nickname/password design.
- For the current prototype's nickname-derived login, disable email confirmations. It uses a synthetic `<nickname>@login.chaattiko.invalid` identifier because Supabase password Auth expects an email or phone. This is a prototype shortcut; a hardened username-to-auth mapping endpoint is required before public launch.
- Apply the SQL migration in `supabase/migrations` (the current database has already received the initial schema update through the connected Supabase project).

## Security and completion status
This branch is an integration prototype, not a finished public launch. Admin review/moderation APIs, secure admin authentication, ban/kick enforcement, full private-chat membership checks, reliable presence, random pairing, reaction uniqueness, message expiry cleanup, and end-to-end security tests remain to be implemented and verified. Do not expose a Supabase service-role key in the browser. Admin access to private conversations must be implemented server-side and disclosed in the Terms & Conditions before enabling it.
