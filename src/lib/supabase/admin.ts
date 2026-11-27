import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseAdminConfigured } from "./config";

export function createAdminSupabaseClient() {
  if (!isSupabaseAdminConfigured()) {
    throw new Error("Supabase server credentials are not configured.");
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
