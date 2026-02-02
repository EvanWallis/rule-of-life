export type DailyVerse = {
  reference: string;
  /**
   * Optional verse text.
   *
   * Note: Do not commit copyrighted translations (e.g. RSV-CE) unless you have
   * permission to redistribute the text.
   */
  text?: string;
};

// Reference-only seed. Replace/extend locally with your preferred translation text
// if you have rights to redistribute it.
export const DAILY_VERSES: DailyVerse[] = [
  { reference: "Psalm 23:1" },
  { reference: "Matthew 11:28" },
  { reference: "Philippians 4:6–7" },
  { reference: "John 15:5" },
  { reference: "Romans 12:12" },
  { reference: "2 Corinthians 12:9" },
  { reference: "Isaiah 41:10" },
];

