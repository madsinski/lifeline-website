// CMS model for the contact page (/contact). The form itself stays wired to
// /api/contact (ContactView keeps the stateful form); the CMS drives all the
// surrounding text + labels. Keyed strings seed from the translations table;
// a few hard-coded bits (address value, account card) are English both.

import type { SiteField, SiteSection, LocaleContent } from "./types";

// Contact has no reorderable marketing bands — just the hero + the form/info
// block. Left empty so the editor hides the section-order card.
export const CONTACT_SECTIONS: SiteSection[] = [];

const G_HERO = "Hetja (efst)";
const G_FORM = "Skilaboðaform";
const G_INFO = "Samskiptaupplýsingar";
const G_ACCOUNT = "Viðskiptavinaspjald";

export const CONTACT_FIELDS: SiteField[] = [
  { key: "hero_title", label: "Fyrirsögn", group: G_HERO, type: "text" },
  { key: "hero_subtitle", label: "Undirtexti", group: G_HERO, type: "textarea" },

  { key: "form_title", label: "Fyrirsögn", group: G_FORM, type: "text" },
  { key: "form_name_label", label: "Nafn — merki", group: G_FORM, type: "text" },
  { key: "form_name_ph", label: "Nafn — vísbending", group: G_FORM, type: "text" },
  { key: "form_email_label", label: "Netfang — merki", group: G_FORM, type: "text" },
  { key: "form_email_ph", label: "Netfang — vísbending", group: G_FORM, type: "text" },
  { key: "form_subject_label", label: "Efni — merki", group: G_FORM, type: "text" },
  { key: "form_subject_ph", label: "Efni — vísbending", group: G_FORM, type: "text" },
  { key: "form_message_label", label: "Skilaboð — merki", group: G_FORM, type: "text" },
  { key: "form_message_ph", label: "Skilaboð — vísbending", group: G_FORM, type: "text" },
  { key: "form_submit", label: "Senda — hnappur", group: G_FORM, type: "text" },
  { key: "form_success_title", label: "Staðfesting — fyrirsögn", group: G_FORM, type: "text" },
  { key: "form_success_desc", label: "Staðfesting — texti", group: G_FORM, type: "textarea" },
  { key: "form_send_another", label: "Senda önnur — hnappur", group: G_FORM, type: "text" },

  { key: "info_title", label: "Fyrirsögn", group: G_INFO, type: "text" },
  { key: "info_email_label", label: "Netfang — merki", group: G_INFO, type: "text" },
  { key: "info_email_value", label: "Netfang — gildi", group: G_INFO, type: "text" },
  { key: "info_address_label", label: "Heimilisfang — merki", group: G_INFO, type: "text" },
  { key: "info_address_value", label: "Heimilisfang — gildi", group: G_INFO, type: "textarea" },
  { key: "info_hours_label", label: "Opnunartími — merki", group: G_INFO, type: "text" },
  { key: "info_hours_value", label: "Opnunartími — gildi", group: G_INFO, type: "text" },

  { key: "account_title", label: "Fyrirsögn", group: G_ACCOUNT, type: "text" },
  { key: "account_desc", label: "Texti", group: G_ACCOUNT, type: "textarea" },
  { key: "account_cta", label: "Hnappur", group: G_ACCOUNT, type: "text" },
  { key: "account_cta_href", label: "Hnappur — hlekkur", group: G_ACCOUNT, type: "link" },
];

const SHARED: LocaleContent = {
  info_email_value: "contact@lifelinehealth.is",
  account_cta_href: "/account/login",
};

export const CONTACT_DEFAULTS_IS: LocaleContent = {
  ...SHARED,
  hero_title: "Hafðu samband",
  hero_subtitle: "Ertu með spurningu eða vilt vita meira? Okkur þætti vænt um að heyra frá þér.",
  form_title: "Sendu okkur skilaboð",
  form_name_label: "Nafn",
  form_name_ph: "Nafnið þitt",
  form_email_label: "Netfang",
  form_email_ph: "þitt@netfang.is",
  form_subject_label: "Efni",
  form_subject_ph: "Hvernig getum við aðstoðað?",
  form_message_label: "Skilaboð",
  form_message_ph: "Segðu okkur meira...",
  form_submit: "Senda skilaboð",
  form_success_title: "Skilaboð send!",
  form_success_desc: "Þakka þér fyrir að hafa samband. Við svörum innan 1-2 virkra daga.",
  form_send_another: "Senda önnur skilaboð",
  info_title: "Samskiptaupplýsingar",
  info_email_label: "Netfang",
  info_address_label: "Heimilisfang",
  info_address_value: "Lagmula 5\n108 Reykjavik\nIceland",
  info_hours_label: "Opnunartími",
  info_hours_value: "Mánudagur–föstudagur: 08:00–17:00",
  account_title: "Ert þú nú þegar viðskiptavinur?",
  account_desc: "Skráðu þig inn á Lifeline-aðganginn þinn til að skoða niðurstöður, bóka tíma eða senda teyminu þínu skilaboð.",
  account_cta: "Skrá inn",
};

export const CONTACT_DEFAULTS_EN: LocaleContent = {
  ...SHARED,
  hero_title: "Get in touch",
  hero_subtitle: "Have a question or want to learn more? We would love to hear from you.",
  form_title: "Send us a message",
  form_name_label: "Name",
  form_name_ph: "Your name",
  form_email_label: "Email",
  form_email_ph: "your@email.com",
  form_subject_label: "Subject",
  form_subject_ph: "How can we help?",
  form_message_label: "Message",
  form_message_ph: "Tell us more...",
  form_submit: "Send Message",
  form_success_title: "Message sent!",
  form_success_desc: "Thank you for reaching out. We will get back to you within 1-2 business days.",
  form_send_another: "Send another message",
  info_title: "Contact information",
  info_email_label: "Email",
  info_address_label: "Address",
  info_address_value: "Lagmula 5\n108 Reykjavik\nIceland",
  info_hours_label: "Office hours",
  info_hours_value: "Monday - Friday: 08:00 - 17:00",
  account_title: "Already a client?",
  account_desc: "Sign in to your Lifeline account to view results, book appointments, or message your team.",
  account_cta: "Sign in",
};
