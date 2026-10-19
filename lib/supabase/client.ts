import { createBrowserClient } from "@supabase/ssr";
import { publicConfig } from "@/lib/runtime-config";

export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = publicConfig();
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
