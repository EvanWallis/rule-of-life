import "server-only";

import romcal from "romcal";

import { createAdminClient } from "@/lib/supabase/admin";

export type LiturgicalSeason =
  | "ADVENT"
  | "CHRISTMAS"
  | "LENT"
  | "HOLY_WEEK"
  | "EASTER"
  | "ORDINARY_TIME";

export type LiturgicalDay = {
  date: string; // YYYY-MM-DD
  season: LiturgicalSeason;
  celebration_name: string | null;
  celebration_type: string | null;
};

function normalizeRomcalSeason(seasonKey: string): LiturgicalSeason {
  switch (seasonKey) {
    case "Advent":
      return "ADVENT";
    case "Christmastide":
      return "CHRISTMAS";
    case "Lent":
      return "LENT";
    case "Holy Week":
      return "HOLY_WEEK";
    case "Easter":
      return "EASTER";
    case "Early Ordinary Time":
    case "Later Ordinary Time":
      return "ORDINARY_TIME";
    default:
      throw new Error(`Unsupported romcal season: ${seasonKey}`);
  }
}

type RomcalDate = {
  moment: string;
  type: string;
  name: string;
  key: string;
  source: string;
  data?: {
    season?: { key?: string; value?: string } | string;
    meta?: Record<string, unknown>;
    calendar?: Record<string, unknown>;
  };
};

function computeYear(year: number) {
  const dates = romcal.calendarFor({
    year,
    country: "unitedStates",
    locale: "en",
    type: "calendar",
  }) as RomcalDate[];

  return dates.map((d) => {
    const date = d.moment.slice(0, 10);
    const seasonKey =
      typeof d.data?.season === "string"
        ? d.data.season
        : d.data?.season?.key || d.data?.season?.value;

    if (!seasonKey) {
      throw new Error(`romcal returned no season for ${date}`);
    }

    return {
      date,
      season: normalizeRomcalSeason(seasonKey),
      celebration_key: d.key ?? null,
      celebration_name: d.name ?? null,
      celebration_type: d.type ?? null,
      celebration_source: d.source ?? null,
      meta: {
        romcal_season: d.data?.season ?? null,
        calendar: d.data?.calendar ?? null,
        meta: d.data?.meta ?? null,
      },
    };
  });
}

async function cacheYearIfPossible(year: number) {
  const admin = createAdminClient();
  const rows = computeYear(year);
  const { error } = await admin.from("liturgical_days").upsert(rows, { onConflict: "date" });
  if (error) {
    throw error;
  }
}

export async function getLiturgicalDay(dateLocal: string): Promise<LiturgicalDay> {
  const year = Number(dateLocal.slice(0, 4));
  if (!Number.isFinite(year) || year < 1582) {
    throw new Error(`Invalid dateLocal: ${dateLocal}`);
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("liturgical_days")
      .select("date, season, celebration_name, celebration_type")
      .eq("date", dateLocal)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return {
        date: data.date,
        season: data.season,
        celebration_name: data.celebration_name,
        celebration_type: data.celebration_type,
      };
    }

    await cacheYearIfPossible(year);

    const { data: cached, error: cachedError } = await admin
      .from("liturgical_days")
      .select("date, season, celebration_name, celebration_type")
      .eq("date", dateLocal)
      .maybeSingle();

    if (cachedError) {
      throw cachedError;
    }

    if (cached) {
      return {
        date: cached.date,
        season: cached.season,
        celebration_name: cached.celebration_name,
        celebration_type: cached.celebration_type,
      };
    }
  } catch {
    // Fall back to compute-only mode if admin credentials or DB are unavailable.
  }

  const computed = computeYear(year).find((d) => d.date === dateLocal);
  if (!computed) {
    throw new Error(`Unable to compute liturgical day for ${dateLocal}`);
  }

  return {
    date: computed.date,
    season: computed.season,
    celebration_name: computed.celebration_name,
    celebration_type: computed.celebration_type,
  };
}

