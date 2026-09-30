-- Follow-up appointments get their own mode and video link.
-- Until now one meeting_url served both the interview and the 3-month
-- follow-up: a video follow-up reused (or lacked) the interview's link and an
-- in-person follow-up kept a stale one. The interviewer's Google calendar now
-- mints a Meet link for a video follow-up too (src/lib/hc/calendar-sync.ts).
-- Idempotent.

alter table public.hc_journeys add column if not exists followup_mode text
  check (followup_mode in ('in_person', 'video'));
alter table public.hc_journeys add column if not exists followup_meeting_url text;

comment on column public.hc_journeys.meeting_url is
  'Video link for the interview. Pasted by the nurse or minted by Google Meet on the interviewer''s calendar (calendar-sync.ts).';

-- Automatic reminders (src/app/api/cron/hc-reminders): one of each, ever.
alter table public.hc_journeys add column if not exists interview_reminded_at timestamptz;
alter table public.hc_journeys add column if not exists followup_reminded_at timestamptz;
alter table public.hc_journeys add column if not exists followup_invited_at timestamptz;
alter table public.hc_journeys add column if not exists reevaluation_reminded_at timestamptz;
