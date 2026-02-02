export type PracticeSeason =
  | "ADVENT"
  | "CHRISTMAS"
  | "LENT"
  | "HOLY_WEEK"
  | "EASTER"
  | "ORDINARY_TIME";

export type PracticeLane = "PRAYER" | "ASCETIC" | "CHARITY" | "ATTENTION";
export type PracticeRecurrence = "DAILY" | "WEEKLY";

export type Practice = {
  id: string;
  key: string;
  season: PracticeSeason;
  lane: PracticeLane;
  title: string;
  description: string;
  recurrence: PracticeRecurrence;
  scheduled_weekday: number | null;
  is_active: boolean;
  sort_order: number;
};

export type PracticeOverride = {
  user_id: string;
  practice_id: string;
  scheduled_weekday: number | null;
  is_enabled: boolean;
  custom_title: string | null;
  custom_description: string | null;
};

export type EffectivePractice = Practice & {
  is_enabled: boolean;
  effective_scheduled_weekday: number | null;
  effective_title: string;
  effective_description: string;
};

export const LANE_ORDER: PracticeLane[] = ["PRAYER", "ASCETIC", "CHARITY", "ATTENTION"];
export const SEASON_ORDER: PracticeSeason[] = [
  "ADVENT",
  "CHRISTMAS",
  "LENT",
  "HOLY_WEEK",
  "EASTER",
  "ORDINARY_TIME",
];

export const LANE_LABEL: Record<PracticeLane, string> = {
  PRAYER: "Prayer",
  ASCETIC: "Ascetic",
  CHARITY: "Charity",
  ATTENTION: "Attention",
};

export const SEASON_LABEL: Record<PracticeSeason, string> = {
  ADVENT: "Advent",
  CHRISTMAS: "Christmas",
  LENT: "Lent",
  HOLY_WEEK: "Holy Week",
  EASTER: "Easter",
  ORDINARY_TIME: "Ordinary Time",
};

export function weekdayLabel(idx: number) {
  const labels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return labels[idx] ?? `Day ${idx}`;
}

export function applyOverrides(practices: Practice[], overrides: PracticeOverride[]) {
  const byPracticeId = new Map<string, PracticeOverride>();
  overrides.forEach((o) => byPracticeId.set(o.practice_id, o));

  return practices.map((p) => {
    const o = byPracticeId.get(p.id);
    return {
      ...p,
      is_enabled: o ? o.is_enabled : true,
      effective_scheduled_weekday: o?.scheduled_weekday ?? p.scheduled_weekday,
      effective_title: (o?.custom_title ?? "").trim() || p.title,
      effective_description: (o?.custom_description ?? "").trim() || p.description,
    } satisfies EffectivePractice;
  });
}

export function sortPractices(practices: EffectivePractice[]) {
  const laneIndex = new Map(LANE_ORDER.map((l, idx) => [l, idx]));
  return [...practices].sort((a, b) => {
    const laneDiff = (laneIndex.get(a.lane) ?? 99) - (laneIndex.get(b.lane) ?? 99);
    if (laneDiff !== 0) return laneDiff;
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.effective_title.localeCompare(b.effective_title);
  });
}

export function filterForToday(practices: EffectivePractice[], weekdayIdx: number) {
  return practices.filter((p) => {
    if (!p.is_enabled || !p.is_active) return false;
    if (p.recurrence === "DAILY") return true;
    if (p.recurrence === "WEEKLY") {
      return p.effective_scheduled_weekday === weekdayIdx;
    }
    return false;
  });
}

