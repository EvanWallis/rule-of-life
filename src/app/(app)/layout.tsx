import Link from "next/link";

const NAV_LINKS = [
  { href: "/today", label: "Today" },
  { href: "/rule", label: "Rule" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-black/10 bg-[var(--background)]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-4">
            <Link href="/today" className="text-base font-semibold tracking-tight">
              Rule of Life
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--ink-soft)] transition hover:bg-black/5 hover:text-[var(--foreground)]"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          <div />
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-6">{children}</main>

      <nav className="sticky bottom-0 z-10 border-t border-black/10 bg-[var(--background)]/90 backdrop-blur sm:hidden">
        <div className="mx-auto grid w-full max-w-3xl grid-cols-4 gap-1 px-2 py-2">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-xl px-2 py-2 text-center text-[11px] font-semibold text-[var(--ink-soft)] transition hover:bg-black/5 hover:text-[var(--foreground)]"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
