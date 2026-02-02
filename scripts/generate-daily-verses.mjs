/**
 * Generates `src/data/dailyVerses.ts` from a public dataset.
 *
 * Source dataset:
 * - https://github.com/xxruyle/Bible-DouayRheims (MIT) – Douay-Rheims Bible (Challoner revision)
 *
 * The generated output is a curated-ish list of 365 verses selected via a
 * lightweight scoring heuristic (keywords + length + book diversity).
 */

import fs from "node:fs/promises";
import path from "node:path";

const OUT_FILE = path.join(process.cwd(), "src", "data", "dailyVerses.ts");
const SOURCE_URL =
  "https://raw.githubusercontent.com/xxruyle/Bible-DouayRheims/main/EntireBible-DR.json";

const POSITIVE = [
  "love",
  "charity",
  "mercy",
  "peace",
  "hope",
  "faith",
  "joy",
  "grace",
  "bless",
  "blessed",
  "lord",
  "jesus",
  "christ",
  "spirit",
  "heart",
  "pray",
  "prayer",
  "trust",
  "comfort",
  "light",
  "life",
  "fear not",
  "fear thou not",
  "rejoice",
  "forgive",
  "forgiveness",
  "strength",
  "help",
  "wisdom",
  "humble",
  "meek",
  "seek",
  "rest",
  "truth",
  "good",
  "goodness",
];

const NEGATIVE = [
  "slay",
  "slain",
  "kill",
  "killed",
  "wrath",
  "curse",
  "cursed",
  "vengeance",
  "blood",
  "sword",
  "war",
  "battle",
  "destroy",
  "destroyed",
  "plague",
];

function norm(s) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function scoreVerse(text) {
  const t = norm(text);
  let score = 0;
  for (const w of POSITIVE) {
    if (t.includes(w)) score += 2;
  }
  for (const w of NEGATIVE) {
    if (t.includes(w)) score -= 2;
  }
  // Prefer shorter, punchier verses.
  const len = t.length;
  if (len <= 80) score += 3;
  else if (len <= 140) score += 1;
  else if (len >= 240) score -= 2;

  // Prefer non-obscure punctuation density (rough proxy for readability).
  const commas = (t.match(/,/g) || []).length;
  if (commas >= 5) score -= 1;

  return score;
}

function formatRef(book, chapter, verse) {
  return `${book} ${chapter}:${verse}`;
}

function escapeTsString(s) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\${/g, "\\${")
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

function pick365(candidates) {
  const perBookLimit = new Map();
  const picked = [];
  const bookCounts = new Map();

  // Hand-tuned-ish caps to keep the list diverse while allowing Psalms/NT more presence.
  const specialCaps = new Map([
    ["Psalms", 45],
    ["Proverbs", 25],
    ["Wisdom", 12],
    ["Ecclesiasticus", 12],
    ["Isaias", 12],
    ["Matthew", 20],
    ["Mark", 12],
    ["Luke", 20],
    ["John", 24],
    ["Acts", 12],
    ["Romans", 12],
    ["1 Corinthians", 12],
    ["2 Corinthians", 12],
    ["Galatians", 10],
    ["Ephesians", 10],
    ["Philippians", 10],
    ["Colossians", 10],
    ["1 Thessalonians", 8],
    ["2 Thessalonians", 6],
    ["1 Timothy", 8],
    ["2 Timothy", 8],
    ["Titus", 6],
    ["Hebrews", 10],
    ["James", 8],
    ["1 Peter", 8],
    ["2 Peter", 6],
    ["1 John", 10],
    ["2 John", 3],
    ["3 John", 3],
    ["Jude", 3],
    ["Apocalypse", 8],
  ]);

  const defaultCap = 8;

  function capFor(book) {
    return specialCaps.get(book) ?? defaultCap;
  }

  for (const c of candidates) {
    const used = bookCounts.get(c.book) ?? 0;
    if (used >= capFor(c.book)) continue;
    bookCounts.set(c.book, used + 1);
    picked.push(c);
    if (picked.length >= 365) break;
  }

  // If we didn't hit 365 due to caps, relax caps gradually.
  if (picked.length < 365) {
    const pickedRefs = new Set(picked.map((p) => p.reference));
    for (const c of candidates) {
      if (pickedRefs.has(c.reference)) continue;
      picked.push(c);
      pickedRefs.add(c.reference);
      if (picked.length >= 365) break;
    }
  }

  // Stable sort by reference to avoid churn (selection order is already score-sorted).
  return picked.slice(0, 365);
}

async function main() {
  const data = await fetchJson(SOURCE_URL);

  const verses = [];
  for (const [book, chapters] of Object.entries(data)) {
    for (const [chapterStr, chapterObj] of Object.entries(chapters)) {
      const chapter = Number(chapterStr);
      if (!Number.isFinite(chapter)) continue;
      for (const [verseStr, text] of Object.entries(chapterObj)) {
        const verse = Number(verseStr);
        if (!Number.isFinite(verse)) continue;
        const raw = String(text ?? "").trim();
        if (!raw) continue;
        const cleaned = raw
          .replace(/\s+/g, " ")
          // Dataset uses leading asterisks to mark paragraph/section starts.
          .replace(/^[*†]+/g, "")
          .trim();
        const reference = formatRef(book, chapter, verse);
        verses.push({
          book,
          chapter,
          verse,
          reference,
          text: cleaned,
          score: scoreVerse(cleaned),
        });
      }
    }
  }

  const candidates = verses
    .filter((v) => v.text.length >= 18 && v.text.length <= 220)
    .filter((v) => v.score >= 2)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.text.length !== b.text.length) return a.text.length - b.text.length;
      return a.reference.localeCompare(b.reference);
    });

  const picked = pick365(candidates);
  if (picked.length < 365) {
    throw new Error(`Only picked ${picked.length} verses; adjust caps/filters.`);
  }

  const lines = [];
  lines.push('export type DailyVerse = { reference: string; text: string };');
  lines.push("");
  lines.push("// Generated by scripts/generate-daily-verses.mjs");
  lines.push("// Source: xxruyle/Bible-DouayRheims (MIT) – Douay-Rheims (Challoner revision)");
  lines.push("export const DAILY_VERSES: DailyVerse[] = [");
  for (const v of picked) {
    lines.push(`  { reference: ${JSON.stringify(v.reference)}, text: ${JSON.stringify(escapeTsString(v.text))} },`);
  }
  lines.push("];");
  lines.push("");

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, lines.join("\n"), "utf8");
  console.log(`Wrote ${OUT_FILE} (${picked.length} verses)`);
}

await main();
