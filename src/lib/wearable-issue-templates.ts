// Canned answer library for the wearable-setup troubleshooting inbox.
//
// Each template has:
//   id        - stable slug stored in wearable_setup_issues.ai_suggested_template_id
//   title     - short label shown in the picker / triage UI
//   brands    - which brand ids this template applies to, or ['*'] for any
//   steps     - which wizard step numbers this template addresses, or [-1] for any
//   subject   - the email subject line
//   body_md   - the reply body in markdown. {{name}} is interpolated from clients.first_name.
//   needs     - free-text hint to the AI about WHEN to pick this template (matched against
//               the user's complaint text). The AI weighs this when scoring templates.
//
// Templates are deliberately conservative: each one solves ONE problem.
// Multi-issue replies are better stitched together by AI as a custom
// reply (the suggest endpoint can return body_md=null and the model
// fills it in).

export interface WearableIssueTemplate {
  id: string;
  title: string;
  brands: string[];
  steps: number[];
  subject: string;
  body_md: string;
  needs: string;
}

const GREETING = "Hi {{name}},\n\n";
const SIGNOFF =
  "\n\nReply to this email if it still doesn't work after the steps above — we'll loop in a coach.\n\n— Lifeline Support";

export const WEARABLE_ISSUE_TEMPLATES: WearableIssueTemplate[] = [
  {
    id: "garmin_health_connect_bridge",
    title: "Garmin → Health Connect bridge not enabled",
    brands: ["garmin"],
    steps: [2, 3],
    subject: "Connecting Garmin Connect to Lifeline",
    body_md:
      GREETING +
      "Garmin sends its data to Lifeline through Health Connect. Two switches need to be on:\n\n" +
      "1. **Garmin Connect → More → Settings → Connected services → Health Connect** → toggle ON, and grant read + write for Steps, Heart rate, Sleep, Activity.\n" +
      "2. **Health Connect → App permissions → Lifeline** → toggle every category ON.\n\n" +
      "Then open the Lifeline app and re-run the verification step. Data usually appears within a few minutes once both bridges are on." +
      SIGNOFF,
    needs:
      "User has Garmin and reports no data showing, or the verification step fails. Common when Garmin Connect was installed but the Health Connect bridge inside it was never enabled.",
  },
  {
    id: "fitbit_google_account",
    title: "Fitbit requires a Google account now",
    brands: ["fitbit"],
    steps: [1, 2, 3],
    subject: "Re-linking your Fitbit to Lifeline",
    body_md:
      GREETING +
      "Fitbit switched to Google accounts last year — if your Fitbit was originally set up under a Fitbit-only account, the new Health Connect bridge won't work until you migrate.\n\n" +
      "1. Open the Fitbit app → tap your profile picture → **Migrate your Fitbit account to Google**.\n" +
      "2. After migration finishes, open **Health Connect → App permissions → Fitbit** and toggle every category ON.\n" +
      "3. Then **Health Connect → App permissions → Lifeline** → toggle everything ON.\n\n" +
      "Re-run the verification step in Lifeline; data should appear within a few minutes." +
      SIGNOFF,
    needs:
      "User has Fitbit and reports the Health Connect link isn't working, or no data showing. Usually the underlying issue is the un-migrated Fitbit account.",
  },
  {
    id: "samsung_health_connect",
    title: "Samsung Health → Health Connect permissions",
    brands: ["samsung"],
    steps: [2, 3],
    subject: "Connecting Samsung Health to Lifeline",
    body_md:
      GREETING +
      "Samsung Health needs to be told it can share with Health Connect — this is usually the missing piece.\n\n" +
      "1. Open **Samsung Health → Settings (gear icon) → Health Connect** → tap **Connect** and grant every read permission.\n" +
      "2. Open **Health Connect → App permissions → Lifeline** → toggle every category ON.\n" +
      "3. Re-run the verification step in Lifeline.\n\n" +
      "If you're on a One UI version older than 6, you may also need to install the Health Connect app from the Play Store separately." +
      SIGNOFF,
    needs:
      "User has a Samsung phone or Galaxy Watch and reports the connection didn't work, or no data appears in Lifeline.",
  },
  {
    id: "pixel_watch_fitbit_routing",
    title: "Pixel Watch routes through Fitbit",
    brands: ["pixel"],
    steps: [1, 2, 3],
    subject: "Pixel Watch + Lifeline",
    body_md:
      GREETING +
      "The Pixel Watch sends its data through the **Fitbit app**, not directly to Health Connect. So you need both apps installed and a couple of switches on:\n\n" +
      "1. Install **Fitbit** from the Play Store and sign in with the same Google account your Pixel Watch uses.\n" +
      "2. Inside Fitbit, enable the Health Connect bridge: profile picture → **Health Connect** → grant all categories.\n" +
      "3. Open **Health Connect → App permissions → Lifeline** → toggle every category ON.\n\n" +
      "Re-run the verification step. Heart rate and step data usually arrive within a few minutes." +
      SIGNOFF,
    needs:
      "User has a Pixel Watch and is stuck on install / permissions / verify. Often they assume Pixel Watch writes directly to Health Connect.",
  },
  {
    id: "whoop_not_supported_yet",
    title: "WHOOP doesn't expose Health Connect",
    brands: ["whoop"],
    steps: [1, 2, 3],
    subject: "WHOOP and Lifeline",
    body_md:
      GREETING +
      "WHOOP does not currently expose its data to Health Connect (Android) or the iOS Health app — it's a deliberate choice on their side. We're working on a direct API integration with WHOOP Cloud and will email you the moment it's ready.\n\n" +
      "In the meantime, your Lifeline coaching plan still works — we'll lean on your subjective check-ins instead of recovery scores. If you want to share specific WHOOP screenshots with your coach, you can do that from the chat tab." +
      SIGNOFF,
    needs:
      "User has WHOOP and is stuck. WHOOP cannot be wired to Health Connect — this is a feature-not-available reply, not a fix.",
  },
  {
    id: "oura_pending_integration",
    title: "Oura — direct API coming soon",
    brands: ["oura"],
    steps: [1, 2, 3],
    subject: "Oura and Lifeline",
    body_md:
      GREETING +
      "Oura's Health Connect support is partial — depending on your ring generation it may or may not surface sleep + HRV. We're building a direct Oura Cloud integration that pulls full readiness and sleep stages, and we'll email you the moment it's live.\n\n" +
      "In the meantime: if you'd like to share recent Oura screenshots with your coach, you can attach them in the chat tab and we'll fold that into your plan." +
      SIGNOFF,
    needs:
      "User has Oura and reports incomplete data, missing sleep/HRV, or that the verification step doesn't pass. Native Health Connect support varies — better to set the right expectation than chase fragmented data.",
  },
  {
    id: "withings_health_mate",
    title: "Withings → Health Mate → Health Connect",
    brands: ["withings"],
    steps: [2, 3],
    subject: "Connecting Withings to Lifeline",
    body_md:
      GREETING +
      "Withings devices send data through the Health Mate app. Two toggles need to be on:\n\n" +
      "1. **Health Mate → Profile → Apps → Health Connect** → enable and grant all read categories.\n" +
      "2. **Health Connect → App permissions → Lifeline** → toggle everything ON.\n\n" +
      "Re-run the verification step. Weight, sleep, and activity should appear within minutes." +
      SIGNOFF,
    needs:
      "User has a Withings device (scale, watch, sleep mat) and the Lifeline verification step fails or data is partial.",
  },
  {
    id: "polar_flow_connect",
    title: "Polar Flow → Connect → Health Connect",
    brands: ["polar"],
    steps: [2, 3],
    subject: "Connecting Polar to Lifeline",
    body_md:
      GREETING +
      "Polar's Health Connect bridge lives inside the Polar Flow app:\n\n" +
      "1. **Polar Flow → Settings → Connect → Health Connect** → enable and grant the read categories you want shared.\n" +
      "2. **Health Connect → App permissions → Lifeline** → toggle everything ON.\n" +
      "3. Re-run the Lifeline verification step.\n\n" +
      "If a category is missing in Polar Flow's permission list, double-check you're on the latest Flow version from the Play Store." +
      SIGNOFF,
    needs:
      "User has Polar and the wizard verification fails or some metric is missing.",
  },
  {
    id: "suunto_partner_connections",
    title: "Suunto → Partner connections → Health Connect",
    brands: ["suunto"],
    steps: [2, 3],
    subject: "Connecting Suunto to Lifeline",
    body_md:
      GREETING +
      "Suunto uses a 'Partner connections' page for Health Connect:\n\n" +
      "1. Open the Suunto app → **Settings → Partner connections → Health Connect** → enable and grant read access.\n" +
      "2. Open **Health Connect → App permissions → Lifeline** → toggle every category ON.\n" +
      "3. Re-run the Lifeline verification step.\n\n" +
      "Note: some older Suunto watches only sync after the next Bluetooth handshake — open the Suunto app once to force a sync if data hasn't appeared." +
      SIGNOFF,
    needs:
      "User has Suunto and the wizard verification fails or data isn't arriving.",
  },
  {
    id: "ultrahuman_direct_api",
    title: "Ultrahuman — direct API coming",
    brands: ["ultrahuman"],
    steps: [1, 2, 3],
    subject: "Ultrahuman and Lifeline",
    body_md:
      GREETING +
      "Ultrahuman's Health Connect bridge is still in beta — glucose and HRV stream through, but recovery score and metabolic score don't surface cleanly. We're wiring up the direct Ultrahuman API; you'll get an email when it's ready.\n\n" +
      "In the meantime: if you turn on **Ultrahuman → Settings → Health Connect**, your steps, sleep, and basic HR will flow into Lifeline. The richer metrics will fill in once we ship the direct integration." +
      SIGNOFF,
    needs:
      "User has Ultrahuman ring/M1 and reports partial or missing data.",
  },
  {
    id: "apple_watch_healthkit",
    title: "Apple Watch — iPhone Health permissions",
    brands: ["apple_watch"],
    steps: [2, 3],
    subject: "Connecting Apple Watch to Lifeline",
    body_md:
      GREETING +
      "Apple Watch data flows through the iPhone **Health** app. Two things to check:\n\n" +
      "1. Open the iPhone **Health** app → tap your profile picture (top right) → **Apps and Services → Lifeline → Turn All Categories On**.\n" +
      "2. Make sure the Health app itself is receiving data: open **Health → Browse → Activity** and confirm today's steps are showing.\n\n" +
      "Then re-run the verification step in Lifeline. If steps appear in iPhone Health but not in Lifeline, kill the Lifeline app once and reopen it." +
      SIGNOFF,
    needs:
      "User is on iOS with an Apple Watch and Lifeline isn't seeing data, or the verification step fails.",
  },
  {
    id: "health_connect_app_missing",
    title: "Health Connect app needs installing (older Android)",
    brands: ["*"],
    steps: [1, 2],
    subject: "Installing Health Connect",
    body_md:
      GREETING +
      "On Android 13 and older, Health Connect is a separate app from the Play Store rather than a built-in part of Android. Install it from this link: https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata\n\n" +
      "Once installed, open it once, then go back to the Lifeline wizard and try the permission step again. The remaining setup is the same as on newer phones." +
      SIGNOFF,
    needs:
      "Android user on an older device, complaint mentions 'Health Connect' missing / not found / not opening.",
  },
  {
    id: "no_data_yet_be_patient",
    title: "No data yet — wear the device first",
    brands: ["*"],
    steps: [3],
    subject: "Wearable verification — give it a few hours",
    body_md:
      GREETING +
      "The verification step needs to see real data flowing through, which means the device has to record something first.\n\n" +
      "Try this:\n\n" +
      "1. Wear the device for at least 30 minutes today, ideally including some walking.\n" +
      "2. Open your wearable's companion app (Garmin Connect / Fitbit / Health / etc.) and confirm today's date shows step or heart-rate data.\n" +
      "3. Then re-run the Lifeline verification step.\n\n" +
      "If today's data is in the companion app but not in Lifeline, reply to this email with which metric is missing and we'll dig deeper." +
      SIGNOFF,
    needs:
      "User reports verification keeps failing or 'no data showing' shortly after setup. The fix may simply be that they haven't worn the device yet.",
  },
  {
    id: "permissions_revoked",
    title: "Permissions got revoked — re-grant them",
    brands: ["*"],
    steps: [2, 3],
    subject: "Re-grant Health Connect permissions",
    body_md:
      GREETING +
      "Android sometimes revokes Health Connect permissions when an app is updated or when the phone is rebooted unexpectedly. The fix is one screen:\n\n" +
      "1. Open **Settings → Apps → Health Connect → App permissions → Lifeline**.\n" +
      "2. Toggle every category ON.\n" +
      "3. Re-run the verification step in Lifeline.\n\n" +
      "If certain categories are missing from the list, that means your wearable's companion app hasn't written that data type to Health Connect yet — open the companion app once to force a sync." +
      SIGNOFF,
    needs:
      "User reports it 'worked yesterday' or that permissions look off after an update / reboot.",
  },
  {
    id: "needs_more_info",
    title: "Need more info to diagnose",
    brands: ["*"],
    steps: [-1],
    subject: "A couple of questions about your wearable setup",
    body_md:
      GREETING +
      "Thanks for the report — to dig in I need two quick things:\n\n" +
      "1. A screenshot of the **Health Connect → App permissions → Lifeline** screen (so I can see which categories are toggled).\n" +
      "2. Which data type is missing? (steps, heart rate, sleep, HRV, all of them?)\n\n" +
      "Reply to this email with both and we'll get you sorted same-day." +
      SIGNOFF,
    needs:
      "Complaint is too vague to map to a specific template, but the user clearly has something stuck. Default fallback before escalating to a coach.",
  },
];

export function findTemplate(id: string): WearableIssueTemplate | undefined {
  return WEARABLE_ISSUE_TEMPLATES.find((t) => t.id === id);
}

// Subset filter for the picker UI — narrows the list to templates
// that match the current ticket's brand/step. brand='other' or
// brand='none' falls through to '*' templates only.
export function relevantTemplates(brand: string, step: number): WearableIssueTemplate[] {
  return WEARABLE_ISSUE_TEMPLATES.filter((t) => {
    const brandMatch = t.brands.includes(brand) || t.brands.includes("*");
    const stepMatch = t.steps.includes(step) || t.steps.includes(-1);
    return brandMatch && stepMatch;
  });
}

export function renderTemplate(
  t: WearableIssueTemplate,
  vars: { name?: string | null }
): { subject: string; body_md: string } {
  const name = (vars.name || "there").split(" ")[0]; // first name only
  return {
    subject: t.subject,
    body_md: t.body_md.replace(/\{\{name\}\}/g, name),
  };
}
