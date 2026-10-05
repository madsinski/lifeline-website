-- The gym behind a location, for the "í hóptímum" branch of the training wizard.
--
-- Deliberately a link and a name, not a copied timetable. Class times belong
-- to the gym, change weekly, and are loaded dynamically on their own site; a
-- stale copy here would send someone to an empty room. Staff keep these three
-- fields current and the participant follows the link for the live schedule.
--
-- Applied manually (see AGENTS.md).

alter table hc_locations add column if not exists gym_name text;
alter table hc_locations add column if not exists gym_url text;
alter table hc_locations add column if not exists gym_info text;

comment on column hc_locations.gym_url is 'Link to the gym''s own live timetable. Never a copy of it.';

update hc_locations
   set gym_name = coalesce(gym_name, 'World Class Eyjar'),
       gym_url  = coalesce(gym_url, 'https://www.worldclass.is/timatafla/')
 where slug = 'vestmannaeyjar';

notify pgrst, 'reload schema';
