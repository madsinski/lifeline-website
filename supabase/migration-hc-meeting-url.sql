-- The video-call link for an interview or follow-up.
--
-- Google Meet links cannot be created from this site yet: the website's
-- Google scope is calendar.app.created, which may not attach a conference to
-- the staff member's own calendar. Until that scope is widened, the nurse
-- pastes the link (Meet, Teams or Zoom) when booking a video appointment —
-- it then travels with the booking into the client's account, the reminder
-- messages and the calendar feed.
alter table public.hc_journeys add column if not exists meeting_url text;
