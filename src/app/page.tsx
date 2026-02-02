import { redirect } from "next/navigation";

export default function Home() {
  const hasSupabaseEnv =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  redirect(hasSupabaseEnv ? "/today" : "/setup");
}
