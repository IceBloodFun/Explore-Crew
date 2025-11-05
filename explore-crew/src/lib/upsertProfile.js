import { supabase } from "@/lib/supabaseClient";

export async function upsertProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const payload = {
    id: user.id,
    username: user.user_metadata?.user_name || user.user_metadata?.full_name || user.email?.split("@")[0],
    full_name: user.user_metadata?.full_name || null,
    avatar_url: user.user_metadata?.avatar_url || null,
  };

  await supabase.from("profiles").upsert(payload, { onConflict: "id" });
}
