// Supabase auth errors arrive as English sentences ("Email not confirmed",
// "Invalid login credentials"). Shown raw on an Icelandic page they read as
// a crash. This maps the common ones; anything unknown gets a plain
// Icelandic fallback rather than the English original.

type AuthErrLike = { message?: string | null; code?: string | null; status?: number | null } | string | null | undefined;

export function isEmailNotConfirmed(err: AuthErrLike): boolean {
  if (!err) return false;
  const code = typeof err === "string" ? "" : err.code || "";
  const msg = (typeof err === "string" ? err : err.message || "").toLowerCase();
  return code === "email_not_confirmed" || msg.includes("email not confirmed");
}

export function authErrorIs(err: AuthErrLike): string {
  if (!err) return "";
  const code = typeof err === "string" ? "" : err.code || "";
  const msg = (typeof err === "string" ? err : err.message || "").toLowerCase();

  if (isEmailNotConfirmed(err)) {
    return "Netfangið hefur ekki verið staðfest. Opnaðu staðfestingarpóstinn frá okkur eða fáðu nýjan sendan.";
  }
  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) {
    return "Netfang eða lykilorð er rangt.";
  }
  if (code === "user_already_exists" || code === "email_exists" || msg.includes("already registered")) {
    return "Netfangið er þegar skráð. Skráðu þig inn eða veldu nýtt lykilorð.";
  }
  if (code === "weak_password" || msg.includes("password should be") || msg.includes("weak password")) {
    return "Lykilorðið er of veikt. Notaðu minnst 12 stafi.";
  }
  if (code === "same_password" || msg.includes("different from the old password")) {
    return "Nýja lykilorðið þarf að vera annað en það gamla.";
  }
  if (code === "email_address_invalid" || msg.includes("invalid format") || (msg.includes("email address") && msg.includes("invalid"))) {
    return "Netfangið virðist ekki vera gilt.";
  }
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || msg.includes("rate limit")
      || msg.includes("for security purposes")) {
    return "Of margar beiðnir í bili. Bíddu í smástund og reyndu svo aftur.";
  }
  if (code === "signup_disabled" || msg.includes("signups not allowed")) {
    return "Ekki er hægt að stofna nýjan aðgang í augnablikinu.";
  }
  if (code === "otp_expired" || msg.includes("expired") || msg.includes("invalid or has expired")) {
    return "Hlekkurinn er útrunninn eða hefur þegar verið notaður.";
  }
  if (msg.includes("failed to fetch") || msg.includes("network")) {
    return "Engin tenging náðist. Athugaðu nettenginguna og reyndu aftur.";
  }
  return "Eitthvað fór úrskeiðis. Reyndu aftur.";
}
