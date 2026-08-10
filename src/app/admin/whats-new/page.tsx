import { redirect } from "next/navigation";

// "What's new" now lives inside the website CMS.
export default function WhatsNewRedirect() {
  redirect("/admin/website/whats-new");
}
