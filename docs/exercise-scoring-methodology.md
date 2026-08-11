# Exercise Behaviour Scoring — Evidence-Based Redesign

**Author:** Prepared for Lifeline Health (CTO review)
**Date:** 2026-07-17
**Scope:** The "Hreyfing → Venjur" (exercise habits) score in the Grunnheilsa report. Three self-reported categories: **Zone 2 (moderate aerobic)**, **High-intensity (vigorous)**, **Strength**. 0–10 scale, with optimal / normal / unhealthy bands and an age-adjustment multiplier.

> **Compliance note.** This is a *behaviour* score (measures and tracks activity vs. evidence-based reference ranges). It does not diagnose, treat, or prevent disease, and must not be worded as if it does. All mortality/health associations below are population-level and observational — see §7.

---

## 1. Why clients say the current system is too strict

Reverse-engineering the current thresholds from the report's own green ("optimal") recommendations:

| Category | Current "optimal" bar |
|---|---|
| Zone 2 (létt þolþjálfun) | 3–5×/week |
| High-intensity (erfið þolþjálfun) | 3–5×/week |
| Strength (styrktarþjálfun) | 2–4×/week |

Hitting all three simultaneously is **8–14 sessions/week — a competitive-athlete load.** The core defect: the bar for "good" is set at the point of *diminishing returns*, so a person who **fully meets WHO guidelines** — already ~30–40% of the achievable all-cause mortality reduction — scores "Sæmilegt," not "Gott."

**The single most important fix: meeting WHO guidelines should score ≈ 8/10 (Gott), not 5/10.** The athlete zone becomes 9–10 with a *flat top* (a plateau — see §2), not the entry bar for "good."

Six specific faults, all corrected below:
1. Optimal set at athlete volume, not the evidence-based benefit plateau.
2. No substitution between modalities (a dedicated runner still fails the Zone-2 bucket).
3. Frequency-only — ignores session duration, when the evidence is *dose* (MET-minutes).
4. No age adjustment.
5. Hard tier cliffs instead of a continuous dose-response curve.
6. No plateau — more volume always scores higher, which is untrue (strength benefit *attenuates* at high volume) and an unhealthy message.

---

## 2. The evidence the scoring is anchored to

Full citations in §8. Key quantitative anchors:

- **Guidelines (WHO 2020 / US 2018):** adults 150–300 min/wk moderate **OR** 75–150 min/wk vigorous **OR** equivalent, **plus** muscle-strengthening (all major groups) **2+ days/wk**. Vigorous:moderate ≈ **2:1**. "1× guideline" ≈ **500 MET-min/wk**. Ages 65+ get the *same* aerobic + strength targets **plus** balance/multicomponent 3+ days/wk.
- **Aerobic dose-response (Arem 2015, N=661k):** all-cause mortality HR vs. inactive — below guideline **0.80**, 1× **0.69**, 2–3× **0.63**, **3–5× → 0.61 (nadir/plateau)**, 5–10× 0.61, 10×+ 0.69. **Benefit plateaus at 3–5× the guideline; steepest gains are at the very bottom of the curve (some ≫ none).**
- **Vigorous proportion adds benefit (Gebel 2015, N=204k):** among the active, doing **≥30% of activity at vigorous intensity → additional HR 0.87** (13% lower), independent of total volume.
- **Strength dose-response (Momma 2022, 16 cohorts):** **J-shaped**; maximal all-cause mortality reduction (**RR 0.83, ~17%**) at **~30–60 min/wk**; benefit **attenuates above ~130–140 min/wk**. Strength + aerobic combined → **40% lower all-cause mortality**.
- **Fitness has no ceiling (Mandsager 2018, N=122k):** cardiorespiratory fitness is inversely related to mortality with **no upper limit** (elite vs. low HR 0.20). This is why *intensity/fitness* is rewarded even past the *volume* plateau.
- **Capacity declines with age (FRIEND registry):** median VO₂max falls **~10%/decade** after ~30. This is the basis of the age multiplier (§5).

---

