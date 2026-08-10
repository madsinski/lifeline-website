-- Adds the navbar/footer/"What's new" translation keys that were missing from
-- the `translations` table (they had only English code fallbacks, so they
-- rendered English on both locales). Code fallbacks are now Icelandic too, so
-- the Icelandic site is correct without this — running this makes the ENGLISH
-- versions correct and lets the strings be edited in /admin/translations.
-- Idempotent: ON CONFLICT DO NOTHING leaves any existing/edited rows untouched.

insert into public.translations (key, section, en, is_text, approved) values
  ('nav.companies',            'nav',    'Companies',                       'Fyrirtæki',                          true),
  ('nav.check_app',            'nav',    'Check out the app',               'Skoða appið',                        true),
  ('footer.terms',             'footer', 'Terms',                           'Skilmálar',                          true),
  ('footer.privacy',           'footer', 'Privacy',                         'Persónuvernd',                       true),
  ('footer.newsletter.error',  'footer', 'Could not subscribe. Try again.', 'Ekki tókst að skrá. Reyndu aftur.',  true),
  ('home.whatsnew.kicker',     'home',   'What''s new',                     'Nýjungar',                           true),
  ('home.whatsnew.title',      'home',   'New from Lifeline',               'Nýtt hjá Lifeline',                  true),
  ('home.whatsnew.prev',       'home',   'Previous',                        'Fyrri',                              true),
  ('home.whatsnew.next',       'home',   'Next',                            'Næsta',                              true)
on conflict (key) do nothing;
