import ContactView from "./ContactView";

// CMS-driven: ContactView fetches the published content blob
// (src/app/api/site-content/contact) and falls back to the built-in defaults in
// src/lib/site-content/contact.ts. The form still posts to /api/contact.
export default function ContactPage() {
  return <ContactView />;
}
