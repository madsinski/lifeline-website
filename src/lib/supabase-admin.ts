import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || "https://cfnibfxzltxiriqxvvru.supabase.co";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceKey) {
  console.warn("[supabase-admin] SUPABASE_SERVICE_ROLE_KEY not set — admin operations will fail");
}

export const supabaseAdmin = createClient(url, serviceKey || "", {
  auth: { autoRefreshToken: false, persistSession: false },
});
