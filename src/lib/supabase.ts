import { createBrowserClient } from "@supabase/ssr";

// Cookie-backed session storage (was localStorage via @supabase/supabase-js).
// The cookies are what the proxy.ts gate reads to identify the logged-in
// user and call has_site_access — without them, every authenticated
// request to a gated route falls through to /coming-soon.
//
// Trade-off: a one-time forced re-login for anyone who had a session
// in localStorage before this switch. After that, the same cookie-based
// session works on the client, the proxy, and any other server code.
const supabaseUrl = "https://cfnibfxzltxiriqxvvru.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbmliZnh6bHR4aXJpcXh2dnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzQxMDgsImV4cCI6MjA5MDQ1MDEwOH0.LHBADsUdW7SBtrxZ9KikTmAl5brBGPb3gFTMuPYrmD8";

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
