-- =============================================================
-- Seed translations: English + Icelandic for all website content
-- Run this in the Supabase SQL Editor AFTER migration-translations.sql
-- =============================================================

INSERT INTO translations (key, section, context, en, is_text) VALUES

-- ─── NAVBAR ────────────────────────────────────────────────
('nav.assessment', 'navbar', 'Nav link', 'Assessment', 'Heilsumat'),
('nav.coaching', 'navbar', 'Nav link', 'Coaching', 'Þjálfun'),
('nav.pricing', 'navbar', 'Nav link', 'Pricing', 'Verð'),
('nav.contact', 'navbar', 'Nav link', 'Contact', 'Hafa samband'),
('nav.patient_portal', 'navbar', 'Nav button', 'Patient Portal', 'Sjúklingagátt'),
('nav.my_account', 'navbar', 'Account link', 'My Account', 'Minn reikningur'),
('nav.download_app', 'navbar', 'Mobile menu button', 'Download App', 'Sækja appið'),

-- ─── HOME PAGE ─────────────────────────────────────────────
('home.hero.title', 'home', 'Main heading', 'Take control of your health', 'Taktu stjórnina á heilsu þinni'),
('home.hero.subtitle', 'home', 'Hero paragraph', 'Lifeline Health combines targeted health assessments with personalised daily coaching. Know your numbers, build better habits, track your progress.', 'Lifeline Health sameinar markviss heilsumat og persónulega dagþjálfun. Þekktu tölurnar þínar, byggðu betri venjur, fylgstu með framförum.'),
('home.hero.cta_assessment', 'home', 'Button', 'Book Health Assessment', 'Bóka heilsumat'),
('home.hero.cta_app', 'home', 'Button', 'Download the App', 'Sækja appið'),

('home.stats.programs', 'home', 'Stat', 'Doctor-reviewed programs', 'Læknisyfirfarin forrit'),
('home.stats.coaching', 'home', 'Stat', 'Evidence-based coaching', 'Gagnreyndur þjálfun'),
('home.stats.pillars', 'home', 'Stat', '4 pillars of health', '4 stoðir heilsu'),
('home.stats.founded', 'home', 'Stat', 'Founded in Reykjavík', 'Stofnað í Reykjavík'),

('home.how.title', 'home', 'Section heading', 'How Lifeline works', 'Hvernig Lifeline virkar'),
('home.how.subtitle', 'home', 'Section subtitle', 'Three steps to transform your health', 'Þrjú skref til að umbreyta heilsu þinni'),
('home.how.step1.title', 'home', 'Step title', 'Get assessed', 'Farðu í heilsumat'),
('home.how.step1.desc', 'home', 'Step description', 'Complete body composition, blood tests and lifestyle screening at our stations or through Sameind.', 'Ljúktu líkamssamsetningargreiningu, blóðprufum og lífsstílsgreiningu hjá okkar stöðvum eða í gegnum Sameind.'),
('home.how.step2.title', 'home', 'Step title', 'Get your report', 'Fáðu skýrsluna þína'),
('home.how.step2.desc', 'home', 'Step description', 'A Lifeline doctor reviews your results and meets with you to discuss findings and recommendations.', 'Lifeline læknir fer yfir niðurstöður þínar og hittir þig til að ræða niðurstöður og tillögur.'),
('home.how.step3.title', 'home', 'Step title', 'Start coaching', 'Byrjaðu þjálfun'),
('home.how.step3.desc', 'home', 'Step description', 'Download the app for daily action plans, exercise programs, nutrition guidance and progress tracking.', 'Sæktu appið fyrir daglegar aðgerðaáætlanir, æfingaforrit, næringu ráðgjöf og framvindueftirlit.'),

