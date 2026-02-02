"use server";

import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIME_ZONE, getLocalToday, getLocalWeekdayIndex } from "@/lib/time";
import { revalidatePath } from "next/cache";

type ToggleResult = { ok: true; completed: boolean } | { ok: false; error: string };

export async function toggleCompletion(practiceId: string): Promise<ToggleResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const dateLocal = getLocalToday(DEFAULT_TIME_ZONE);
  const weekdayIdx = getLocalWeekdayIndex(new Date(), DEFAULT_TIME_ZONE);

  const { data: practice, error: practiceError } = await supabase
    .from("practices")
    .select("id, recurrence, scheduled_weekday, is_active")
    .eq("id", practiceId)
    .maybeSingle();

  if (practiceError) {
    return { ok: false, error: practiceError.message };
  }

  if (!practice || !practice.is_active) {
    return { ok: false, error: "Practice not found." };
  }

  const { data: override, error: overrideError } = await supabase
    .from("user_practice_overrides")
    .select("scheduled_weekday, is_enabled")
    .eq("user_id", user.id)
    .eq("practice_id", practiceId)
    .maybeSingle();

  if (overrideError) {
    return { ok: false, error: overrideError.message };
  }

  const isEnabled = override ? override.is_enabled : true;
  if (!isEnabled) {
    return { ok: false, error: "This practice is disabled." };
  }

  if (practice.recurrence === "WEEKLY") {
    const effectiveWeekday = override?.scheduled_weekday ?? practice.scheduled_weekday;
    if (effectiveWeekday === null || effectiveWeekday === undefined) {
      return { ok: false, error: "Weekly practice has no weekday set." };
    }
    if (effectiveWeekday !== weekdayIdx) {
      return { ok: false, error: "This weekly practice isn’t scheduled for today." };
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from("practice_completions")
    .select("practice_id")
    .eq("user_id", user.id)
    .eq("practice_id", practiceId)
    .eq("date_local", dateLocal)
    .maybeSingle();

  if (existingError) {
    return { ok: false, error: existingError.message };
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from("practice_completions")
      .delete()
      .eq("user_id", user.id)
      .eq("practice_id", practiceId)
      .eq("date_local", dateLocal);

    if (deleteError) {
      return { ok: false, error: deleteError.message };
    }

    revalidatePath("/today");
    revalidatePath("/history");
    return { ok: true, completed: false };
  }

  const { error: insertError } = await supabase.from("practice_completions").insert({
    user_id: user.id,
    practice_id: practiceId,
    date_local: dateLocal,
    completed_at: new Date().toISOString(),
  });

  if (insertError) {
    return { ok: false, error: insertError.message };
  }

  revalidatePath("/today");
  revalidatePath("/history");
  return { ok: true, completed: true };
}

