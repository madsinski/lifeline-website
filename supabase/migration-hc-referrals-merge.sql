-- One model for "needs a doctor": hc_referrals.
-- The request-doctor flag (doctor_review_*) and the Heilsugæsla flag
-- (referral_to_heilsugaesla) on hc_journeys become referral rows, so the
-- workstation shows one list. The flags stay and are kept in step by
-- /api/vinnustod/journeys/[id]/referrals (target 'lifeline_doctor' is the
-- in-house assessment). Idempotent: only journeys without such a row.

insert into public.hc_referrals (journey_id, client_id, target, reason, note, status, suggested_by, requested_by, decided_by, decided_at, created_at)
select j.id, j.client_id, 'lifeline_doctor',
       coalesce(nullif(j.doctor_review_note, ''), 'Beiðni um mat læknis'), null,
       case when j.doctor_reviewed_at is not null then 'done' else 'requested' end,
       'nurse', 'flutt úr eldri skráningu',
       case when j.doctor_reviewed_at is not null then 'flutt úr eldri skráningu' end,
       j.doctor_reviewed_at, j.doctor_review_requested_at
from public.hc_journeys j
where j.doctor_review_requested_at is not null
  and not exists (select 1 from public.hc_referrals r where r.journey_id = j.id and r.target = 'lifeline_doctor');

insert into public.hc_referrals (journey_id, client_id, target, reason, note, status, suggested_by, requested_by, decided_by, decided_at, created_at)
select j.id, j.client_id, 'heilsugaesla',
       coalesce(nullif(j.referral_note, ''), 'Vísað á Heilsugæsluna'), null, 'approved',
       'nurse', 'flutt úr eldri skráningu', 'flutt úr eldri skráningu', coalesce(j.referred_at, now()), coalesce(j.referred_at, now())
from public.hc_journeys j
where j.referral_to_heilsugaesla = true
  and not exists (select 1 from public.hc_referrals r where r.journey_id = j.id and r.target = 'heilsugaesla');