('home.assessment.title', 'home', 'Section heading', 'Your health assessment', 'Heilsumatið þitt'),
('home.assessment.subtitle', 'home', 'Section subtitle', 'Targeted screening focused on what matters most', 'Markviss skoðun sem beinist að því sem skiptir mestu máli'),
('home.assessment.body_comp', 'home', 'Feature', 'Body composition analysis', 'Greining á líkamssamsetningu'),
('home.assessment.blood', 'home', 'Feature', 'Targeted blood panel', 'Markviss blóðprufupakki'),
('home.assessment.report', 'home', 'Feature', 'Doctor-reviewed health report', 'Heilsuskýrsla yfirfarin af lækni'),
('home.assessment.consultation', 'home', 'Feature', 'Personal consultation', 'Persónuleg ráðgjöf'),
('home.assessment.medalia', 'home', 'Feature', 'Securely stored in Medalia', 'Geymt á öruggan hátt í Medalia'),
('home.assessment.cta_packages', 'home', 'Button', 'View Packages', 'Skoða pakka'),
('home.assessment.cta_portal', 'home', 'Button', 'Patient Portal', 'Sjúklingagátt'),

('home.app.label', 'home', 'Label above heading', 'The Lifeline App', 'Lifeline appið'),
('home.app.title', 'home', 'Section heading', 'Your health change partner', 'Félagi þinn í heilsubreytingunni'),
('home.app.desc', 'home', 'Paragraph', 'The Lifeline app brings your assessment data, coaching programs, and daily actions into one place — making real health change simple and sustainable.', 'Lifeline appið sameinar heilsumatsgögn, þjálfunarforrit og daglegar aðgerðir á einn stað — gerir raunverulega heilsubreytingu einfalda og sjálfbæra.'),
('home.app.feature1', 'home', 'Feature', 'Personalised action plans', 'Persónulegar aðgerðaáætlanir'),
('home.app.feature2', 'home', 'Feature', 'Health coaching and education', 'Heilsuþjálfun og fræðsla'),
('home.app.feature3', 'home', 'Feature', 'Track your progress', 'Fylgstu með framförum'),
('home.app.feature4', 'home', 'Feature', 'Community', 'Samfélag'),
('home.app.cta_download', 'home', 'Button', 'Download the App', 'Sækja appið'),
('home.app.cta_pricing', 'home', 'Button', 'View Subscriptions', 'Skoða áskriftir'),

('home.approach.title', 'home', 'Section heading', 'Our approach', 'Nálgun okkar'),
('home.approach.subtitle', 'home', 'Section subtitle', 'What makes Lifeline Health different', 'Hvað gerir Lifeline Health öðruvísi'),
('home.approach.preventive', 'home', 'Approach', 'Preventive', 'Fyrirbyggjandi'),
('home.approach.data_driven', 'home', 'Approach', 'Data-driven', 'Gagnastýrt'),
('home.approach.doctor_led', 'home', 'Approach', 'Doctor-led', 'Læknastýrt'),
('home.approach.holistic', 'home', 'Approach', 'Holistic', 'Heildrænt'),
('home.approach.personalised', 'home', 'Approach', 'Personalised', 'Persónulegt'),

('home.team.title', 'home', 'Section heading', 'Our team', 'Teymið okkar'),
('home.team.subtitle', 'home', 'Section subtitle', 'The professionals behind your health journey', 'Sérfræðingarnir á bak við heilsuferðalagið þitt'),

('home.partners.title', 'home', 'Section heading', 'Our partners', 'Samstarfsaðilar okkar'),
('home.partners.subtitle', 'home', 'Section subtitle', 'The people and organisations behind Lifeline Health', 'Fólkið og stofnanirnar á bak við Lifeline Health'),

('home.cta.title', 'home', 'Final CTA heading', 'Ready to start?', 'Tilbúin/n til að byrja?'),
('home.cta.desc', 'home', 'Final CTA paragraph', 'Choose your path to better health. Get a comprehensive assessment or start coaching right away with the app.', 'Veldu leiðina að betri heilsu. Farðu í yfirgripsmikið heilsumat eða byrjaðu þjálfun strax með appinu.'),
('home.cta.assessment', 'home', 'Button', 'Book Assessment', 'Bóka heilsumat'),
('home.cta.app', 'home', 'Button', 'Download App', 'Sækja app'),

-- ─── ASSESSMENT PAGE ───────────────────────────────────────
('assessment.hero.title', 'assessment', 'Main heading', 'Health Assessment', 'Heilsumat'),
('assessment.hero.subtitle', 'assessment', 'Hero paragraph', 'Get the health data that matters most. Our targeted screening packages focus on metabolic health markers that drive real change — no unnecessary tests, maximum value.', 'Fáðu heilsugögnin sem skipta mestu máli. Markvissir skoðunarpakkar okkar beinast að efnaskiptamerkjum sem skila raunverulegum breytingum — engar óþarfa rannsóknir, hámarks gildi.'),
('assessment.hero.cta', 'assessment', 'Button', 'Book Assessment', 'Bóka heilsumat'),

