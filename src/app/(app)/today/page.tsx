import { getLiturgicalDay } from "@/lib/liturgical";
import {
  LANE_LABEL,
  LANE_ORDER,
  SEASON_LABEL,
  applyOverrides,
  filterForToday,
  sortPractices,
  type Practice,
  type PracticeLane,
  type PracticeOverride,
} from "@/lib/practices";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIME_ZONE, getLocalToday, getLocalWeekdayIndex } from "@/lib/time";
import { getDailyVerse } from "@/lib/dailyVerse";

import TodayChecklist from "./TodayChecklist";

export const dynamic = "force-dynamic";

type ChecklistItem = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
};

type ChecklistGroup = {
  lane: PracticeLane;
  label: string;
  items: ChecklistItem[];
};

function formatWakeTime(wakeTime: string) {
  return wakeTime.slice(0, 5);
}

export default async function TodayPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const dateLocal = getLocalToday(DEFAULT_TIME_ZONE);
  const weekdayIdx = getLocalWeekdayIndex(new Date(), DEFAULT_TIME_ZONE);

  const liturgical = await getLiturgicalDay(dateLocal);
  const seasonLabel = SEASON_LABEL[liturgical.season];
  const practiceSeason = liturgical.season === "HOLY_WEEK" ? "LENT" : liturgical.season;

  const { data: practicesData, error: practicesError } = await supabase
    .from("practices")
    .select("id, key, season, lane, title, description, recurrence, scheduled_weekday, is_active, sort_order")
    .eq("season", practiceSeason)
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
  const effective = applyOverrides(practices, overrides);
  const todayEffective = sortPractices(filterForToday(effective, weekdayIdx));

  const todayIds = todayEffective.map((p) => p.id);
  const { data: completionsData, error: completionsError } = await supabase
    .from("practice_completions")
    .select("practice_id")
    .eq("date_local", dateLocal)
    .in("practice_id", todayIds);

  if (completionsError) {
    throw new Error(completionsError.message);
  }

  const completedIds = new Set((completionsData ?? []).map((c) => c.practice_id as string));

  const { data: settingsData } = await supabase
    .from("user_settings")
    .select("wake_time")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  const wakeTime = settingsData?.wake_time ? String(settingsData.wake_time) : null;

  const groups: ChecklistGroup[] = LANE_ORDER.map((lane) => {
    const items = todayEffective
      .filter((p) => p.lane === lane)
      .map((p) => {
        const description =
          p.key === "easter_fixed_wake_time" && wakeTime
            ? `Wake time: ${formatWakeTime(wakeTime)}`
            : p.effective_description;

        return {
          id: p.id,
          title: p.effective_title,
          description,
          completed: completedIds.has(p.id),
        } satisfies ChecklistItem;
      });

    return {
      lane,
      label: LANE_LABEL[lane],
      items,
    };
  }).filter((g) => g.items.length > 0);

  const { verse: dailyVerse } = getDailyVerse({ timeZone: DEFAULT_TIME_ZONE });

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            <span className="font-medium text-[var(--foreground)]">{seasonLabel}</span>
            <span className="mx-2 text-black/20">•</span>
            <span>{dateLocal}</span>
            {liturgical.celebration_name ? (
              <>
                <span className="mx-2 text-black/20">•</span>
                <span>{liturgical.celebration_name}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <TodayChecklist groups={groups} />

      <section className="mt-8 rounded-2xl border border-black/10 bg-white/50 px-5 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
          Verse For Today
        </h2>
        {dailyVerse.text ? (
          <p className="mt-3 text-sm text-[var(--foreground)]">{dailyVerse.text}</p>
        ) : null}
        <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">{dailyVerse.reference}</p>
        {!dailyVerse.text ? (
          <p className="mt-1 text-xs text-[var(--ink-soft)]">
            Add verse text locally if you have permission to redistribute your chosen translation.
          </p>
        ) : null}
      </section>
    </div>
  );
}
