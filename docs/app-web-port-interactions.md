# Missing interactions — sheets, dropdowns, popups, buttons

Audited 2026-10-09 after Mads asked for the detail level: "we are missing
the dropdowns with further info on the results and measurements… Also the
accountability partner system is missing, see if there are other things like
this missing."

He is right on both. The port has the screens; it does not yet have the
things that open *out* of them. The app has **26 sheet / modal / picker
components** and none were built.

## 1. The expandable metric row — the dropdown he means

`MyHealthScreen.tsx:78-115` defines what a row opens into. Every measurement
and blood marker is a tappable row with a chevron, and the expanded view can
carry:

| field | what it shows |
|---|---|
| `description` | plain English: what this test actually measures |
| `info` | `{ title, why, target, tip }` |
| `ranges` | green / amber / red reference ranges |
| `vitalsBreakdown` | multi-component vitals (e.g. blood pressure) each with a value, a category pill, and a horizontal band bar |
| `pillarBreakdown` | the lifestyle score's five pillars as 0–10 bars |
| `unitOptions` + `onSelectUnit` | per-marker unit toggle; storage stays canonical, this is rendering only |
| `trend`, `trendLabel`, `lowerIsBetter` | direction, and which direction is good |
| `action` | one CTA per row |

**The data for this already exists on the website.** `hc_knowledge` has 61
active rows carrying `summary`, `body_md`, `bands`, `higher_better`,
`improves`, `worsens` and `components`, and `loadReport` already returns it
as `reference` keyed by report item. Nothing needs importing — the report
rows simply never offered a way to open.

## 2. The accountability partner

Stored on `clients`: `accountability_partner_id`,
`accountability_partner_name`, `accountability_partner_score`. Set from
`PeopleTab.tsx:285` by picking a friend and confirming, surfaced again on
Home. Missing from the web entirely.

## 3. Every sheet, modal and picker — none built

Largest first, with the tab each belongs to.

**Þjálfari (the programme)**
- `ActionOverrideSheet` (622) — edit, move or skip one action. This is the write side of the override layer the resolver already reads.
- `WorkoutAdaptSheet` (619) — adapt today's session
- `AddActionSheet` (463) — add an action to a day (`client_added_actions`)
- `SwapActionSheet` (255) — swap for an alternative from the swap pool
- `NotForMeSheet` (190) — dismiss an action with a reason (`client_action_dismissals`)
- `QuickSessionSheet` (305) — a short session instead of the prescribed one
- `RPEPromptSheet` (114) — asks perceived intensity right after an exercise is ticked; feeds `perceived_intensity` on the completion
- `DayPickerDropdown` (171), `WheelPicker` (119)
- `TrainingProfileSheet` (464), `ExerciseProfileSheet` (237), `HomeEquipmentSheet` (238)

**Heim / logging**
- `LogMealSheet` (457) — the write behind the macros ring
- `WeightLogModal` (157) — the write behind the weight card
- `LogHealthEntrySheet` (117) — one sheet listing every way to log a measurement

**Heilsan**
- `BloodPanelManagerSheet` (151), `HealthInfoEditorSheet` (312)
- `ConfirmExtractionSheet` (121) — review AI-extracted values before they are saved

**Samfélag**
- `PublicProfileModal` (96), `CheckinSuccessModal` (316), `GeoPointEditSheet` (384), `LocationPicker` (480)

**Onboarding / chrome**
- `AppTourModal` (166), `BetaWelcomeModal` (523), `HealthCoachChatSheet` (357)

## Order

1. Expandable rows on the report and measurements — named, and the data is already loaded
2. Accountability partner — small, and it is the social hook
3. The three log sheets (meal, weight, health entry) — these are the daily writes; without them Heim can only ever display
4. `RPEPromptSheet`, then the action sheets (override / add / swap / not-for-me), which are the write side of the resolver