('assessment.process.title', 'assessment', 'Section heading', 'The assessment process', 'Heilsumatsferlið'),
('assessment.process.subtitle', 'assessment', 'Section subtitle', 'From booking to personalised recommendations', 'Frá bókun til persónulegra tillagna'),
('assessment.process.step1', 'assessment', 'Step', 'Book your assessment', 'Bókaðu heilsumatið þitt'),
('assessment.process.step2', 'assessment', 'Step', 'Visit our station', 'Heimsæktu stöðina okkar'),
('assessment.process.step3', 'assessment', 'Step', 'Blood test at Sameind', 'Blóðprufa hjá Sameind'),
('assessment.process.step4', 'assessment', 'Step', 'Results reviewed', 'Niðurstöður yfirfarnar'),
('assessment.process.step5', 'assessment', 'Step', 'Doctor interview', 'Læknisviðtal'),

('assessment.results.title', 'assessment', 'Section heading', 'Your results, explained', 'Niðurstöður þínar, útskýrðar'),
('assessment.progress.title', 'assessment', 'Section heading', 'Track your progress', 'Fylgstu með framvindu'),

('assessment.packages.title', 'assessment', 'Section heading', 'Assessment Packages', 'Heilsumatspakkar'),
('assessment.packages.subtitle', 'assessment', 'Section subtitle', 'Choose the assessment that fits your needs', 'Veldu heilsumatið sem hentar þínum þörfum'),
('assessment.packages.foundational', 'assessment', 'Package name', 'Foundational Health', 'Grunnstoð heilsu'),
('assessment.packages.checkin', 'assessment', 'Package name', 'Check-in', 'Endurmat'),
('assessment.packages.self_checkin', 'assessment', 'Package name', 'Self Check-in', 'Sjálfsmat'),

('assessment.locations.title', 'assessment', 'Section heading', 'Test locations', 'Prófunarstaðir'),
('assessment.locations.subtitle', 'assessment', 'Section subtitle', 'Where to complete your assessment', 'Hvar á að ljúka heilsumatinu þínu'),

('assessment.faq.title', 'assessment', 'Section heading', 'Frequently asked questions', 'Algengar spurningar'),

-- ─── COACHING PAGE ─────────────────────────────────────────
('coaching.hero.title', 'coaching', 'Main heading', 'Your daily health coach', 'Daglegur heilsuþjálfari þinn'),
('coaching.hero.subtitle', 'coaching', 'Hero paragraph', 'The Lifeline app delivers personalised daily coaching across four pillars of health. Built on your assessment results, it adapts as you improve.', 'Lifeline appið veitir persónulega dagþjálfun yfir fjórar stoðir heilsu. Byggt á heilsumatsniðurstöðum þínum, aðlagast þjálfunin eftir framförum.'),

('coaching.why.title', 'coaching', 'Section heading', 'Why health coaching works', 'Af hverju heilsuþjálfun virkar'),
('coaching.why.subtitle', 'coaching', 'Section subtitle', 'Knowledge alone doesn''t create change. Coaching bridges the gap between knowing and doing.', 'Þekking ein og sér skapar ekki breytingar. Þjálfun brúar bilið á milli þess að vita og gera.'),
('coaching.why.change', 'coaching', 'Benefit', 'Create real change', 'Skapaðu raunverulegar breytingar'),
('coaching.why.actions', 'coaching', 'Benefit', 'Daily action plans', 'Daglegar aðgerðaáætlanir'),
('coaching.why.coaches', 'coaching', 'Benefit', 'Connect with coaches', 'Tengstu þjálfurum'),
('coaching.why.community', 'coaching', 'Benefit', 'Join the community', 'Vertu hluti af samfélaginu'),
('coaching.why.motivation', 'coaching', 'Benefit', 'Motivation that lasts', 'Hvatning sem endist'),

