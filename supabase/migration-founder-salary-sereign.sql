-- Optional séreignarsparnaður (3rd-pillar pension) flag per founders'-salary
-- month. When on, the payroll breakdown includes the employee 4% + employer 2%
-- séreign contributions. Applied manually. Idempotent.

alter table accounting_founder_salaries
  add column if not exists sereign boolean not null default false;

notify pgrst, 'reload schema';
