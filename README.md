Rule of Life: a Next.js (App Router) + Tailwind app with Supabase Auth + Postgres.

## Local setup

1) Create a Supabase project
- Get your project URL + anon key + service role key.
- In Supabase Auth, enable Anonymous sign-ins (no email/login needed).

2) Create tables + seed practices
- Run `supabase/migrations/20260201153000_init_rule_of_life.sql` in the Supabase SQL editor (or via Supabase CLI migrations).

3) Configure env vars
- Copy `.env.example` → `.env.local` and fill in:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (needed to cache `liturgical_days`)

4) Run
```bash
npm run dev
```

Open `http://localhost:3000`.

## Notes

- Timezone is fixed to `America/New_York` for liturgical season + “today”.
- Liturgical season comes from `romcal`. On first access to a year, the app caches that entire year into `liturgical_days` (requires `SUPABASE_SERVICE_ROLE_KEY`). Without it, the app will still compute seasons, but won’t persist the cache.

## Deploy (Vercel)

- Import the repo in Vercel.
- Set the same env vars from `.env.example`.