('coaching.pillars.title', 'coaching', 'Section heading', 'The four pillars of health', 'Fjórar stoðir heilsu'),
('coaching.pillars.subtitle', 'coaching', 'Section subtitle', 'A holistic approach to lasting well-being', 'Heildræn nálgun að varanlegri vellíðan'),
('coaching.pillars.exercise', 'coaching', 'Pillar', 'Exercise', 'Hreyfing'),
('coaching.pillars.nutrition', 'coaching', 'Pillar', 'Nutrition', 'Næring'),
('coaching.pillars.sleep', 'coaching', 'Pillar', 'Sleep', 'Svefn'),
('coaching.pillars.mental', 'coaching', 'Pillar', 'Mental Wellness', 'Andleg vellíðan'),

('coaching.day.title', 'coaching', 'Section heading', 'What a typical day looks like', 'Hvernig dæmigerður dagur lítur út'),
('coaching.day.subtitle', 'coaching', 'Section subtitle', 'Your app guides you through the day with personalised nudges', 'Appið leiðir þig í gegnum daginn með persónulegum áminningunum'),

('coaching.how.title', 'coaching', 'Section heading', 'How coaching works', 'Hvernig þjálfun virkar'),
('coaching.how.subtitle', 'coaching', 'Section subtitle', 'Your assessment powers your coaching experience', 'Heilsumatið þitt knýr þjálfunarupplifunina'),

('coaching.pricing.title', 'coaching', 'Section heading', 'Coaching subscriptions', 'Þjálfunaráskriftir'),
('coaching.pricing.subtitle', 'coaching', 'Section subtitle', 'Choose the plan that fits your goals', 'Veldu áætlunina sem hentar markmiðum þínum'),
('coaching.pricing.free', 'coaching', 'Plan name', 'Free Plan', 'Ókeypis áætlun'),
('coaching.pricing.self', 'coaching', 'Plan name', 'Self-maintained', 'Sjálfstýrt'),
('coaching.pricing.full', 'coaching', 'Plan name', 'Full Access', 'Fullur aðgangur'),
('coaching.pricing.popular', 'coaching', 'Badge', 'Most popular', 'Vinsælast'),

('coaching.compare.title', 'coaching', 'Section heading', 'Compare plans', 'Bera saman áætlanir'),
('coaching.compare.subtitle', 'coaching', 'Section subtitle', 'See what each tier includes', 'Sjáðu hvað hvert stig inniheldur'),
('coaching.compare.feature', 'coaching', 'Table header', 'Feature', 'Eiginleiki'),
('coaching.compare.best', 'coaching', 'Badge', 'Best', 'Besta'),

('coaching.download.title', 'coaching', 'Section heading', 'Download the Lifeline app', 'Sæktu Lifeline appið'),
('coaching.download.desc', 'coaching', 'Paragraph', 'Available on iOS and Android. Start with the free plan and experience personalised health coaching powered by your assessment data.', 'Fáanlegt á iOS og Android. Byrjaðu með ókeypis áætlunina og upplifðu persónulega heilsuþjálfun knúna af heilsumatsgögnum þínum.'),
('coaching.download.ios', 'coaching', 'Button', 'Download on the App Store', 'Sækja í App Store'),
('coaching.download.android', 'coaching', 'Button', 'Get it on Google Play', 'Sækja á Google Play'),

('coaching.assessment_link.title', 'coaching', 'Section heading', 'Better coaching starts with better data', 'Betri þjálfun byrjar á betri gögnum'),
('coaching.assessment_link.desc', 'coaching', 'Paragraph', 'Your health assessment results power every recommendation in the app. Get assessed first for the best coaching experience.', 'Heilsumatsniðurstöður þínar knýja hverja tillögu í appinu. Farðu fyrst í heilsumat til að fá bestu þjálfunarupplifunina.'),
('coaching.assessment_link.cta', 'coaching', 'Button', 'View Assessment Packages', 'Skoða heilsumatspakka'),

