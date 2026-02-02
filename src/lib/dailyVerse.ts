import { DEFAULT_TIME_ZONE } from "@/lib/time";
import { DAILY_VERSES, type DailyVerse } from "@/data/dailyVerses";

function dayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000) + 1;
}

export function getDailyVerse(
  options: { now?: Date; timeZone?: string; verses?: DailyVerse[] } = {},
): { verse: DailyVerse; index: number } {
  const verses = options.verses && options.verses.length > 0 ? options.verses : DAILY_VERSES;
  const timeZone = options.timeZone ?? DEFAULT_TIME_ZONE;
  const now = options.now ?? new Date();

  const localMidday = new Date(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now) + "T12:00:00",
  );

  const doy = dayOfYear(localMidday);
  const idx = ((doy - 1) % verses.length + verses.length) % verses.length;
  return { verse: verses[idx]!, index: idx };
}

