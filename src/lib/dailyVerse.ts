import { DEFAULT_TIME_ZONE, getLocalDateString } from "@/lib/time";
import { DAILY_VERSES, type DailyVerse } from "@/data/dailyVerses";

function dayOfYearFromYmd(ymd: string) {
  const [y, m, d] = ymd.split("-").map((v) => Number(v));
  if (!y || !m || !d) throw new Error(`Invalid date: ${ymd}`);
  const dateUtc = Date.UTC(y, m - 1, d);
  const startUtc = Date.UTC(y, 0, 1);
  return Math.floor((dateUtc - startUtc) / 86400000) + 1;
}

export function getDailyVerse(
  options: { now?: Date; timeZone?: string; verses?: DailyVerse[] } = {},
): { verse: DailyVerse; index: number } {
  const verses = options.verses && options.verses.length > 0 ? options.verses : DAILY_VERSES;
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const now = options.now ?? new Date();

  const ymd = getLocalDateString(now, timeZone);
  const doy = dayOfYearFromYmd(ymd);
  const idx = ((doy - 1) % verses.length + verses.length) % verses.length;
  return { verse: verses[idx]!, index: idx };
}
