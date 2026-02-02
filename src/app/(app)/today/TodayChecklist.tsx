"use client";

import type { PracticeLane } from "@/lib/practices";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { toggleCompletion } from "./actions";

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

export default function TodayChecklist({ groups }: { groups: ChecklistGroup[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [itemsById, setItemsById] = useState(() => {
    const map = new Map<string, { completed: boolean; title: string }>();
    groups.forEach((g) => g.items.forEach((i) => map.set(i.id, { completed: i.completed, title: i.title })));
    return map;
  });
  const [error, setError] = useState<string | null>(null);

  function getCompleted(id: string, fallback: boolean) {
    return itemsById.get(id)?.completed ?? fallback;
  }

  function setCompleted(id: string, completed: boolean) {
    setItemsById((prev) => {
      const next = new Map(prev);
      const existing = next.get(id);
      if (existing) next.set(id, { ...existing, completed });
      return next;
    });
  }

  async function onToggle(id: string, fallbackCompleted: boolean) {
    setError(null);
    const before = getCompleted(id, fallbackCompleted);
    setCompleted(id, !before);

    startTransition(async () => {
      const result = await toggleCompletion(id);
      if (!result.ok) {
        setCompleted(id, before);
        setError(result.error);
        return;
      }

      setCompleted(id, result.completed);
      router.refresh();
    });
  }

  const total = groups.reduce((sum, g) => sum + g.items.length, 0);

  if (total === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-black/10 bg-white/60 px-5 py-6">
        <p className="text-sm text-[var(--ink-soft)]">No practices scheduled for today.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-6">
      {error ? (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      {groups.map((group) => (
        <section key={group.lane} className="grid gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-soft)]">
            {group.label}
          </h2>
          <div className="grid gap-2">
            {group.items.map((item) => {
              const completed = getCompleted(item.id, item.completed);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onToggle(item.id, item.completed)}
                  disabled={isPending}
                  className="flex w-full items-start gap-3 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-left transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border text-sm font-bold ${
                      completed
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-black/15 bg-white/80 text-transparent"
                    }`}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span className="grid gap-1">
                    <span className="text-sm font-semibold text-[var(--foreground)]">{item.title}</span>
                    {item.description ? (
                      <span className="text-xs text-[var(--ink-soft)]">{item.description}</span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <p className="text-xs text-[var(--ink-soft)]">{isPending ? "Saving…" : null}</p>
    </div>
  );
}
