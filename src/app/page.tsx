import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Authenticated users go to dashboard
  // The (dashboard) route group handles the actual dashboard page
  redirect("/apprenants");
}
