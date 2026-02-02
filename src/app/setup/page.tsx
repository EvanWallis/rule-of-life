export default function SetupPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Rule of Life</h1>
      <p className="mt-2 text-sm text-[var(--ink-soft)]">
        This app stores your checklist + history in Supabase so it works on your phone.
      </p>

      <div className="mt-8 grid gap-4 rounded-3xl border border-black/10 bg-white/70 px-5 py-5">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">1) Supabase Auth</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Enable anonymous sign-ins (no email/login).</p>
        </div>

        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">2) Database</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Run the migration in <code className="font-mono">supabase/migrations</code> to create tables + seed
            practices.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">3) Env vars</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Set <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Optional:{" "}
            <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> to cache liturgical years.
          </p>
        </div>
      </div>

      <p className="mt-6 text-xs text-[var(--ink-soft)]">
        After setting those, refresh. If you’re deployed on Vercel, set env vars in the Vercel dashboard.
      </p>
    </div>
  );
}

