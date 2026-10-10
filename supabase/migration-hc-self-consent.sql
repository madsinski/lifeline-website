-- Explicit consent for a report the person uploads themselves.
--
-- A report a nurse imports is processed under Art. 9(2)(h) — care by a
-- health professional. A report somebody uploads for themselves is not
-- that: no clinician has entered the picture, which is why own_report_at
-- deliberately does not advance the clinical stage. The basis is Art.
-- 9(2)(a), explicit consent, and explicit consent has requirements a
-- boolean does not meet.
--
-- So two columns, not one. The timestamp says when; the version says WHAT
-- they agreed to. Storing only "true" proves somebody ticked something,
-- which is not the same as showing what was in front of them when they did
-- — and the wording will change.
--
-- Withdrawal is already there: deleting the report removes the data, and
-- the retention review asks every year whether to keep it.

alter table hc_reports add column if not exists self_consent_at timestamptz;
alter table hc_reports add column if not exists self_consent_version text;

comment on column hc_reports.self_consent_version is
  'Which wording the person agreed to, for Art. 7(1) accountability. See SELF_CONSENT in src/lib/hc/consent.ts.';

notify pgrst, 'reload schema';
