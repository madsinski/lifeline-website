import { createBrowserClient } from "@supabase/ssr";

// Cookie-backed session storage (was localStorage via @supabase/supabase-js).
// The cookies are what the proxy.ts gate reads to identify the logged-in
// user and call has_site_access — without them, every authenticated
// request to a gated route falls through to /coming-soon.
//
// Trade-off: a one-time forced re-login for anyone who had a session
// in localStorage before this switch. After that, the same cookie-based
// session works on the client, the proxy, and any other server code.
import { SUPABASE_URL as supabaseUrl, SUPABASE_ANON_KEY as supabaseAnonKey } from "./supabase-public";

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
