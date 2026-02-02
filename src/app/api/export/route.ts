import { createClient } from "@/lib/supabase/server";
import { getLocalToday } from "@/lib/time";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [practicesRes, overridesRes, settingsRes, completionsRes] = await Promise.all([
    supabase
      .from("practices")
      .select("id, key, season, lane, title, description, recurrence, scheduled_weekday, is_active, sort_order"),
    supabase
      .from("user_practice_overrides")
      .select("practice_id, scheduled_weekday, is_enabled, custom_title, custom_description, created_at, updated_at"),
    supabase.from("user_settings").select("wake_time, created_at, updated_at").maybeSingle(),
    supabase.from("practice_completions").select("practice_id, date_local, completed_at, created_at"),
  ]);

  if (practicesRes.error) return NextResponse.json({ error: practicesRes.error.message }, { status: 500 });
  if (overridesRes.error) return NextResponse.json({ error: overridesRes.error.message }, { status: 500 });
  if (settingsRes.error) return NextResponse.json({ error: settingsRes.error.message }, { status: 500 });
  if (completionsRes.error) return NextResponse.json({ error: completionsRes.error.message }, { status: 500 });

  const dateLocal = getLocalToday();
  const filename = `rule-of-life-export-${dateLocal}.json`;

  const payload = {
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email },
    practices: practicesRes.data ?? [],
    overrides: overridesRes.data ?? [],
    settings: settingsRes.data ?? null,
    completions: completionsRes.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

