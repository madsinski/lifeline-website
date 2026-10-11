-- Body figures the participant reports themselves.
--
-- Why this is needed
-- ------------------
-- Weight reaches the app from exactly one place: the thyngd row of a
-- Grunnheilsa report. Everything calibrated against body mass therefore
-- silently switches off for anybody without one -- and the protein target
-- (1,6-2,0 g per kg) is the number the whole Næring page is held to. On the
-- coaching-only track, which exists precisely for people who do not want the
-- workup, the page was quietly answering "no target" and saying the figure
-- would appear "when weight is available" from measurements that are never
-- going to be taken.
--
-- These columns are the honest alternative: the person tells us, and the
-- target is computed from what they told us.
--
-- Not the same fact as a measurement
-- ----------------------------------
-- A figure somebody typed in is not a figure a nurse measured, and the two
-- must not be confused in a clinical context. Hence a separate column rather
-- than writing into the report: the report stays the record of what was
-- measured, this is what the participant said, and a surface that uses it
-- says which it is. A real measurement always wins where both exist.
--
-- hc_training_settings is the right home: it already owns what the
-- programme is calibrated to -- level, load step, injuries, training days --
-- and this is one more calibration input, not a clinical record.
--
-- API: /api/hc/training (POST self_weight_kg, self_height_cm)

alter table hc_training_settings add column if not exists self_weight_kg numeric(5,1);
alter table hc_training_settings add column if not exists self_height_cm numeric(5,1);
alter table hc_training_settings add column if not exists self_body_at timestamptz;

comment on column hc_training_settings.self_weight_kg is
  'Body weight in kg as the participant reported it. Used for the protein target and starting-weight estimates where no measured value exists. Never a substitute for a measurement in a clinical context.';
comment on column hc_training_settings.self_height_cm is
  'Height in cm as the participant reported it.';
comment on column hc_training_settings.self_body_at is
  'When they last told us, so a stale figure can be re-asked rather than trusted for ever.';