## 3. The 0–10 band structure

Keep the report's existing three labels; add an explicit "Optimal" zone at the top of "Gott":

| Score | Band | Icelandic label | Meaning |
|---|---|---|---|
| 9.0–10 | **Optimal** | Gott (kjörsvið) | At/above the benefit plateau. *More is not scored higher.* |
| 7.5–9.0 | **Good** | Gott | Meets guidelines. Most of the achievable benefit. |
| 5.0–7.5 | **Adequate / normal** | Sæmilegt | Partial — some benefit, clear room to improve. |
| 2.5–5.0 | **Low** | Ábótavant | Well below guideline; front-loaded gains available. |
| 0–2.5 | **Inactive / unhealthy** | Ábótavant | Essentially sedentary; highest-risk band. |

---

## 4. Per-category scoring curves

Inputs are **self-reported minutes/week** (preferred) — if the app only collects sessions, multiply by an assumed session length (default 30 min Zone 2, 25 min high-intensity, 30 min strength) and label it an estimate. All curves are **piecewise-linear** (interpolate within each row's range) — no cliffs.

### 4a. Zone 2 (moderate aerobic) — minutes/week

| min/wk | Score | Band |
|---|---|---|
| 0 | 0 | Inactive |
| 1–29 | 0 → 2.5 | Unhealthy |
| 30–74 | 2.5 → 5.0 | Low |
| 75–149 | 5.0 → 7.5 | Adequate |
| 150–239 | 7.5 → 9.0 | Good |
| 240+ | 9.0 → 10 (cap at 300) | Optimal |

*150 min/wk = full WHO moderate floor = entry to "Good."*

### 4b. High-intensity (vigorous) — minutes/week *(reference age 20–29; scale by §5)*

| min/wk | Score | Band |
|---|---|---|
| 0 | 0 | — (bonus layer; see composite) |
| 1–9 | 0 → 2.5 | Minimal |
| 10–24 | 2.5 → 5.0 | Low |
| 25–44 | 5.0 → 7.5 | Adequate |
| 45–74 | 7.5 → 9.0 | Good |
| 75–150 | 9.0 → 10 (cap) | Optimal |
| >150 | 10 + recovery flag | — |

*75 min/wk vigorous alone = full WHO aerobic guideline. Above 150 min, flag recovery rather than reward.*

### 4c. Strength — minutes/week **and** days/week (take the lower-implied)

| Condition | Score | Band |
|---|---|---|
| 0 | 0 | Inactive |
| >0–19 min, irregular | 2.5 → 5.0 | Low |
| ~20–29 min **and** ≥1 day | 5.0 → 7.5 | Adequate |
| ≥30 min **and** ≥2 days | 7.5 → 9.0 | Good |
| 40–150 min **and** 2–3 days | 9.0 → 10 | Optimal |
| >150 min/wk | 10 + gentle note | (benefit attenuates) |

*"Good" requires **≥2 days** (WHO) regardless of total minutes, so 60 min in one session ≠ 2×30. Strength targets are **not** relaxed by age — sarcopenia makes strength *more* important with age (§5).*

---

## 5. Age adjustment (the multiplier)

**Purpose:** a 65-year-old and a 25-year-old doing the same *relative* effort perform different *absolute* work, because median VO₂max falls ~10%/decade (FRIEND). If the app collects **absolute** self-reported activity, older adults should reach the same score with less absolute volume — exactly your example (65 y.o. at 8/10 doing less than a 25 y.o. at 8/10).

**Mechanism:** multiply the **aerobic** minute/MET-min thresholds by an **Age Adjustment Factor (AAF)** = median VO₂max at that age ÷ median VO₂max at 20–29 (sex-specific, FRIEND). Lower AAF → lower thresholds → same activity scores higher.

| Age band | AAF — men | AAF — women |
|---|---|---|
| 20–29 | 1.00 | 1.00 |
| 30–39 | 0.88 | 0.80 |
| 40–49 | 0.79 | 0.71 |
| 50–59 | 0.68 | 0.62 |
| 60–69 | 0.59 | 0.53 |
| 70–79 | 0.51 | 0.49 |

`adjusted_threshold(age) = base_threshold × AAF(age, sex)`

**Example — Zone 2 "Good" entry (base 150 min/wk):**
- 25 y.o. man → 150 × 1.00 = **150 min/wk**
- 48 y.o. man → 150 × 0.79 = **~119 min/wk**
- 65 y.o. man → 150 × 0.59 = **~89 min/wk**

So a 65-year-old reaches "Good" (≈8/10) at ~89 min of *his* moderate activity — less absolute volume than the 25-year-old's 150 min, for the same score. ✔️

**Two important rules:**
1. **Apply AAF to aerobic categories only (Zone 2 + high-intensity). Do NOT relax strength for age** — hold strength targets constant across adult ages (evidence favours preserving muscle with age, not lowering the bar).
2. **Only apply AAF if inputs are absolute** (e.g. "I walk 120 min/week"). If the questionnaire already asks in *relative* terms ("days you were active enough to breathe harder / RPE"), age fairness is already handled and AAF should be off — otherwise you double-count it.

---

## 6. Combining into the composite (fixes the "no substitution" fault)

Don't average three athlete-bars. Convert aerobic work to a common currency, let Zone 2 and high-intensity **substitute**, then combine with strength.

**Step 1 — Aerobic dose (relative MET-minutes):**
```
aerobic_METmin = zone2_min × 3.5  +  highIntensity_min × 7.0
```
(3.5 / 7.0 METs → the standard 2:1 vigorous:moderate ratio; 150 Zone-2 ≈ 75 vigorous ≈ 500 MET-min = 1× guideline.)

**Step 2 — Aerobic score** (age-adjust the MET-min by ÷AAF if inputs are absolute):

| MET-min/wk | Aerobic score |
|---|---|
| 0 | 0 |
| 250 (½×) | 5.0 |
| 500 (1× guideline) | 7.5 |
| 1000 (2×) | 8.75 |
| 1500–2400 (3–5×, plateau) | 9.5 → 10 |
| >2400 | 10 (cap) |

**Step 3 — Vigorous-distribution bonus (Gebel 2015):** if ≥30% of aerobic MET-min is vigorous, **+0.5** to the aerobic score (then cap at 10). Rewards intensity *without requiring it*.

**Step 4 — Composite:**
```
exercise_composite = 0.60 × aerobic_score  +  0.40 × strength_score
```
(Aerobic carries more weight — its mortality signal is larger; strength adds a strong, independent 40% combined benefit, so it is not a minor term.)

Display the **three category scores** (Zone 2, High-intensity, Strength) for coaching, and the **composite** as the headline "Hreyfing → Venjur" number.

### Worked example — a guideline-meeter (the person the old system failed)
150 min brisk walking (Zone 2) + 0 vigorous + 2 × 40 min strength, age 45 M:
- Zone 2: 150 min → **7.5**; High-intensity: 0 → 0
- Aerobic MET-min = 150×3.5 = 525 → **~7.6**; no vigorous bonus
- Strength: 80 min, 2 days → **~8.7**
- **Composite = 0.60×7.6 + 0.40×8.7 = 8.0 → "Gott"** ✔️

Under the old system this person scored ~5 ("Sæmilegt"). Same behaviour, now correctly "Good."

### Worked example — Þorvaldur (48 M, illustrative inputs ~90/20/30 min)
- Aerobic MET-min = 90×3.5 + 20×7 = 455 → ~7.2; vigorous share 31% → +0.5 → **7.7**
- Strength 30 min, 1 day → **~6.0**
- **Composite ≈ 0.60×7.7 + 0.40×6.0 ≈ 7.0 ("Sæmilegt", upper end)** — vs. 5.0 today. He's genuinely close to meeting guidelines, and the score now says so.

---

## 7. Evidence-quality caveats (read before publishing claims)

- **All mortality dose-response evidence is observational** (prospective cohorts), not RCT. Healthy-adherer and reverse-causation bias inflate the hazard ratios. Word associations as "is associated with," never "causes" or "prevents."
- **Zone 2 has no direct mortality evidence.** Its case is mechanistic (mitochondrial/fat-oxidation) and indirect via cardiorespiratory fitness. A 2025 review ("Much Ado About Zone 2") actively contests the claim that Zone 2 is *superior* for fitness gains. **Keep Zone 2 as the aerobic volume base; do not market it as "optimal" over other intensities.** The three-pillar "balanced mix" model is well-supported overall — the balance itself, not Zone 2 specifically, is the evidence-backed message.
- **Strength "reversal" above ~140 min/wk is weakly supported** (sparse data, wide CIs). Model it as a *plateau* (no added score), not a penalty.
- **Age multiplier uses median VO₂max as a capacity proxy.** It is a reasonable, transparent normalization — not a validated scoring instrument. State that it adjusts for age-related capacity, and keep the method visible/auditable.

---

## 8. References

1. **Bull FC, Al-Ansari SS, Biddle S, et al.** WHO 2020 guidelines on physical activity and sedentary behaviour. *Br J Sports Med.* 2020;54(24):1451–1462. https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/
2. **Piercy KL, Troiano RP, Ballard RM, et al.** The Physical Activity Guidelines for Americans (2nd ed.). *JAMA.* 2018;320(19):2020–2028. https://pubmed.ncbi.nlm.nih.gov/30418471/
3. **Arem H, Moore SC, Patel A, et al.** Leisure Time Physical Activity and Mortality: A Detailed Pooled Analysis of the Dose-Response Relationship. *JAMA Intern Med.* 2015;175(6):959–967. https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/2212267
4. **Wen CP, Wai JPM, Tsai MK, et al.** Minimum amount of physical activity for reduced mortality and extended life expectancy. *Lancet.* 2011;378(9798):1244–1253. https://pubmed.ncbi.nlm.nih.gov/21846575/
5. **Gebel K, Ding D, Chey T, et al.** Effect of Moderate to Vigorous Physical Activity on All-Cause Mortality in Middle-aged and Older Australians. *JAMA Intern Med.* 2015;175(6):970–977. https://jamanetwork.com/journals/jamainternalmedicine/fullarticle/2212268
6. **Momma H, Kawakami R, Honda T, Sawada SS.** Muscle-strengthening activities and lower risk/mortality in major non-communicable diseases: systematic review and meta-analysis. *Br J Sports Med.* 2022;56(13):755–763. https://pubmed.ncbi.nlm.nih.gov/35228201/
7. **Mandsager K, Harb S, Cremer P, et al.** Association of Cardiorespiratory Fitness With Long-term Mortality Among Adults Undergoing Exercise Treadmill Testing. *JAMA Netw Open.* 2018;1(6):e183605. https://pmc.ncbi.nlm.nih.gov/articles/PMC6324439/
8. **Kaminsky LA, Arena R, Myers J, et al.** Reference Standards for Cardiorespiratory Fitness (FRIEND Registry). *Mayo Clin Proc.* 2015;90(11):1515–1523. https://pmc.ncbi.nlm.nih.gov/articles/PMC4919021/
9. Vigorous physical activity volume and mortality — dose-response meta-analysis, 2025. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12145088/
10. "Much Ado About Zone 2" narrative review, 2025 (contests Zone-2 superiority). https://pubmed.ncbi.nlm.nih.gov/40560504/

---

## 9. Other calibration issues spotted in the report (out of scope, worth a pass)

The over-strictness is not unique to exercise. Several genuinely healthy values are flagged "Sæmilegt": fasting glucose **5.0 mmol/L**, HbA1c **35 mmol/mol (≈5.3%)**, triglycerides **1.0**, total cholesterol **4.0**, and **17% body fat for a 48-year-old man**. The same "recalibrate so healthy = Good" principle applies. Also a **rendering bug**: priority icons show as mojibake (`=4`, `=á`, `=â`) instead of emoji/arrows throughout the PDF.
