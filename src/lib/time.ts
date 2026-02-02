export const DEFAULT_TIME_ZONE = "America/New_York";

export function getLocalDateString(date: Date, timeZone = DEFAULT_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to format local date");
  }

  return `${year}-${month}-${day}`;
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function getLocalWeekdayIndex(date: Date, timeZone = DEFAULT_TIME_ZONE) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  const idx = WEEKDAY_TO_INDEX[weekday];
  if (idx === undefined) {
    throw new Error(`Unexpected weekday: ${weekday}`);
  }
  return idx;
}

export function getLocalToday(timeZone = DEFAULT_TIME_ZONE) {
  return getLocalDateString(new Date(), timeZone);
}

