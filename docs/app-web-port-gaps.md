# What the web port is still missing

Audited 2026-10-09 against `/home/mads/fhir-health-dashboard`, after Mads
pointed out that the sub-tabs were missing. The first pass built the top
level of each of the five tabs and nothing beneath it. This is what is
beneath it.

`App.tsx`'s `Screen` union has **42 routes**. Five are partly built.

## Þjálfari (HealthCoachScreen, 4,876 lines)

Three outer tabs (`HealthCoachScreen.tsx:1748`), not one:

| | state |
|---|---|
| **Actions** → Today | built |
| **Actions** → Exercise, Nutrition, Sleep, Mental | **missing** — four pillar tabs |
| **Coach** | **missing** — messaging (17 conversations, 2 peer_messages) |
| **Plan** | **missing** — subscription tier (17 subscriptions) |

Inside each pillar tab, collapsed into it so "everything about one pillar
lives in one place" (its own comment):

- **Programs** — pick and change the programme for that pillar, with a day
  wheel, a programme drawer, and a Gym/Home toggle for exercise
- **Education** — `education_courses` (20 rows). Lessons are not a table;
  they live in the `modules` jsonb on the course. Three view states:
  list → course → lesson
- The combined **Day · Program · Mode** card, and the multi-pick mix card on
  the exercise pillar

## Heilsan (MyHealthScreen, 2,987 lines)

Four section tabs (`MyHealthScreen.tsx:1570`):

| | state |
|---|---|
| **Insights** — the daily wearable stream, the default tab | **missing** |
| **Lifestyle** — Lífstílseinkunn, the proprietary behavioural score, 5 pillars | **missing** |
| **Measure** — body comp + vital signs | partly built |
| **Blood** — markers with tri-band reference bars and unit toggles | stub (health_records is empty) |

## Samfélag (CommunityScreen + 6 tab files, 8,522 lines)

`src/screens/community/`: FeedTab, PeopleTab, MessagesTab, EventsTab,
ChallengesTab, LifePointsTab. Feed, Events and LifePoints are partly built
as one read-only page; People, Messages and Challenges are missing, and all
of them are missing their writes (join an event, add a friend, send a
message).

## Stofan

Only the appointment list is built. Missing: the clinic info content itself,
BookAppointment, BookConsultation, BodyCompBooking, Questionnaire (+
QuestionnaireComplete), QRScan.

## Whole screens not started

HealthReport, BloodTestResults, Activity, Profile, Settings, WearableSetup,
MacrosSetup, HealthLog, BodyCompEntry, BloodPanelEntry, BloodPressureEntry,
WellnessPulse, WeeklyPlan, Subscription, WhatsComingUp, Peaks, HotSprings,
Waterfalls, GeoPointDetail, ChallengesMap, RegionalMaster.

The geo set (Peaks, HotSprings, Waterfalls, GeoPointDetail, ChallengesMap,
RegionalMaster) is location check-in — it needs device GPS, so it is the one
group where the web port will not match the app.

## Order

1. Pillar tabs with their Programs section — this is the training module, and
   it is what makes Þjálfari more than a checklist
2. Education — 20 courses already sitting in the database, unread
3. Coach messaging, then Plan
4. Heilsan's Lifestyle and Insights tabs
5. Samfélag's People / Messages / Challenges, and the writes
