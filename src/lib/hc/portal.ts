// Where someone books a doctor.
//
// Each location can carry its own Medalia portal (hc_locations.
// patient_portal_url); this is what to use when a page does not have the
// location loaded. It was already written out by hand in several places,
// which is how two of them end up different.
export const MEDALIA_PORTAL_FALLBACK = "https://app.medalia.is";

/** The location's portal if there is one, else the general entrance. */
export const portalFor = (url?: string | null) => url || MEDALIA_PORTAL_FALLBACK;