-- ─── PRICING PAGE ──────────────────────────────────────────
('pricing.hero.title', 'pricing', 'Main heading', 'Simple, transparent pricing', 'Einfalt, gagnsætt verðlag'),
('pricing.hero.subtitle', 'pricing', 'Hero paragraph', 'Health assessments are one-time bookings. Coaching is a monthly app subscription. No hidden fees.', 'Heilsumat er einskiptisbókun. Þjálfun er mánaðarleg áskrift í appinu. Engin falin gjöld.'),
('pricing.assessments.title', 'pricing', 'Section heading', 'Health Assessment Packages', 'Heilsumatspakkar'),
('pricing.assessments.subtitle', 'pricing', 'Section subtitle', 'One-time payments · Book via patient portal', 'Einskiptisgreiðslur · Bókið í gegnum sjúklingagátt'),
('pricing.coaching.title', 'pricing', 'Section heading', 'Coaching Subscriptions', 'Þjálfunaráskriftir'),
('pricing.coaching.subtitle', 'pricing', 'Section subtitle', 'Monthly subscriptions · Manage on our website', 'Mánaðarlegar áskriftir · Stjórnaðu á vefsíðu okkar'),
('pricing.toggle.monthly', 'pricing', 'Toggle', 'Monthly', 'Mánaðarlega'),
('pricing.toggle.annual', 'pricing', 'Toggle', 'Annual', 'Árlega'),
('pricing.faq.title', 'pricing', 'Section heading', 'Frequently asked questions', 'Algengar spurningar'),
('pricing.faq.subtitle', 'pricing', 'Section subtitle', 'Everything you need to know', 'Allt sem þú þarft að vita'),
('pricing.cta.title', 'pricing', 'CTA heading', 'Ready to start your health journey?', 'Tilbúin/n að hefja heilsuferðalagið?'),
('pricing.cta.desc', 'pricing', 'CTA paragraph', 'Get the health data that matters with our targeted assessments, or start building better habits with personalised coaching.', 'Fáðu heilsugögnin sem skipta máli með markvissri skoðun, eða byrjaðu að byggja betri venjur með persónulegri þjálfun.'),
('pricing.cta.assessment', 'pricing', 'Button', 'Book Assessment', 'Bóka heilsumat'),
('pricing.cta.account', 'pricing', 'Button', 'Create Account', 'Stofna reikning'),

-- ─── CONTACT PAGE ──────────────────────────────────────────
('contact.hero.title', 'contact', 'Main heading', 'Get in touch', 'Hafðu samband'),
('contact.hero.subtitle', 'contact', 'Hero paragraph', 'Have a question or want to learn more? We would love to hear from you.', 'Ertu með spurningu eða vilt vita meira? Okkur þætti vænt um að heyra frá þér.'),
('contact.form.title', 'contact', 'Section heading', 'Send us a message', 'Sendu okkur skilaboð'),
('contact.form.name', 'contact', 'Form label', 'Name', 'Nafn'),
('contact.form.name_placeholder', 'contact', 'Placeholder', 'Your name', 'Nafnið þitt'),
('contact.form.email', 'contact', 'Form label', 'Email', 'Netfang'),
('contact.form.email_placeholder', 'contact', 'Placeholder', 'your@email.com', 'þitt@netfang.is'),
('contact.form.subject', 'contact', 'Form label', 'Subject', 'Efni'),
('contact.form.subject_placeholder', 'contact', 'Placeholder', 'How can we help?', 'Hvernig getum við aðstoðað?'),
('contact.form.message', 'contact', 'Form label', 'Message', 'Skilaboð'),
('contact.form.message_placeholder', 'contact', 'Placeholder', 'Tell us more...', 'Segðu okkur meira...'),
('contact.form.submit', 'contact', 'Button', 'Send Message', 'Senda skilaboð'),
('contact.form.success_title', 'contact', 'Success heading', 'Message sent!', 'Skilaboð send!'),
('contact.form.success_desc', 'contact', 'Success message', 'Thank you for reaching out. We will get back to you within 1-2 business days.', 'Þakka þér fyrir að hafa samband. Við svörum innan 1-2 virkra daga.'),
('contact.form.send_another', 'contact', 'Button', 'Send another message', 'Senda önnur skilaboð'),
('contact.info.title', 'contact', 'Section heading', 'Contact information', 'Samskiptaupplýsingar'),
('contact.info.email_label', 'contact', 'Label', 'Email', 'Netfang'),
('contact.info.address_label', 'contact', 'Label', 'Address', 'Heimilisfang'),
('contact.info.hours_label', 'contact', 'Label', 'Office hours', 'Opnunartími'),
('contact.info.hours_value', 'contact', 'Value', 'Monday - Friday: 08:00 - 17:00', 'Mánudagur - Föstudagur: 08:00 - 17:00'),
('contact.portal.title', 'contact', 'Card title', 'Access the Patient Portal', 'Aðgangur að sjúklingagátt'),
('contact.portal.desc', 'contact', 'Description', 'View your assessment results, book appointments, or complete questionnaires.', 'Skoðaðu heilsumatsniðurstöður, bókaðu tíma eða kláraðu spurningalista.'),
('contact.portal.cta', 'contact', 'Button', 'Open Patient Portal', 'Opna sjúklingagátt'),

