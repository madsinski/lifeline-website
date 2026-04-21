import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isStaff } from "@/lib/auth-helpers";
import {
  renderB2bIntroEmail,
  renderInviteEmail,
  renderWelcomeEmail,
  renderEventScheduledEmail,
  renderBloodTestDaysEmail,
  renderEventReminderEmail,
  renderFinalizeStaffEmail,
  renderFinalizeContactEmail,
  renderInvoiceContactEmail,
} from "@/lib/email";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.lifelinehealth.is";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isStaff(user.id))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const template = req.nextUrl.searchParams.get("template") || "b2b-intro";

  const sampleData = {
    recipientName: "Jón Jónsson",
    companyName: "Döme ehf.",
    signupUrl: `${BASE}/business/signup`,
    infoUrl: `${BASE}/business`,
    senderName: "Mads",
    onboardUrl: `${BASE}/business/onboard/sample-token`,
    password: "demo-1234",
    welcomeUrl: `${BASE}/account/login?next=/account/welcome`,
    loginUrl: `${BASE}/account/login`,
    eventDateLabel: "Wed, 15 May 2026",
    startTime: "09:00",
    endTime: "16:00",
    location: "Laugavegur 77, 101 Reykjavík",
    roomNotes: "2nd floor, room 204",
    bookingUrl: `${BASE}/account`,
    approvedDays: [
      { label: "Mon, 19 May", notes: "Sameind — Laugavegur" },
      { label: "Wed, 21 May", notes: "Sameind — Laugavegur" },
      { label: "Fri, 23 May", notes: "Sameind — Smáralind" },
    ],
    staffEmails: ["mads@lifelinehealth.is"],
    memberCount: 24,
    completedCount: 18,
    contactName: "Guðrún Sigurðardóttir",
    contactEmail: "gudrun@dome.is",
    quantity: 24,
    unitPrice: 49900,
    amountTotal: 1197600,
    invoiceNumber: "LH-2026-042",
    pdfUrl: `${BASE}/api/admin/invoices/sample/pdf`,
  };

  let result: { text: string; html: string; subject?: string };

  switch (template) {
    case "b2b-intro":
      result = renderB2bIntroEmail(sampleData);
      break;
    case "invite":
      result = renderInviteEmail(sampleData);
      break;
    case "welcome":
      result = renderWelcomeEmail(sampleData);
      break;
    case "event-scheduled":
      result = renderEventScheduledEmail(sampleData);
      break;
    case "blood-test-days":
      result = renderBloodTestDaysEmail(sampleData);
      break;
    case "event-reminder":
      result = renderEventReminderEmail(sampleData);
      break;
    case "finalize-staff":
      result = renderFinalizeStaffEmail(sampleData);
      break;
    case "finalize-contact":
      result = renderFinalizeContactEmail(sampleData);
      break;
    case "invoice-contact":
      result = renderInvoiceContactEmail(sampleData);
      break;
    default:
      return NextResponse.json({ error: "unknown_template" }, { status: 400 });
  }

  return NextResponse.json({
    html: result.html,
    text: result.text,
    subject: result.subject || template,
  });
}
