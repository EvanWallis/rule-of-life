import {
  LANE_LABEL,
  SEASON_LABEL,
  SEASON_ORDER,
  applyOverrides,
  weekdayLabel,
  type Practice,
  type PracticeOverride,
} from "@/lib/practices";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export const dynamic = "force-dynamic";

function normalizeWakeTimeInput(value: string | null) {
  const v = (value ?? "").trim();
  if (!v) return null;
  return v;
}

export default async function SettingsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  async function saveSettings(formData: FormData) {
    "use server";

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return;
    }

    const wakeTime = normalizeWakeTimeInput(String(formData.get("wake_time") ?? ""));

    const practiceIds = formData.getAll("practice_id").map(String);

    const overrideRows = practiceIds
      .map((practiceId) => {
        const weekdayRaw = formData.get(`weekday_${practiceId}`);
        const enabledRaw = formData.get(`enabled_${practiceId}`);
        const scheduled_weekday = weekdayRaw === null ? null : Number(String(weekdayRaw));
        const is_enabled = enabledRaw === "on";

        if (scheduled_weekday === null || Number.isNaN(scheduled_weekday)) {
          return null;
        }

        return {
          user_id: user.id,
          practice_id: practiceId,
          scheduled_weekday,
          is_enabled,
        };
      })
      .filter(Boolean) as { user_id: string; practice_id: string; scheduled_weekday: number; is_enabled: boolean }[];

    if (overrideRows.length) {
      await supabase
        .from("user_practice_overrides")
        .upsert(overrideRows, { onConflict: "user_id,practice_id" });
    }

    await supabase.from("user_settings").upsert({ user_id: user.id, wake_time: wakeTime }, { onConflict: "user_id" });

    revalidatePath("/settings");
    revalidatePath("/today");
    revalidatePath("/rule");
  }

  const { data: weeklyPracticesData, error: weeklyError } = await supabase
    .from("practices")
    .select("id, key, season, lane, title, description, recurrence, scheduled_weekday, is_active, sort_order")
    .eq("recurrence", "WEEKLY")
    .eq("is_active", true);

  if (weeklyError) {
    throw new Error(weeklyError.message);
  }

  const weeklyPractices = (weeklyPracticesData ?? []) as Practice[];
  const weeklyIds = weeklyPractices.map((p) => p.id);

  const { data: overridesData, error: overridesError } = await supabase
    .from("user_practice_overrides")
    .select("user_id, practice_id, scheduled_weekday, is_enabled, custom_title, custom_description")
    .in("practice_id", weeklyIds);

  if (overridesError) {
    throw new Error(overridesError.message);
  }

  const overrides = (overridesData ?? []) as PracticeOverride[];
  const weeklyEffective = applyOverrides(weeklyPractices, overrides);

  const { data: settingsData } = await supabase
    .from("user_settings")
    .select("wake_time")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  const wakeTime = settingsData?.wake_time ? String(settingsData.wake_time).slice(0, 5) : "";

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">
          Adjust weekdays for weekly practices. Weekly tasks only appear on their scheduled day.
        </p>
      </div>

      <form action={saveSettings} className="grid gap-6">
        <section className="rounded-3xl border border-black/10 bg-white/60 px-5 py-5">
          <h2 className="text-lg font-semibold tracking-tight">Wake Time</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Used for the Easter “Fixed wake time” practice.</p>

          <label className="mt-4 grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
              Wake time
            </span>
            <input
              type="time"
              name="wake_time"
              defaultValue={wakeTime}
              className="h-11 w-full max-w-xs rounded-xl border border-black/10 bg-white/70 px-4 text-sm outline-none focus:border-black/25"
            />
          </label>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white/60 px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Weekly Practices</h2>
              <p className="mt-1 text-sm text-[var(--ink-soft)]">Pick a weekday and optionally disable.</p>
            </div>
            <button
              type="submit"
              className="h-11 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)]"
            >
              Save
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            {SEASON_ORDER.map((season) => {
              const seasonPractices = weeklyEffective.filter((p) => p.season === season);
              if (seasonPractices.length === 0) return null;

              return (
                <div key={season} className="grid gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                    {SEASON_LABEL[season]}
                  </h3>

                  <div className="grid gap-2">
                    {seasonPractices.map((p) => {
                      const effectiveWeekday = p.effective_scheduled_weekday ?? p.scheduled_weekday ?? 0;
                      const isEnabled = p.is_enabled;

                      return (
                        <div key={p.id} className="rounded-2xl border border-black/10 bg-white/70 px-4 py-4">
                          <input type="hidden" name="practice_id" value={p.id} />

                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[var(--foreground)]">
                                {p.effective_title}
                              </p>
                              <p className="mt-1 text-xs text-[var(--ink-soft)]">
                                {LANE_LABEL[p.lane]} • {weekdayLabel(effectiveWeekday)}
                              </p>
                              {p.effective_description ? (
                                <p className="mt-2 text-xs text-[var(--ink-soft)]">
                                  {p.effective_description}
                                </p>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-3">
                              <label className="grid gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                                  Weekday
                                </span>
                                <select
                                  name={`weekday_${p.id}`}
                                  defaultValue={String(effectiveWeekday)}
                                  className="h-10 rounded-xl border border-black/10 bg-white/70 px-3 text-sm outline-none focus:border-black/25"
                                >
                                  {Array.from({ length: 7 }).map((_, idx) => (
                                    <option key={idx} value={idx}>
                                      {weekdayLabel(idx)}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label className="grid gap-1">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
                                  Enabled
                                </span>
                                <input
                                  type="checkbox"
                                  name={`enabled_${p.id}`}
                                  defaultChecked={isEnabled}
                                  className="h-5 w-5 accent-[var(--accent)]"
                                />
                              </label>
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

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--ink-soft)]">
              Weekly checkboxes never “linger” on other days.
            </p>
            <button
              type="submit"
              className="h-11 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-dark)]"
            >
              Save
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white/60 px-5 py-5">
          <h2 className="text-lg font-semibold tracking-tight">Data Export</h2>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Download your practices and completions as JSON.</p>

          <div className="mt-4">
            <Link
              href="/api/export"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-black/10 bg-white/70 px-4 text-sm font-semibold text-[var(--foreground)] transition hover:bg-white"
            >
              Download JSON
            </Link>
          </div>
        </section>
      </form>
    </div>
  );
}

