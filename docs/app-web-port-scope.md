# Porting the Lifeline app to web — scope

Measured from `/home/mads/fhir-health-dashboard` on 2026-10-09, not estimated.
Counts come from the screen/service inventory in that repo.

## Size

| | |
|---|---|
| Screens | 49 |
| Screen code | 41,882 lines |
| Distinct tables touched | 70 |

## By destination tab

The web app's five tabs are the app's own (`src/components/BottomNav.tsx:63-68`;
the second was relabelled Clinic when `HealthAssessmentScreen` folded into
`ClinicInfoScreen`).

| Tab | Screens | Lines | Largest |
|---|---|---|---|
| Heim | 4 | 5,257 | Home, WeeklyPlan, WhatsComingUp, MacrosSetup |
| Stofan | 8 | 3,452 | BodyCompBooking, BookAppointment, BookConsultation, QRScan |
| Heilsan | 9 | 6,834 | MyHealth, BloodPanelEntry, WearableSetup, WellnessPulse |
| Þjálfari | 5 | 7,150 | HealthCoach (4,876 alone), Activity, CoachView, TodayView |
| Samfélag | 11 | 8,522 | Community, EventsTab, LifePointsTab, GeoPointDetail |
| not ported | 12 | 10,667 | Onboarding, Profile, Login, StaffAdmin |

"Not ported" is deliberate: `StaffAdminScreen` and `ClientManagementScreen`
duplicate the website's own admin, and Login/Onboarding already exist here.
That leaves roughly **31,000 lines across 37 screens** of real porting work.

This is weeks, not an afternoon. What follows is the order that makes the app
useful soonest rather than the order that finishes it.

## Order of work

1. **Þjálfari — the daily loop.** Today's actions, and ticking them off.
   Nothing else makes the app worth opening daily, and completions are what
   feed every meter on Heim. Without this the home screen can only ever show
   zeros, which is exactly what it shows today.
2. **Heilsan** — measurements over time; the data is already half-wired by
   Staðan núna on Heim.
3. **Stofan** — appointments and booking.
4. **Samfélag** — feed, events, Lífstig. Largest and least essential daily.

## The part that carries the risk: resolving a day's actions

`getProgramActionsForDay` (api.ts:1691) is not a query, it is a pipeline. Base
rows from `program_actions_resolved` for the programme and week, then five
layers in order:

1. `applyClientSubstitutions` — `client_action_substitutions` + `client_action_dismissals`
2. `applyProgressionNotes` — prepends notes once a cycle is complete; cosmetic
3. `applyClientContraindications` — drops rows whose tags hit the user's injury set. **Safety-relevant.**
4. `applyClientOverrides` — `client_action_overrides`, keyed `lib_key|original_dow`, date-windowed; moves (`new_dow`), edits (`custom_*`), or drops (`is_skipped`)
5. `applyClientAdditions` — `client_added_actions`, date-windowed, library-backed or custom

Then filter to the requested `day_of_week`.

**`day_of_week` is Monday-first.** `api.ts:4927` computes it as
`(new Date().getDay() + 6) % 7`, so 0 = Monday and 6 = Sunday. A naive
`getDay()` shifts every action by a day. Confirmed with Mads 2026-10-09.

## Writing a completion

`toggleActionStatus` (api.ts:2627) upserts `action_completions` on
`(client_id, action_key, date)` and then awards points, checks streaks and
badges, and calls `refresh_user_meters`.

It enforces anti-cheat rules whose own comment says they are "server-enforced
because the client can be modified": today's date only, 3s between toggles,
10s between sub-action ticks, 3 points per action, 100 action-points a day.
In the app they run on the device with the anon key, so they are not in fact
server-enforced. On web they belong in the API route, which is where this port
puts them.