-- ─── FOOTER ────────────────────────────────────────────────
('footer.newsletter.title', 'footer', 'Heading', 'Stay up to date', 'Vertu uppfærð/ur'),
('footer.newsletter.desc', 'footer', 'Paragraph', 'Get health tips and Lifeline news delivered to your inbox.', 'Fáðu heilsuráð og Lifeline fréttir beint í pósthólfið þitt.'),
('footer.newsletter.placeholder', 'footer', 'Placeholder', 'your@email.com', 'þitt@netfang.is'),
('footer.newsletter.submit', 'footer', 'Button', 'Subscribe', 'Gerast áskrifandi'),
('footer.newsletter.success', 'footer', 'Success', 'Thanks for subscribing!', 'Takk fyrir áskriftina!'),
('footer.pages', 'footer', 'Column header', 'PAGES', 'SÍÐUR'),
('footer.services', 'footer', 'Column header', 'SERVICES', 'ÞJÓNUSTA'),
('footer.contact', 'footer', 'Column header', 'CONTACT', 'SAMSKIPTI'),
('footer.home', 'footer', 'Link', 'Home', 'Heim'),
('footer.health_assessment', 'footer', 'Link', 'Health Assessment', 'Heilsumat'),
('footer.coaching', 'footer', 'Link', 'Coaching', 'Þjálfun'),
('footer.pricing', 'footer', 'Link', 'Pricing', 'Verð'),
('footer.contact_link', 'footer', 'Link', 'Contact', 'Hafa samband'),
('footer.health_coaching_app', 'footer', 'Link', 'Health Coaching App', 'Heilsuþjálfunar app'),
('footer.tagline', 'footer', 'Brand description', 'Comprehensive health assessments and personalised daily coaching.', 'Yfirgripsmikil heilsumat og persónuleg dagleg þjálfun.'),
('footer.copyright', 'footer', 'Copyright', '© 2026 Lifeline Health ehf. All rights reserved.', '© 2026 Lifeline Health ehf. Öll réttindi áskilin.'),
('footer.back_to_top', 'footer', 'Link', 'Back to top', 'Efst á síðu'),

-- ─── COMMON / SHARED ──────────────────────────────────────
('common.per_month', 'common', 'Price suffix', '/month', '/mánuð'),
('common.one_time', 'common', 'Price label', 'One-time', 'Einskiptis'),
('common.free', 'common', 'Price', 'Free', 'Ókeypis'),
('common.ideal_for', 'common', 'Label', 'Ideal for:', 'Hentar fyrir:'),
('common.included', 'common', 'Label', 'Included', 'Innifalið'),
('common.not_included', 'common', 'Label', 'Not included', 'Ekki innifalið'),
('common.learn_more', 'common', 'Link', 'Learn more', 'Fræðast meira'),
('common.get_started', 'common', 'Button', 'Get started', 'Byrja'),
('common.book_now', 'common', 'Button', 'Book now', 'Bóka núna'),
('common.coming_soon', 'common', 'Label', 'Coming Soon', 'Væntanlegt'),
('common.coming_soon_desc', 'common', 'Paragraph', 'We''re building something great. Follow our journey and be the first to know when we launch.', 'Við erum að smíða eitthvað frábært. Fylgdu ferðalaginu og vertu fyrstur til að vita þegar við opnum.')

ON CONFLICT (key) DO UPDATE SET
  en = EXCLUDED.en,
  is_text = EXCLUDED.is_text,
  section = EXCLUDED.section,
  context = EXCLUDED.context,
  updated_at = now();
