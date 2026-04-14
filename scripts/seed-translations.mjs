import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://cfnibfxzltxiriqxvvru.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbmliZnh6bHR4aXJpcXh2dnJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzQxMDgsImV4cCI6MjA5MDQ1MDEwOH0.LHBADsUdW7SBtrxZ9KikTmAl5brBGPb3gFTMuPYrmD8'
);

const translations = [
  // NAVBAR
  { key: 'nav.assessment', section: 'navbar', context: 'Nav link', en: 'Assessment', is_text: 'Heilsumat' },
  { key: 'nav.coaching', section: 'navbar', context: 'Nav link', en: 'Coaching', is_text: 'Þjálfun' },
  { key: 'nav.pricing', section: 'navbar', context: 'Nav link', en: 'Pricing', is_text: 'Verð' },
  { key: 'nav.contact', section: 'navbar', context: 'Nav link', en: 'Contact', is_text: 'Hafa samband' },
  { key: 'nav.patient_portal', section: 'navbar', context: 'Nav button', en: 'Patient Portal', is_text: 'Sjúklingagátt' },
  { key: 'nav.my_account', section: 'navbar', context: 'Account link', en: 'My Account', is_text: 'Minn reikningur' },
  { key: 'nav.download_app', section: 'navbar', context: 'Mobile menu button', en: 'Download App', is_text: 'Sækja appið' },

  // HOME
  { key: 'home.hero.title', section: 'home', context: 'Main heading', en: 'Take control of your health', is_text: 'Taktu stjórnina á heilsu þinni' },
  { key: 'home.hero.subtitle', section: 'home', context: 'Hero paragraph', en: 'Lifeline Health combines targeted health assessments with personalised daily coaching. Know your numbers, build better habits, track your progress.', is_text: 'Lifeline Health sameinar markviss heilsumat og persónulega dagþjálfun. Þekktu tölurnar þínar, byggðu betri venjur, fylgstu með framförum.' },
  { key: 'home.hero.cta_assessment', section: 'home', context: 'Button', en: 'Book Health Assessment', is_text: 'Bóka heilsumat' },
  { key: 'home.hero.cta_app', section: 'home', context: 'Button', en: 'Download the App', is_text: 'Sækja appið' },
  { key: 'home.stats.programs', section: 'home', context: 'Stat', en: 'Doctor-reviewed programs', is_text: 'Læknisyfirfarin forrit' },
  { key: 'home.stats.coaching', section: 'home', context: 'Stat', en: 'Evidence-based coaching', is_text: 'Gagnreyndur þjálfun' },
  { key: 'home.stats.pillars', section: 'home', context: 'Stat', en: '4 pillars of health', is_text: '4 stoðir heilsu' },
  { key: 'home.stats.founded', section: 'home', context: 'Stat', en: 'Founded in Reykjavík', is_text: 'Stofnað í Reykjavík' },
  { key: 'home.how.title', section: 'home', context: 'Section heading', en: 'How Lifeline works', is_text: 'Hvernig Lifeline virkar' },
  { key: 'home.how.subtitle', section: 'home', context: 'Section subtitle', en: 'Three steps to transform your health', is_text: 'Þrjú skref til að umbreyta heilsu þinni' },
  { key: 'home.how.step1.title', section: 'home', context: 'Step title', en: 'Get assessed', is_text: 'Farðu í heilsumat' },
  { key: 'home.how.step1.desc', section: 'home', context: 'Step description', en: 'Complete body composition, blood tests and lifestyle screening at our stations or through Sameind.', is_text: 'Ljúktu líkamssamsetningargreiningu, blóðprufum og lífsstílsgreiningu hjá okkar stöðvum eða í gegnum Sameind.' },
  { key: 'home.how.step2.title', section: 'home', context: 'Step title', en: 'Get your report', is_text: 'Fáðu skýrsluna þína' },
  { key: 'home.how.step2.desc', section: 'home', context: 'Step description', en: 'A Lifeline doctor reviews your results and meets with you to discuss findings and recommendations.', is_text: 'Lifeline læknir fer yfir niðurstöður þínar og hittir þig til að ræða niðurstöður og tillögur.' },
  { key: 'home.how.step3.title', section: 'home', context: 'Step title', en: 'Start coaching', is_text: 'Byrjaðu þjálfun' },
  { key: 'home.how.step3.desc', section: 'home', context: 'Step description', en: 'Download the app for daily action plans, exercise programs, nutrition guidance and progress tracking.', is_text: 'Sæktu appið fyrir daglegar aðgerðaáætlanir, æfingaforrit, næringarráðgjöf og framvindueftirlit.' },
  { key: 'home.assessment.title', section: 'home', context: 'Section heading', en: 'Your health assessment', is_text: 'Heilsumatið þitt' },
  { key: 'home.assessment.subtitle', section: 'home', context: 'Section subtitle', en: 'Targeted screening focused on what matters most', is_text: 'Markviss skoðun sem beinist að því sem skiptir mestu máli' },
  { key: 'home.assessment.body_comp', section: 'home', context: 'Feature', en: 'Body composition analysis', is_text: 'Greining á líkamssamsetningu' },
  { key: 'home.assessment.blood', section: 'home', context: 'Feature', en: 'Targeted blood panel', is_text: 'Markviss blóðprufupakki' },
  { key: 'home.assessment.report', section: 'home', context: 'Feature', en: 'Doctor-reviewed health report', is_text: 'Heilsuskýrsla yfirfarin af lækni' },
  { key: 'home.assessment.consultation', section: 'home', context: 'Feature', en: 'Personal consultation', is_text: 'Persónuleg ráðgjöf' },
  { key: 'home.assessment.medalia', section: 'home', context: 'Feature', en: 'Securely stored in Medalia', is_text: 'Geymt á öruggan hátt í Medalia' },
  { key: 'home.assessment.cta_packages', section: 'home', context: 'Button', en: 'View Packages', is_text: 'Skoða pakka' },
  { key: 'home.assessment.cta_portal', section: 'home', context: 'Button', en: 'Patient Portal', is_text: 'Sjúklingagátt' },
  { key: 'home.app.label', section: 'home', context: 'Label above heading', en: 'The Lifeline App', is_text: 'Lifeline appið' },
  { key: 'home.app.title', section: 'home', context: 'Section heading', en: 'Your health change partner', is_text: 'Félagi þinn í heilsubreytingunni' },
  { key: 'home.app.desc', section: 'home', context: 'Paragraph', en: 'The Lifeline app brings your assessment data, coaching programs, and daily actions into one place — making real health change simple and sustainable.', is_text: 'Lifeline appið sameinar heilsumatsgögn, þjálfunarforrit og daglegar aðgerðir á einn stað — gerir raunverulega heilsubreytingu einfalda og sjálfbæra.' },
  { key: 'home.app.feature1', section: 'home', context: 'Feature', en: 'Personalised action plans', is_text: 'Persónulegar aðgerðaáætlanir' },
  { key: 'home.app.feature2', section: 'home', context: 'Feature', en: 'Health coaching and education', is_text: 'Heilsuþjálfun og fræðsla' },
  { key: 'home.app.feature3', section: 'home', context: 'Feature', en: 'Track your progress', is_text: 'Fylgstu með framförum' },
  { key: 'home.app.feature4', section: 'home', context: 'Feature', en: 'Community', is_text: 'Samfélag' },
  { key: 'home.app.cta_download', section: 'home', context: 'Button', en: 'Download the App', is_text: 'Sækja appið' },
  { key: 'home.app.cta_pricing', section: 'home', context: 'Button', en: 'View Subscriptions', is_text: 'Skoða áskriftir' },
  { key: 'home.approach.title', section: 'home', context: 'Section heading', en: 'Our approach', is_text: 'Nálgun okkar' },
  { key: 'home.approach.subtitle', section: 'home', context: 'Section subtitle', en: 'What makes Lifeline Health different', is_text: 'Hvað gerir Lifeline Health öðruvísi' },
  { key: 'home.approach.preventive', section: 'home', context: 'Approach', en: 'Preventive', is_text: 'Fyrirbyggjandi' },
  { key: 'home.approach.data_driven', section: 'home', context: 'Approach', en: 'Data-driven', is_text: 'Gagnastýrt' },
  { key: 'home.approach.doctor_led', section: 'home', context: 'Approach', en: 'Doctor-led', is_text: 'Læknastýrt' },
  { key: 'home.approach.holistic', section: 'home', context: 'Approach', en: 'Holistic', is_text: 'Heildrænt' },
  { key: 'home.approach.personalised', section: 'home', context: 'Approach', en: 'Personalised', is_text: 'Persónulegt' },
  { key: 'home.team.title', section: 'home', context: 'Section heading', en: 'Our team', is_text: 'Teymið okkar' },
  { key: 'home.team.subtitle', section: 'home', context: 'Section subtitle', en: 'The professionals behind your health journey', is_text: 'Sérfræðingarnir á bak við heilsuferðalagið þitt' },
  { key: 'home.partners.title', section: 'home', context: 'Section heading', en: 'Our partners', is_text: 'Samstarfsaðilar okkar' },
  { key: 'home.partners.subtitle', section: 'home', context: 'Section subtitle', en: 'The people and organisations behind Lifeline Health', is_text: 'Fólkið og stofnanirnar á bak við Lifeline Health' },
  { key: 'home.cta.title', section: 'home', context: 'Final CTA heading', en: 'Ready to start?', is_text: 'Tilbúin/n til að byrja?' },
  { key: 'home.cta.desc', section: 'home', context: 'Final CTA paragraph', en: 'Choose your path to better health. Get a comprehensive assessment or start coaching right away with the app.', is_text: 'Veldu leiðina að betri heilsu. Farðu í yfirgripsmikið heilsumat eða byrjaðu þjálfun strax með appinu.' },
  { key: 'home.cta.assessment', section: 'home', context: 'Button', en: 'Book Assessment', is_text: 'Bóka heilsumat' },
  { key: 'home.cta.app', section: 'home', context: 'Button', en: 'Download App', is_text: 'Sækja app' },

  // ASSESSMENT
  { key: 'assessment.hero.title', section: 'assessment', context: 'Main heading', en: 'Health Assessment', is_text: 'Heilsumat' },
  { key: 'assessment.hero.subtitle', section: 'assessment', context: 'Hero paragraph', en: 'Get the health data that matters most. Our targeted screening packages focus on metabolic health markers that drive real change — no unnecessary tests, maximum value.', is_text: 'Fáðu heilsugögnin sem skipta mestu máli. Markvissir skoðunarpakkar okkar beinast að efnaskiptamerkjum sem skila raunverulegum breytingum — engar óþarfa rannsóknir, hámarks gildi.' },
  { key: 'assessment.hero.cta', section: 'assessment', context: 'Button', en: 'Book Assessment', is_text: 'Bóka heilsumat' },
  { key: 'assessment.process.title', section: 'assessment', context: 'Section heading', en: 'The assessment process', is_text: 'Heilsumatsferlið' },
  { key: 'assessment.process.subtitle', section: 'assessment', context: 'Section subtitle', en: 'From booking to personalised recommendations', is_text: 'Frá bókun til persónulegra tillagna' },
  { key: 'assessment.process.step1', section: 'assessment', context: 'Step', en: 'Book your assessment', is_text: 'Bókaðu heilsumatið þitt' },
  { key: 'assessment.process.step2', section: 'assessment', context: 'Step', en: 'Visit our station', is_text: 'Heimsæktu stöðina okkar' },
  { key: 'assessment.process.step3', section: 'assessment', context: 'Step', en: 'Blood test at Sameind', is_text: 'Blóðprufa hjá Sameind' },
  { key: 'assessment.process.step4', section: 'assessment', context: 'Step', en: 'Results reviewed', is_text: 'Niðurstöður yfirfarnar' },
  { key: 'assessment.process.step5', section: 'assessment', context: 'Step', en: 'Doctor interview', is_text: 'Læknisviðtal' },
  { key: 'assessment.results.title', section: 'assessment', context: 'Section heading', en: 'Your results, explained', is_text: 'Niðurstöður þínar, útskýrðar' },
  { key: 'assessment.progress.title', section: 'assessment', context: 'Section heading', en: 'Track your progress', is_text: 'Fylgstu með framvindu' },
  { key: 'assessment.packages.title', section: 'assessment', context: 'Section heading', en: 'Assessment Packages', is_text: 'Heilsumatspakkar' },
  { key: 'assessment.packages.subtitle', section: 'assessment', context: 'Section subtitle', en: 'Choose the assessment that fits your needs', is_text: 'Veldu heilsumatið sem hentar þínum þörfum' },
  { key: 'assessment.packages.foundational', section: 'assessment', context: 'Package name', en: 'Foundational Health', is_text: 'Grunnstoð heilsu' },
  { key: 'assessment.packages.checkin', section: 'assessment', context: 'Package name', en: 'Check-in', is_text: 'Endurmat' },
  { key: 'assessment.packages.self_checkin', section: 'assessment', context: 'Package name', en: 'Self Check-in', is_text: 'Sjálfsmat' },
  { key: 'assessment.locations.title', section: 'assessment', context: 'Section heading', en: 'Test locations', is_text: 'Prófunarstaðir' },
  { key: 'assessment.locations.subtitle', section: 'assessment', context: 'Section subtitle', en: 'Where to complete your assessment', is_text: 'Hvar á að ljúka heilsumatinu þínu' },
  { key: 'assessment.faq.title', section: 'assessment', context: 'Section heading', en: 'Frequently asked questions', is_text: 'Algengar spurningar' },

  // COACHING
  { key: 'coaching.hero.title', section: 'coaching', context: 'Main heading', en: 'Your daily health coach', is_text: 'Daglegur heilsuþjálfari þinn' },
  { key: 'coaching.hero.subtitle', section: 'coaching', context: 'Hero paragraph', en: 'The Lifeline app delivers personalised daily coaching across four pillars of health. Built on your assessment results, it adapts as you improve.', is_text: 'Lifeline appið veitir persónulega dagþjálfun yfir fjórar stoðir heilsu. Byggt á heilsumatsniðurstöðum þínum, aðlagast þjálfunin eftir framförum.' },
  { key: 'coaching.why.title', section: 'coaching', context: 'Section heading', en: 'Why health coaching works', is_text: 'Af hverju heilsuþjálfun virkar' },
  { key: 'coaching.why.subtitle', section: 'coaching', context: 'Section subtitle', en: 'Knowledge alone doesn\'t create change. Coaching bridges the gap between knowing and doing.', is_text: 'Þekking ein og sér skapar ekki breytingar. Þjálfun brúar bilið á milli þess að vita og gera.' },
  { key: 'coaching.why.change', section: 'coaching', context: 'Benefit', en: 'Create real change', is_text: 'Skapaðu raunverulegar breytingar' },
  { key: 'coaching.why.actions', section: 'coaching', context: 'Benefit', en: 'Daily action plans', is_text: 'Daglegar aðgerðaáætlanir' },
  { key: 'coaching.why.coaches', section: 'coaching', context: 'Benefit', en: 'Connect with coaches', is_text: 'Tengstu þjálfurum' },
  { key: 'coaching.why.community', section: 'coaching', context: 'Benefit', en: 'Join the community', is_text: 'Vertu hluti af samfélaginu' },
  { key: 'coaching.why.motivation', section: 'coaching', context: 'Benefit', en: 'Motivation that lasts', is_text: 'Hvatning sem endist' },
  { key: 'coaching.pillars.title', section: 'coaching', context: 'Section heading', en: 'The four pillars of health', is_text: 'Fjórar stoðir heilsu' },
  { key: 'coaching.pillars.subtitle', section: 'coaching', context: 'Section subtitle', en: 'A holistic approach to lasting well-being', is_text: 'Heildræn nálgun að varanlegri vellíðan' },
  { key: 'coaching.pillars.exercise', section: 'coaching', context: 'Pillar', en: 'Exercise', is_text: 'Hreyfing' },
  { key: 'coaching.pillars.nutrition', section: 'coaching', context: 'Pillar', en: 'Nutrition', is_text: 'Næring' },
  { key: 'coaching.pillars.sleep', section: 'coaching', context: 'Pillar', en: 'Sleep', is_text: 'Svefn' },
  { key: 'coaching.pillars.mental', section: 'coaching', context: 'Pillar', en: 'Mental Wellness', is_text: 'Andleg vellíðan' },
  { key: 'coaching.day.title', section: 'coaching', context: 'Section heading', en: 'What a typical day looks like', is_text: 'Hvernig dæmigerður dagur lítur út' },
  { key: 'coaching.day.subtitle', section: 'coaching', context: 'Section subtitle', en: 'Your app guides you through the day with personalised nudges', is_text: 'Appið leiðir þig í gegnum daginn með persónulegum áminningunum' },
  { key: 'coaching.how.title', section: 'coaching', context: 'Section heading', en: 'How coaching works', is_text: 'Hvernig þjálfun virkar' },
  { key: 'coaching.how.subtitle', section: 'coaching', context: 'Section subtitle', en: 'Your assessment powers your coaching experience', is_text: 'Heilsumatið þitt knýr þjálfunarupplifunina' },
  { key: 'coaching.pricing.title', section: 'coaching', context: 'Section heading', en: 'Coaching subscriptions', is_text: 'Þjálfunaráskriftir' },
  { key: 'coaching.pricing.subtitle', section: 'coaching', context: 'Section subtitle', en: 'Choose the plan that fits your goals', is_text: 'Veldu áætlunina sem hentar markmiðum þínum' },
  { key: 'coaching.pricing.free', section: 'coaching', context: 'Plan name', en: 'Free Plan', is_text: 'Ókeypis áætlun' },
  { key: 'coaching.pricing.self', section: 'coaching', context: 'Plan name', en: 'Self-maintained', is_text: 'Sjálfstýrt' },
  { key: 'coaching.pricing.full', section: 'coaching', context: 'Plan name', en: 'Full Access', is_text: 'Fullur aðgangur' },
  { key: 'coaching.pricing.popular', section: 'coaching', context: 'Badge', en: 'Most popular', is_text: 'Vinsælast' },
  { key: 'coaching.compare.title', section: 'coaching', context: 'Section heading', en: 'Compare plans', is_text: 'Bera saman áætlanir' },
  { key: 'coaching.compare.subtitle', section: 'coaching', context: 'Section subtitle', en: 'See what each tier includes', is_text: 'Sjáðu hvað hvert stig inniheldur' },
  { key: 'coaching.compare.feature', section: 'coaching', context: 'Table header', en: 'Feature', is_text: 'Eiginleiki' },
  { key: 'coaching.compare.best', section: 'coaching', context: 'Badge', en: 'Best', is_text: 'Besta' },
  { key: 'coaching.download.title', section: 'coaching', context: 'Section heading', en: 'Download the Lifeline app', is_text: 'Sæktu Lifeline appið' },
  { key: 'coaching.download.desc', section: 'coaching', context: 'Paragraph', en: 'Available on iOS and Android. Start with the free plan and experience personalised health coaching powered by your assessment data.', is_text: 'Fáanlegt á iOS og Android. Byrjaðu með ókeypis áætlunina og upplifðu persónulega heilsuþjálfun knúna af heilsumatsgögnum þínum.' },
  { key: 'coaching.download.ios', section: 'coaching', context: 'Button', en: 'Download on the App Store', is_text: 'Sækja í App Store' },
  { key: 'coaching.download.android', section: 'coaching', context: 'Button', en: 'Get it on Google Play', is_text: 'Sækja á Google Play' },
  { key: 'coaching.assessment_link.title', section: 'coaching', context: 'Section heading', en: 'Better coaching starts with better data', is_text: 'Betri þjálfun byrjar á betri gögnum' },
  { key: 'coaching.assessment_link.desc', section: 'coaching', context: 'Paragraph', en: 'Your health assessment results power every recommendation in the app. Get assessed first for the best coaching experience.', is_text: 'Heilsumatsniðurstöður þínar knýja hverja tillögu í appinu. Farðu fyrst í heilsumat til að fá bestu þjálfunarupplifunina.' },
  { key: 'coaching.assessment_link.cta', section: 'coaching', context: 'Button', en: 'View Assessment Packages', is_text: 'Skoða heilsumatspakka' },

  // PRICING
  { key: 'pricing.hero.title', section: 'pricing', context: 'Main heading', en: 'Simple, transparent pricing', is_text: 'Einfalt, gagnsætt verðlag' },
  { key: 'pricing.hero.subtitle', section: 'pricing', context: 'Hero paragraph', en: 'Health assessments are one-time bookings. Coaching is a monthly app subscription. No hidden fees.', is_text: 'Heilsumat er einskiptisbókun. Þjálfun er mánaðarleg áskrift í appinu. Engin falin gjöld.' },
  { key: 'pricing.assessments.title', section: 'pricing', context: 'Section heading', en: 'Health Assessment Packages', is_text: 'Heilsumatspakkar' },
  { key: 'pricing.assessments.subtitle', section: 'pricing', context: 'Section subtitle', en: 'One-time payments · Book via patient portal', is_text: 'Einskiptisgreiðslur · Bókið í gegnum sjúklingagátt' },
  { key: 'pricing.coaching.title', section: 'pricing', context: 'Section heading', en: 'Coaching Subscriptions', is_text: 'Þjálfunaráskriftir' },
  { key: 'pricing.coaching.subtitle', section: 'pricing', context: 'Section subtitle', en: 'Monthly subscriptions · Manage on our website', is_text: 'Mánaðarlegar áskriftir · Stjórnaðu á vefsíðu okkar' },
  { key: 'pricing.toggle.monthly', section: 'pricing', context: 'Toggle', en: 'Monthly', is_text: 'Mánaðarlega' },
  { key: 'pricing.toggle.annual', section: 'pricing', context: 'Toggle', en: 'Annual', is_text: 'Árlega' },
  { key: 'pricing.faq.title', section: 'pricing', context: 'Section heading', en: 'Frequently asked questions', is_text: 'Algengar spurningar' },
  { key: 'pricing.faq.subtitle', section: 'pricing', context: 'Section subtitle', en: 'Everything you need to know', is_text: 'Allt sem þú þarft að vita' },
  { key: 'pricing.cta.title', section: 'pricing', context: 'CTA heading', en: 'Ready to start your health journey?', is_text: 'Tilbúin/n að hefja heilsuferðalagið?' },
  { key: 'pricing.cta.desc', section: 'pricing', context: 'CTA paragraph', en: 'Get the health data that matters with our targeted assessments, or start building better habits with personalised coaching.', is_text: 'Fáðu heilsugögnin sem skipta máli með markvissri skoðun, eða byrjaðu að byggja betri venjur með persónulegri þjálfun.' },
  { key: 'pricing.cta.assessment', section: 'pricing', context: 'Button', en: 'Book Assessment', is_text: 'Bóka heilsumat' },
  { key: 'pricing.cta.account', section: 'pricing', context: 'Button', en: 'Create Account', is_text: 'Stofna reikning' },

  // CONTACT
  { key: 'contact.hero.title', section: 'contact', context: 'Main heading', en: 'Get in touch', is_text: 'Hafðu samband' },
  { key: 'contact.hero.subtitle', section: 'contact', context: 'Hero paragraph', en: 'Have a question or want to learn more? We would love to hear from you.', is_text: 'Ertu með spurningu eða vilt vita meira? Okkur þætti vænt um að heyra frá þér.' },
  { key: 'contact.form.title', section: 'contact', context: 'Section heading', en: 'Send us a message', is_text: 'Sendu okkur skilaboð' },
  { key: 'contact.form.name', section: 'contact', context: 'Form label', en: 'Name', is_text: 'Nafn' },
  { key: 'contact.form.name_placeholder', section: 'contact', context: 'Placeholder', en: 'Your name', is_text: 'Nafnið þitt' },
  { key: 'contact.form.email', section: 'contact', context: 'Form label', en: 'Email', is_text: 'Netfang' },
  { key: 'contact.form.email_placeholder', section: 'contact', context: 'Placeholder', en: 'your@email.com', is_text: 'þitt@netfang.is' },
  { key: 'contact.form.subject', section: 'contact', context: 'Form label', en: 'Subject', is_text: 'Efni' },
  { key: 'contact.form.subject_placeholder', section: 'contact', context: 'Placeholder', en: 'How can we help?', is_text: 'Hvernig getum við aðstoðað?' },
  { key: 'contact.form.message', section: 'contact', context: 'Form label', en: 'Message', is_text: 'Skilaboð' },
  { key: 'contact.form.message_placeholder', section: 'contact', context: 'Placeholder', en: 'Tell us more...', is_text: 'Segðu okkur meira...' },
  { key: 'contact.form.submit', section: 'contact', context: 'Button', en: 'Send Message', is_text: 'Senda skilaboð' },
  { key: 'contact.form.success_title', section: 'contact', context: 'Success heading', en: 'Message sent!', is_text: 'Skilaboð send!' },
  { key: 'contact.form.success_desc', section: 'contact', context: 'Success message', en: 'Thank you for reaching out. We will get back to you within 1-2 business days.', is_text: 'Þakka þér fyrir að hafa samband. Við svörum innan 1-2 virkra daga.' },
  { key: 'contact.form.send_another', section: 'contact', context: 'Button', en: 'Send another message', is_text: 'Senda önnur skilaboð' },
  { key: 'contact.info.title', section: 'contact', context: 'Section heading', en: 'Contact information', is_text: 'Samskiptaupplýsingar' },
  { key: 'contact.info.email_label', section: 'contact', context: 'Label', en: 'Email', is_text: 'Netfang' },
  { key: 'contact.info.address_label', section: 'contact', context: 'Label', en: 'Address', is_text: 'Heimilisfang' },
  { key: 'contact.info.hours_label', section: 'contact', context: 'Label', en: 'Office hours', is_text: 'Opnunartími' },
  { key: 'contact.info.hours_value', section: 'contact', context: 'Value', en: 'Monday - Friday: 08:00 - 17:00', is_text: 'Mánudagur - Föstudagur: 08:00 - 17:00' },
  { key: 'contact.portal.title', section: 'contact', context: 'Card title', en: 'Access the Patient Portal', is_text: 'Aðgangur að sjúklingagátt' },
  { key: 'contact.portal.desc', section: 'contact', context: 'Description', en: 'View your assessment results, book appointments, or complete questionnaires.', is_text: 'Skoðaðu heilsumatsniðurstöður, bókaðu tíma eða kláraðu spurningalista.' },
  { key: 'contact.portal.cta', section: 'contact', context: 'Button', en: 'Open Patient Portal', is_text: 'Opna sjúklingagátt' },

  // FOOTER
  { key: 'footer.newsletter.title', section: 'footer', context: 'Heading', en: 'Stay up to date', is_text: 'Vertu uppfærð/ur' },
  { key: 'footer.newsletter.desc', section: 'footer', context: 'Paragraph', en: 'Get health tips and Lifeline news delivered to your inbox.', is_text: 'Fáðu heilsuráð og Lifeline fréttir beint í pósthólfið þitt.' },
  { key: 'footer.newsletter.placeholder', section: 'footer', context: 'Placeholder', en: 'your@email.com', is_text: 'þitt@netfang.is' },
  { key: 'footer.newsletter.submit', section: 'footer', context: 'Button', en: 'Subscribe', is_text: 'Gerast áskrifandi' },
  { key: 'footer.newsletter.success', section: 'footer', context: 'Success', en: 'Thanks for subscribing!', is_text: 'Takk fyrir áskriftina!' },
  { key: 'footer.pages', section: 'footer', context: 'Column header', en: 'PAGES', is_text: 'SÍÐUR' },
  { key: 'footer.services', section: 'footer', context: 'Column header', en: 'SERVICES', is_text: 'ÞJÓNUSTA' },
  { key: 'footer.contact', section: 'footer', context: 'Column header', en: 'CONTACT', is_text: 'SAMSKIPTI' },
  { key: 'footer.home', section: 'footer', context: 'Link', en: 'Home', is_text: 'Heim' },
  { key: 'footer.health_assessment', section: 'footer', context: 'Link', en: 'Health Assessment', is_text: 'Heilsumat' },
  { key: 'footer.coaching', section: 'footer', context: 'Link', en: 'Coaching', is_text: 'Þjálfun' },
  { key: 'footer.pricing', section: 'footer', context: 'Link', en: 'Pricing', is_text: 'Verð' },
  { key: 'footer.contact_link', section: 'footer', context: 'Link', en: 'Contact', is_text: 'Hafa samband' },
  { key: 'footer.health_coaching_app', section: 'footer', context: 'Link', en: 'Health Coaching App', is_text: 'Heilsuþjálfunar app' },
  { key: 'footer.tagline', section: 'footer', context: 'Brand description', en: 'Comprehensive health assessments and personalised daily coaching.', is_text: 'Yfirgripsmikil heilsumat og persónuleg dagleg þjálfun.' },
  { key: 'footer.copyright', section: 'footer', context: 'Copyright', en: '© 2026 Lifeline Health ehf. All rights reserved.', is_text: '© 2026 Lifeline Health ehf. Öll réttindi áskilin.' },
  { key: 'footer.back_to_top', section: 'footer', context: 'Link', en: 'Back to top', is_text: 'Efst á síðu' },

  // COMMON
  { key: 'common.per_month', section: 'common', context: 'Price suffix', en: '/month', is_text: '/mánuð' },
  { key: 'common.one_time', section: 'common', context: 'Price label', en: 'One-time', is_text: 'Einskiptis' },
  { key: 'common.free', section: 'common', context: 'Price', en: 'Free', is_text: 'Ókeypis' },
  { key: 'common.ideal_for', section: 'common', context: 'Label', en: 'Ideal for:', is_text: 'Hentar fyrir:' },
  { key: 'common.included', section: 'common', context: 'Label', en: 'Included', is_text: 'Innifalið' },
  { key: 'common.not_included', section: 'common', context: 'Label', en: 'Not included', is_text: 'Ekki innifalið' },
  { key: 'common.learn_more', section: 'common', context: 'Link', en: 'Learn more', is_text: 'Fræðast meira' },
  { key: 'common.get_started', section: 'common', context: 'Button', en: 'Get started', is_text: 'Byrja' },
  { key: 'common.book_now', section: 'common', context: 'Button', en: 'Book now', is_text: 'Bóka núna' },
  { key: 'common.coming_soon', section: 'common', context: 'Label', en: 'Coming Soon', is_text: 'Væntanlegt' },
  { key: 'common.coming_soon_desc', section: 'common', context: 'Paragraph', en: 'We\'re building something great. Follow our journey and be the first to know when we launch.', is_text: 'Við erum að smíða eitthvað frábært. Fylgdu ferðalaginu og vertu fyrstur til að vita þegar við opnum.' },
];

(async () => {
  // Login as staff to pass RLS
  const { error: authErr } = await sb.auth.signInWithPassword({
    email: 'madsinski@gmail.com',
    password: process.env.SUPABASE_PASSWORD || process.argv[2] || '',
  });
  if (authErr) {
    console.error('Auth failed:', authErr.message);
    console.log('Usage: node scripts/seed-translations.mjs <password>');
    process.exit(1);
  }
  console.log(`Seeding ${translations.length} translations...`);

  // Upsert in batches
  const BATCH = 20;
  let success = 0;
  let errors = 0;

  for (let i = 0; i < translations.length; i += BATCH) {
    const batch = translations.slice(i, i + BATCH);
    const { error } = await sb.from('translations').upsert(batch, { onConflict: 'key' });
    if (error) {
      console.error(`Batch ${i}-${i + BATCH} failed:`, error.message);
      errors += batch.length;
    } else {
      success += batch.length;
    }
  }

  console.log(`Done: ${success} success, ${errors} errors`);

  // Verify
  const { data } = await sb.from('translations').select('key, is_text').limit(3);
  console.log('Verification:', data?.map(t => `${t.key}: ${t.is_text}`));
})();
