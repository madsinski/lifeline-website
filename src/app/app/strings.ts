// The app's own copy, in both languages.
//
// The site already has i18n (src/lib/i18n.tsx) and this uses its locale, so
// there is one language choice across the whole product and the toggle in
// the app changes the marketing site too. What it does NOT use is that
// system's storage: t() resolves against a `translations` table in Supabase,
// which is right for marketing copy the team edits without a deploy, and
// wrong for app chrome — every label would wait on a network round trip and
// flash its fallback first. These are in code, typed, and reviewed in the
// same diff as the screen that uses them.
//
// Icelandic first because the product is Icelandic first; English is the
// second column, not an afterthought.

export const STRINGS = {
  // ── Navigation ──────────────────────────────────────────────────────
  "nav.home": { is: "Heim", en: "Home" },
  "nav.clinic": { is: "Stofan", en: "Clinic" },
  "nav.health": { is: "Heilsan", en: "Health" },
  "nav.coach": { is: "Þjálfari", en: "Coach" },
  "nav.community": { is: "Samfélag", en: "Community" },

  // ── Greetings ───────────────────────────────────────────────────────
  "hello.night": { is: "Góða nótt", en: "Good night" },
  "hello.morning": { is: "Góðan daginn", en: "Good morning" },
  "hello.day": { is: "Góðan dag", en: "Good afternoon" },
  "hello.evening": { is: "Gott kvöld", en: "Good evening" },

  // ── Home meters ─────────────────────────────────────────────────────
  "home.showingUp": { is: "Mæting", en: "Showing up" },
  "home.showingUp.hint": { is: "síðustu 7 daga", en: "last 7 days" },
  "home.completion": { is: "Klárað", en: "Completion" },
  "home.completion.hint": { is: "af því sem stóð til", en: "of what was planned" },
  "home.intensity": { is: "Ákefð", en: "Intensity" },
  "home.intensity.hint": { is: "hversu fast", en: "how hard" },
  "home.week": { is: "Vikan", en: "This week" },
  "home.failed": { is: "Náði ekki í mælana þína.", en: "Could not load your meters." },
  "home.rest": {
    is: "Næst koma skráning á máltíð og þyngd, það sem er fram undan, og áminningar þjálfarans.",
    en: "Next: meal and weight logging, what's coming up, and your coach's nudges.",
  },

  // ── Screens not built yet ───────────────────────────────────────────
  "clinic.body": {
    is: "Tímabókanir, mælingar, blóðprufur og upplýsingar um stofuna.",
    en: "Appointments, measurements, blood tests and clinic information.",
  },
  "clinic.now": { is: "Bóka tíma", en: "Book a time" },
  "health.body": {
    is: "Mælingarnar þínar yfir tíma: líkamssamsetning, blóðgildi, blóðþrýstingur og þyngd.",
    en: "Your measurements over time: body composition, blood markers, blood pressure and weight.",
  },
  "health.now": { is: "Sjá niðurstöðurnar", en: "See your results" },
  "coach.body": {
    is: "Prógrammið þitt, æfing dagsins og samtalið við þjálfarann.",
    en: "Your programme, today's session, and the conversation with your coach.",
  },
  "coach.now": { is: "Hafa samband", en: "Get in touch" },
  "community.body": {
    is: "Straumur, vinir, viðburðir, áskoranir og Lífstig.",
    en: "Feed, friends, events, challenges and Life Points.",
  },

  // ── Macros ──────────────────────────────────────────────────────────
  "macros.title": { is: "Næring í dag", en: "Nutrition today" },
  "macros.kcal": { is: "hitaeiningar", en: "calories" },
  "macros.protein": { is: "Prótein", en: "Protein" },
  "macros.carbs": { is: "Kolvetni", en: "Carbs" },
  "macros.fat": { is: "Fita", en: "Fat" },
  "macros.left": { is: "eftir", en: "left" },
  "macros.over": { is: "yfir", en: "over" },
  "macros.none": { is: "Ekkert skráð í dag", en: "Nothing logged today" },
  "macros.meals": { is: "máltíðir skráðar", en: "meals logged" },

  // ── Weight ──────────────────────────────────────────────────────────
  "weight.title": { is: "Þyngd", en: "Weight" },
  "weight.none": { is: "Engin þyngd skráð", en: "No weight logged" },
  "weight.since": { is: "frá síðustu mælingu", en: "since last time" },

  // ── Banners (one at most) ───────────────────────────────────────────
  "banner.transition.title": { is: "Næsta þrep er tilbúið", en: "You're ready for the next step" },
  "banner.transition.body": { is: "Núverandi prógrammi er lokið með góðri mætingu.", en: "You've finished your current programme with good attendance." },
  "banner.transition.cta": { is: "Sjá næsta prógramm", en: "See the next programme" },
  "banner.deload.title": { is: "Tími á léttari viku", en: "Time for a lighter week" },
  "banner.deload.body": { is: "Álagið hefur verið hátt. Léttari vika núna skilar meiri framför síðar.", en: "Your load has been high. A lighter week now pays off later." },

  // ── Today's Health / Current insights ───────────────────────────────
  "insights.title": { is: "Staðan núna", en: "Current insights" },
  "insights.fat": { is: "Fituhlutfall", en: "Body fat" },
  "insights.muscle": { is: "Vöðvamassi", en: "Muscle mass" },
  "insights.bmr": { is: "Grunnbrennsla", en: "BMR" },
  "insights.phase": { is: "Fasahorn", en: "Phase angle" },
  "insights.visceral": { is: "Innri kviðfita", en: "Visceral fat" },
  "insights.measured": { is: "Mælt", en: "Measured" },
  "insights.none": { is: "Engin mæling enn. Fyrsta mælingin er grunnlínan þín.", en: "No measurement yet. The first one is your baseline." },
  "insights.book": { is: "Bóka mælingu", en: "Book a measurement" },

  // ── What's coming up ────────────────────────────────────────────────
  "upcoming.title": { is: "Það sem er fram undan", en: "What's coming up" },
  "upcoming.choose-programs": { is: "Veldu prógrömmin þín", en: "Choose your programmes" },
  "upcoming.choose-programs.sub": { is: "Hreyfing, næring, svefn og andleg vellíðan", en: "Exercise, nutrition, sleep and mental wellbeing" },
  "upcoming.questionnaire": { is: "Svaraðu spurningalistanum", en: "Complete the questionnaire" },
  "upcoming.questionnaire.sub": { is: "Þannig verður áætlunin sniðin að þér", en: "This is what makes your plan yours" },
  "upcoming.measurement-appt": { is: "Mælingatími", en: "Measurements appointment" },
  "upcoming.bloodtest-appt": { is: "Blóðprufa", en: "Blood test" },
  "upcoming.coach-consultation": { is: "Samtal við þjálfara", en: "Coach consultation" },
  "upcoming.none": { is: "Ekkert á döfinni.", en: "Nothing coming up." },

  // ── Þjálfari: the day's actions ─────────────────────────────────────
  "coach.today": { is: "Í dag", en: "Today" },
  "coach.none": { is: "Ekkert á dagskrá í dag.", en: "Nothing scheduled today." },
  "coach.noProgram": { is: "Þú ert ekki með prógramm enn.", en: "You don't have a programme yet." },
  "coach.noProgram.cta": { is: "Velja prógramm", en: "Choose a programme" },
  "coach.done": { is: "búið", en: "done" },
  "coach.of": { is: "af", en: "of" },
  "coach.allDone": { is: "Dagurinn er kláraður. Vel gert.", en: "Day complete. Well done." },
  "coach.tooFast": { is: "Aðeins of hratt — reyndu aftur eftir augnablik.", en: "A bit quick — try again in a moment." },
  "coach.wrongDate": { is: "Aðeins er hægt að haka við í dag.", en: "Only today can be ticked off." },
  "coach.failed": { is: "Tókst ekki að vista. Reyndu aftur.", en: "Could not save. Try again." },
  "coach.added": { is: "Bætt við", en: "Added" },
  "coach.min": { is: "mín", en: "min" },

  // Pillars, as the app names them
  "pillar.exercise": { is: "Hreyfing", en: "Exercise" },
  "pillar.nutrition": { is: "Næring", en: "Nutrition" },
  "pillar.sleep": { is: "Svefn", en: "Sleep" },
  "pillar.mental": { is: "Andleg vellíðan", en: "Mental" },

  // Time of day — program_actions.time_group
  "when.morning": { is: "Morgunn", en: "Morning" },
  "when.midday": { is: "Hádegi", en: "Midday" },
  "when.evening": { is: "Kvöld", en: "Evening" },
  "when.anytime": { is: "Hvenær sem er", en: "Anytime" },

  // ── Heilsan ─────────────────────────────────────────────────────────
  "health.scans": { is: "Líkamssamsetning", en: "Body composition" },
  "health.weight": { is: "Þyngd", en: "Weight" },
  "health.blood": { is: "Blóðgildi", en: "Blood markers" },
  "health.noScans": { is: "Engin mæling skráð enn.", en: "No measurement recorded yet." },
  "health.noWeight": { is: "Engin þyngd skráð.", en: "No weight logged." },
  "health.noBlood": { is: "Engin blóðgildi skráð enn. Þau birtast hér eftir blóðprufu.", en: "No blood markers yet. They appear here after a blood test." },
  "health.latest": { is: "Nýjast", en: "Latest" },
  "health.change": { is: "Breyting", en: "Change" },
  "health.measurements": { is: "mælingar", en: "measurements" },
  "health.since": { is: "frá fyrstu mælingu", en: "since the first measurement" },
  "health.source": { is: "Mælt með", en: "Measured with" },

  "metric.weight": { is: "Þyngd", en: "Weight" },
  "metric.bodyFat": { is: "Fituhlutfall", en: "Body fat" },
  "metric.muscleMass": { is: "Vöðvamassi", en: "Muscle mass" },
  "metric.muscleKg": { is: "Vöðvamassi", en: "Muscle mass" },
  "metric.phaseAngle": { is: "Fasahorn", en: "Phase angle" },
  "metric.bmr": { is: "Grunnbrennsla", en: "BMR" },
  "metric.visceral": { is: "Innri kviðfita", en: "Visceral fat" },
  "metric.waist": { is: "Mittismál", en: "Waist" },
  "metric.tbw": { is: "Heildarvatn", en: "Total body water" },

  // ── Stofan ──────────────────────────────────────────────────────────
  "clinic.upcoming": { is: "Næstu tímar", en: "Upcoming" },
  "clinic.past": { is: "Fyrri tímar", en: "Past appointments" },
  "clinic.none": { is: "Enginn tími bókaður.", en: "No appointment booked." },
  "clinic.noPast": { is: "Engir fyrri tímar.", en: "No past appointments." },
  "clinic.book": { is: "Bóka tíma", en: "Book a time" },
  "clinic.join": { is: "Fara í fjarviðtal", en: "Join video call" },
  "clinic.measurement-appt": { is: "Mælingatími", en: "Measurements" },
  "clinic.bloodtest-appt": { is: "Blóðprufa", en: "Blood test" },
  "clinic.coach-consultation": { is: "Samtal við þjálfara", en: "Coach consultation" },
  "clinic.other": { is: "Tími", en: "Appointment" },
  "clinic.status.booked": { is: "Bókað", en: "Booked" },
  "clinic.status.completed": { is: "Lokið", en: "Completed" },
  "clinic.status.cancelled": { is: "Afbókað", en: "Cancelled" },
  "clinic.bodycomp": { is: "Líkamsmælingar", en: "Body composition bookings" },

  // ── Samfélag ────────────────────────────────────────────────────────
  "social.points": { is: "Lífstig", en: "Life points" },
  "social.rank": { is: "sæti", en: "place" },
  "social.unranked": { is: "Ekki á listanum enn", en: "Not ranked yet" },
  "social.badges": { is: "Viðurkenningar", en: "Badges" },
  "social.noBadges": { is: "Engar viðurkenningar enn.", en: "No badges yet." },
  "social.events": { is: "Viðburðir", en: "Events" },
  "social.noEvents": { is: "Engir viðburðir á döfinni.", en: "No events coming up." },
  "social.joined": { is: "Á skrá", en: "Joined" },
  "social.feed": { is: "Straumurinn", en: "Feed" },
  "social.noFeed": { is: "Ekkert í straumnum enn.", en: "Nothing in the feed yet." },
  "social.leaderboard": { is: "Stigalistinn", en: "Leaderboard" },
  "social.you": { is: "Þú", en: "You" },
  "social.free": { is: "Frítt", en: "Free" },

  // ── Þjálfari: outer tabs and pillar tabs ────────────────────────────
  "tab.actions": { is: "Aðgerðir", en: "Actions" },
  "tab.coachChat": { is: "Þjálfari", en: "Coach" },
  "tab.plan": { is: "Áskrift", en: "Plan" },

  // ── Programme picker ────────────────────────────────────────────────
  "prog.title": { is: "Prógrammið", en: "Programme" },
  "prog.current": { is: "Í gangi", en: "Current" },
  "prog.week": { is: "vika", en: "week" },
  "prog.change": { is: "Skipta um prógramm", en: "Change programme" },
  "prog.choose": { is: "Velja", en: "Choose" },
  "prog.none": { is: "Ekkert prógramm valið.", en: "No programme chosen." },
  "prog.switched": { is: "Prógrammið er komið í gang. Vika 1.", en: "Programme started. Week 1." },
  "prog.weeks": { is: "vikur", en: "weeks" },
  "prog.close": { is: "Loka", en: "Close" },

  // ── Education ───────────────────────────────────────────────────────
  "edu.title": { is: "Fræðsla", en: "Education" },
  "edu.none": { is: "Engin fræðsla hér enn.", en: "No education for this pillar yet." },
  "edu.minutes": { is: "mín", en: "min" },
  "edu.modules": { is: "kaflar", en: "modules" },
  "edu.back": { is: "Til baka", en: "Back" },

  // ── Coach chat ──────────────────────────────────────────────────────
  "chat.none": { is: "Engin skilaboð enn.", en: "No messages yet." },
  "chat.noConvo": { is: "Þú ert ekki með opið samtal við þjálfara.", en: "You don't have an open conversation with a coach." },
  "chat.placeholder": { is: "Skrifaðu skilaboð…", en: "Write a message…" },
  "chat.send": { is: "Senda", en: "Send" },
  "chat.sending": { is: "Sendi…", en: "Sending…" },

  // ── Subscription ────────────────────────────────────────────────────
  "sub.title": { is: "Áskriftin þín", en: "Your plan" },
  "sub.none": { is: "Engin áskrift skráð.", en: "No subscription on record." },
  "sub.status": { is: "Staða", en: "Status" },
  "sub.until": { is: "Gildir til", en: "Valid until" },
  "sub.trial": { is: "Prufutími til", en: "Trial until" },

  // ── Heilsan: the four section tabs ──────────────────────────────────
  "hs.insights": { is: "Yfirlit", en: "Insights" },
  "hs.lifestyle": { is: "Lífstíll", en: "Lifestyle" },
  "hs.measure": { is: "Mælingar", en: "Measure" },
  "hs.blood": { is: "Blóð", en: "Blood" },

  "hs.deviceOnly.title": { is: "Þessi gögn eru í símanum þínum", en: "This data lives on your phone" },
  "hs.insights.body": {
    is: "Yfirlitið les daglegar tölur beint úr Apple Health eða Health Connect í símanum. Vafrinn hefur ekki aðgang að þeim og því er þetta aðeins í appinu.",
    en: "Insights reads daily figures straight from Apple Health or Health Connect on your phone. A browser cannot reach those, so this part is in the app only.",
  },
  "hs.lifestyle.body": {
    is: "Lífstílseinkunnin og svörin á bak við hana eru geymd dulkóðuð í símanum og fara hvergi. Það er ásetningur, ekki gloppa.",
    en: "Your lifestyle score and the answers behind it are stored encrypted on your phone and go nowhere else. That is deliberate, not a gap.",
  },
  "hs.inApp": { is: "Opnaðu Lifeline appið til að sjá þetta.", en: "Open the Lifeline app to see this." },

  // ── Samfélag: the six tabs ──────────────────────────────────────────
  "sc.feed": { is: "Straumur", en: "Feed" },
  "sc.people": { is: "Fólk", en: "People" },
  "sc.messages": { is: "Skilaboð", en: "Messages" },
  "sc.events": { is: "Viðburðir", en: "Events" },
  "sc.challenges": { is: "Áskoranir", en: "Challenges" },
  "sc.points": { is: "Lífstig", en: "Life points" },
  "sc.noFriends": { is: "Engir vinir enn.", en: "No friends yet." },
  "sc.noMessages": { is: "Engin skilaboð.", en: "No messages." },
  "sc.pending": { is: "Bíður svars", en: "Pending" },
  "sc.incoming": { is: "Vill tengjast", en: "Wants to connect" },
  "sc.accepted": { is: "Vinur", en: "Friend" },
  "sc.challenges.body": {
    is: "Áskoranirnar eru staðsetningarleikur — tindar, hverir og fossar sem þú skráir þig á þegar þú ert á staðnum. Það þarf GPS símans og því eru þær aðeins í appinu.",
    en: "Challenges are a location game — peaks, hot springs and waterfalls you check in to when you are there. That needs the phone's GPS, so they are in the app only.",
  },

  // ── Stofan: tabs, booking, questionnaire ────────────────────────────
  "st.appointments": { is: "Tímarnir mínir", en: "My appointments" },
  "st.book": { is: "Bóka", en: "Book" },
  "st.quiz": { is: "Spurningalisti", en: "Questionnaire" },

  "bk.type": { is: "Hvers konar samtal?", en: "What kind of consultation?" },
  "bk.coach": { is: "Hvaða þjálfari?", en: "Which coach?" },
  "bk.date": { is: "Dagsetning", en: "Date" },
  "bk.time": { is: "Tími", en: "Time" },
  "bk.confirm": { is: "Staðfesta bókun", en: "Confirm booking" },
  "bk.booking": { is: "Bóka…", en: "Booking…" },
  "bk.done": { is: "Tíminn er bókaður.", en: "Your appointment is booked." },
  "bk.past": { is: "Þessi tími er liðinn.", en: "That time has passed." },
  "bk.duplicate": { is: "Þú ert þegar með tíma á þessum tíma.", en: "You already have an appointment then." },
  "bk.failed": { is: "Bókunin tókst ekki. Reyndu aftur.", en: "Booking failed. Try again." },
  "bk.minutes": { is: "mín", en: "min" },
  "bk.pickAll": { is: "Veldu tegund, dag og tíma.", en: "Choose a type, a day and a time." },

  "qz.intro": {
    is: "Átta spurningar um venjurnar þínar. Svörin móta áætlunina og þú getur breytt þeim hvenær sem er.",
    en: "Eight questions about your habits. The answers shape your plan and you can change them any time.",
  },
  "qz.done": { is: "Öllum spurningum er svarað.", en: "All questions answered." },
  "qz.progress": { is: "svarað", en: "answered" },
  "qz.saveFailed": { is: "Svarið vistaðist ekki.", en: "That answer did not save." },

  // ── Weekdays, short — for the week strip ────────────────────────────
  "day.0": { is: "Su", en: "Sun" },
  "day.1": { is: "Má", en: "Mon" },
  "day.2": { is: "Þr", en: "Tue" },
  "day.3": { is: "Mi", en: "Wed" },
  "day.4": { is: "Fi", en: "Thu" },
  "day.5": { is: "Fö", en: "Fri" },
  "day.6": { is: "La", en: "Sat" },
} as const;

export type StringKey = keyof typeof STRINGS;
