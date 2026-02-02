import { applyOverrides, type Practice, type PracticeLane, type PracticeOverride, weekdayLabel } from "@/lib/practices";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIME_ZONE, getLocalToday, getLocalWeekdayIndex } from "@/lib/time";
import Link from "next/link";

export const dynamic = "force-dynamic";

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function isValidMonth(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

function addMonths(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  const ny = date.getUTCFullYear();
  const nm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${ny}-${nm}`;
}

function getMonthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const start = `${month}-01`;
  const end = `${month}-${String(daysInMonth).padStart(2, "0")}`;
  return { year: y, monthNumber: m, daysInMonth, start, end };
}

function formatMonthTitle(month: string) {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function laneLabel(lane: PracticeLane) {
  switch (lane) {
    case "PRAYER":
      return "Prayer";
    case "ASCETIC":
      return "Ascetic";
    case "CHARITY":
      return "Charity";
    case "ATTENTION":
      return "Attention";
  }
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const todayLocal = getLocalToday(DEFAULT_TIME_ZONE);
  const defaultMonth = todayLocal.slice(0, 7);
  const monthParam = typeof params.month === "string" ? params.month : defaultMonth;
  const month = isValidMonth(monthParam) ? monthParam : defaultMonth;

  const selectedDate = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null;

  const { start, end, daysInMonth } = getMonthBounds(month);
  const firstWeekdayIdx = getLocalWeekdayIndex(new Date(`${start}T12:00:00Z`), DEFAULT_TIME_ZONE);

  const supabase = createClient();

  const { data: completionsData, error: completionsError } = await supabase
    .from("practice_completions")
    .select("date_local, practice_id, completed_at")
    .gte("date_local", start)
    .lte("date_local", end);

  if (completionsError) {
    throw new Error(completionsError.message);
  }

  const completions = completionsData ?? [];

  const byDate = new Map<string, { practiceIds: string[]; completedAt: Record<string, string> }>();
  completions.forEach((c) => {
    const dateLocal = String(c.date_local);
    const practiceId = String(c.practice_id);
    const completedAt = c.completed_at ? String(c.completed_at) : "";

    const existing = byDate.get(dateLocal) ?? { practiceIds: [], completedAt: {} };
    existing.practiceIds.push(practiceId);
    if (completedAt) existing.completedAt[practiceId] = completedAt;
    byDate.set(dateLocal, existing);
  });

  const { data: practicesData, error: practicesError } = await supabase
    .from("practices")
    .select("id, key, season, lane, title, description, recurrence, scheduled_weekday, is_active, sort_order");

  if (practicesError) {
    throw new Error(practicesError.message);
  }

  const practices = (practicesData ?? []) as Practice[];
  const practiceIds = practices.map((p) => p.id);

  const { data: overridesData, error: overridesError } = await supabase
    .from("user_practice_overrides")
    .select("user_id, practice_id, scheduled_weekday, is_enabled, custom_title, custom_description")
    .in("practice_id", practiceIds);

  if (overridesError) {
    throw new Error(overridesError.message);
  }

  const overrides = (overridesData ?? []) as PracticeOverride[];
  const effective = applyOverrides(practices, overrides);
  const effectiveById = new Map(effective.map((p) => [p.id, p]));

  const leadingBlanks = firstWeekdayIdx;
  const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;
  const cells = Array.from({ length: totalCells }).map((_, idx) => {
    const day = idx - leadingBlanks + 1;
    if (day < 1 || day > daysInMonth) return null;
    return `${month}-${String(day).padStart(2, "0")}`;
  });

  const prevMonth = addMonths(month, -1);
  const nextMonth = addMonths(month, 1);

  const selected = selectedDate && selectedDate.startsWith(month) ? selectedDate : null;
  const selectedPracticeIds = selected ? byDate.get(selected)?.practiceIds ?? [] : [];

  const selectedItems = selectedPracticeIds
    .map((id) => {
      const p = effectiveById.get(id);
      if (!p) {
        return { id, lane: "ATTENTION" as PracticeLane, title: "Unknown practice", when: "" };
      }
      const when =
        p.recurrence === "WEEKLY"
          ? p.effective_scheduled_weekday == null
            ? "Weekly"
            : `Weekly on ${weekdayLabel(p.effective_scheduled_weekday)}`
          : "Daily";
      return { id, lane: p.lane, title: p.effective_title, when };
    })
    .sort((a, b) => a.lane.localeCompare(b.lane) || a.title.localeCompare(b.title));

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">A simple calendar of what you completed each day.</p>
      </div>

      <section className="rounded-3xl border border-black/10 bg-white/60 px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={{ pathname: "/history", query: { month: prevMonth } }}
            className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-semibold text-[var(--ink-soft)] transition hover:bg-white"
          >
            Prev
          </Link>

          <div className="text-sm font-semibold text-[var(--foreground)]">{formatMonthTitle(month)}</div>

          <Link
            href={{ pathname: "/history", query: { month: nextMonth } }}
            className="rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-semibold text-[var(--ink-soft)] transition hover:bg-white"
          >
            Next
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-2 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          {WEEKDAY_HEADERS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {cells.map((date, idx) => {
            if (!date) {
              return <div key={`empty-${idx}`} className="h-16 rounded-2xl bg-transparent" />;
            }

            const dayNumber = Number(date.slice(8, 10));
            const count = byDate.get(date)?.practiceIds.length ?? 0;
            const isSelected = selected === date;

            return (
              <Link
                key={date}
                href={{ pathname: "/history", query: { month, date } }}
                className={`flex h-16 flex-col justify-between rounded-2xl border px-3 py-2 transition ${
                  isSelected
                    ? "border-[var(--accent)] bg-[var(--surface)]"
                    : "border-black/10 bg-white/70 hover:bg-white"
                }`}
              >
                <div className="text-xs font-semibold text-[var(--foreground)]">{dayNumber}</div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                  {count ? `${count} done` : ""}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {selected ? (
        <section className="rounded-3xl border border-black/10 bg-white/60 px-5 py-5">
          <h2 className="text-lg font-semibold tracking-tight">{selected}</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            {selectedItems.length ? `${selectedItems.length} completed.` : "No completions."}
          </p>

          {selectedItems.length ? (
            <div className="mt-4 grid gap-2">
              {selectedItems.map((it) => (
                <div key={it.id} className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{it.title}</p>
                      <p className="mt-1 text-xs text-[var(--ink-soft)]">
                        {laneLabel(it.lane)} • {it.when}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

