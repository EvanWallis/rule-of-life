import {
  LANE_LABEL,
  LANE_ORDER,
  SEASON_LABEL,
  SEASON_ORDER,
  applyOverrides,
  sortPractices,
  weekdayLabel,
  type Practice,
  type PracticeOverride,
} from "@/lib/practices";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RulePage() {
  const supabase = createClient();

  const { data: practicesData, error: practicesError } = await supabase
    .from("practices")
    .select("id, key, season, lane, title, description, recurrence, scheduled_weekday, is_active, sort_order")
    .eq("is_active", true);

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
  const effectiveAll = sortPractices(applyOverrides(practices, overrides));

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rule</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Your full rule set, organized by liturgical season.
        </p>
      </div>

      <div className="grid gap-4">
        {SEASON_ORDER.map((season) => {
          const seasonPractices = effectiveAll.filter((p) => p.season === season);
          if (seasonPractices.length === 0) return null;

          return (
            <section key={season} className="rounded-3xl border border-black/10 bg-white/60 px-5 py-5">
              <h2 className="text-lg font-semibold tracking-tight">{SEASON_LABEL[season]}</h2>

              <div className="mt-4 grid gap-5">
                {LANE_ORDER.map((lane) => {
                  const lanePractices = seasonPractices.filter((p) => p.lane === lane);
                  if (lanePractices.length === 0) return null;

                  return (
                    <div key={lane} className="grid gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                        {LANE_LABEL[lane]}
                      </h3>
                      <div className="grid gap-2">
                        {lanePractices.map((p) => {
                          const when =
                            p.recurrence === "WEEKLY"
                              ? p.effective_scheduled_weekday == null
                                ? "Weekly"
                                : `Weekly on ${weekdayLabel(p.effective_scheduled_weekday)}`
                              : "Daily";

                          return (
                            <div
                              key={p.id}
                              className={`rounded-2xl border border-black/10 bg-white/70 px-4 py-3 ${
                                p.is_enabled ? "" : "opacity-60"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-[var(--foreground)]">
                                    {p.effective_title}
                                  </p>
                                  {p.effective_description ? (
                                    <p className="mt-1 text-xs text-[var(--ink-soft)]">
                                      {p.effective_description}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <span className="rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                                    {when}
                                  </span>
                                  {!p.is_enabled ? (
                                    <span className="rounded-full bg-black/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                                      Disabled
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

