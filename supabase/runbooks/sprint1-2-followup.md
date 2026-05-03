# Sprint 1 + 2 — Outside-of-code follow-up

The audit and code/SQL work shipped 2026-04-30. Eight follow-up items
remain that aren't code. Each section below has concrete step-by-step
instructions, who's involved, what to send, and what done looks like.

---

## 1. Counsel review of the legal templates

**Why:** Three Icelandic legal documents were drafted in
`src/lib/processor-agreements.ts` (Medalia joint-controller, Biody DPA,
DPIA-lite). They're solid first drafts but should be reviewed by an
Icelandic lawyer with privacy / healthcare expertise before signing.

**Step by step:**

1. **Render each document to PDF.**
   In a Node REPL or scratch file:
   ```ts
   import {
     renderMedaliaJointControllerArrangement,
     renderBiodyDPA,
     renderDPIAInterim,
   } from "@/lib/processor-agreements";

   console.log(renderMedaliaJointControllerArrangement());
   // copy → save as Medalia-Joint-Controller-v1.0.pdf
   console.log(renderBiodyDPA());
   // copy → save as Biody-DPA-v1.0.pdf
   console.log(renderDPIAInterim());
   // copy → save as DPIA-Interim-v1.0.pdf
   ```
   Or simpler: copy the text from the source file directly.

2. **Send to counsel** with this brief:
   > These are drafts produced by an external compliance audit of
   > Lifeline Health, in support of operating the app as a wellness-mode
   > tool while clinical records remain in Medalia (sjúkraskrá per Lög
   > 55/2009). Please review for:
   > 1. Lawful basis sufficiency (GDPR Art. 9(2)(a) and (h))
   > 2. Joint-controller arrangement (Art. 26) — adequate division of
   >    responsibilities with Medalia
   > 3. Processor obligations (Art. 28) for Biody — specifically
   >    sub-processor handling and transfer mechanism
   > 4. Anything missing for Persónuvernd defensibility
   > 5. Whether the DPIA mitigations are credible
   >
   > Lifeline operates under heilbrigðisleyfi from Embætti landlæknis
   > under Lög nr. 40/2007 and routes formal sjúkraskrá to Medalia.

3. **Fill the [TBD] placeholders** (Medalia ehf. kt. + heimilisfang in
   the joint-controller doc). Get these from Medalia directly.

4. **Bump the version** in `processor-agreements.ts` (`v1.0` → `v1.1`)
   if counsel changes anything substantial. The text hash changes
   too, so prior signatures wouldn't apply.

**Done when:** counsel returns approved text, placeholders are filled,
and any changes are merged with version bumps.

---

## 2. Sign the Medalia joint-controller arrangement

**Why:** GDPR Art. 26 requires a joint-controller arrangement to be
written, signed, and have its essence available to data subjects.
Without this on file, the joint-controller language in `/privacy` and
the platform terms is unsupported.

**Step by step:**

1. Final text from #1 → render to PDF with both signature lines
   (Lifeline + Medalia).
2. Lifeline side: sign first (you, as founder). Use rafræn skilríki
   via Auðkenni Signing if Medalia accepts it — strongest evidence.
3. Send to Medalia counterparty for counter-signature.
4. Receive signed PDF back.
5. **Upload to `company_documents`:**
   ```sql
   -- Get Medalia's company_id first; if Medalia isn't a row in the
   -- companies table, this is internal — store under the Lifeline
   -- entity row. Or create a "Lifeline internal docs" pseudo-company.
   INSERT INTO public.company_documents (
     company_id, kind, title, filename, storage_path, content_type,
     size_bytes, signer_name, signed_at, uploaded_by
   ) VALUES (
     '<lifeline-entity-company-id>',
     'joint_controller',
     'Medalia Joint-Controller Arrangement v1.0',
     'Medalia-Joint-Controller-v1.0.pdf',
     'company-docs/<uuid>/Medalia-Joint-Controller-v1.0.pdf',
     'application/pdf',
     <size>,
     '<your name>',
     '<signed-iso-timestamp>',
     auth.uid()
   );
   ```
   First upload the PDF to the `company-docs` private bucket; then
   insert the row pointing at it.

6. **Publish "essence" on `/privacy`** — at least one paragraph
   summarising responsibility split (Lifeline collects + interprets;
   Medalia stores + audits). Already partially present in `/privacy`
   §6a, expand if counsel recommends.

**Done when:** signed PDF is in the bucket, the row exists in
`company_documents`, and `/privacy` references the arrangement clearly.

---

## 3. Sign the Biody DPA

**Why:** GDPR Art. 28 requires a written DPA with every processor of
personal data. Biody Manager (Aminogram SAS) processes Art. 9 health
data on Lifeline's behalf — this is non-optional.

**Step by step:**

1. Final text from #1 → PDF.
2. Sign Lifeline side.
3. Send to Aminogram SAS contact (sales / legal) for counter-signature.
4. **Receive list of their sub-processors** (5.1 in the DPA) — they
   should provide this in writing. File alongside the DPA.
5. **Upload signed DPA to `company_documents`:**
   ```sql
   INSERT INTO public.company_documents (
     company_id, kind, title, filename, storage_path, content_type,
     size_bytes, signer_name, signed_at, uploaded_by
   ) VALUES (
     '<lifeline-entity-company-id>',
     'dpa',
     'Biody Manager DPA v1.0',
     'Biody-DPA-v1.0.pdf',
     'company-docs/<uuid>/Biody-DPA-v1.0.pdf',
     'application/pdf',
     <size>,
     '<your name>',
     '<signed-iso-timestamp>',
     auth.uid()
   );
   ```

**Done when:** signed PDF + sub-processor list are in `company_documents`.

---

## 4. DPO signs the DPIA-lite

**Why:** Lög 90/2018 §29 / GDPR Art. 35 require a Data Protection
Impact Assessment for large-scale Art. 9 processing. The DPIA must be
dated, signed by the persónuverndarfulltrúi, and retained.

**Step by step:**

1. Render the DPIA text from `renderDPIAInterim()`.
2. Decide who is your **DPO**. Options:
   - Yourself (founder, with self-declared DPO role) — cheapest, fine
     for a small org but conflict-of-interest risk.
   - External DPO consultant (~50-150k ISK/month for a small SaaS).
   - Hire fractional DPO (search "GDPR ráðgjöf" on LinkedIn IS).
3. DPO reviews + signs the DPIA. Fill in section 6 (signature, date,
   next review date — set to 12 months out).
4. **Upload to `company_documents`** with `kind='dpia'`.
5. **Set a calendar reminder** for the next review date.

**Done when:** signed DPIA is in `company_documents` and a calendar
reminder is set for the next review.

---

## 5. (Optional) Set the DPO_EMAIL env var

**Why:** Privacy request emails default to `contact@lifelinehealth.is`
as of 2026-05-03. If you eventually provision a dedicated mailbox
(e.g. `personuvernd@lifelinehealth.is`), point requests there.

**Step by step:**

1. Provision the mailbox in your email host.
2. Add the env var:
   ```bash
   vercel env add DPO_EMAIL production
   # When prompted, paste: personuvernd@lifelinehealth.is
   vercel env add DPO_EMAIL preview
   ```
3. Trigger a redeploy (or wait for the next push).
4. Submit a test DSR; confirm it lands in the new mailbox.

**Done when:** test DSR delivers to the new address. Skip entirely if
you're happy with `contact@`.

---

## 6. Backfill Biody-import consent for existing users

**Why:** The `client_consents` table is new. Users who had their Biody
data already mirrored into the app pre-2026-04-30 have no recorded
consent for that processing — a legal vulnerability.

**Step by step:**

1. **Find affected users:**
   ```sql
   SELECT id, email, full_name, biody_uuid, biody_patient_id
   FROM public.clients
   WHERE biody_uuid IS NOT NULL OR biody_patient_id IS NOT NULL
   ORDER BY created_at;
   ```

2. **Decide policy.** Two defensible options:
   - **Re-consent prompt:** on next login, force-show the Biody consent
     toggle and require a tick. Cleanest but adds friction.
   - **Grandfathered note:** insert a `client_consents` row with
     `consent_key='biody-import-v1-grandfathered'` for each user,
     marked as accepted-on-prior-onboarding-tos. Less rigorous but
     pragmatic for a small user base. **Note:** this is weaker than
     fresh explicit consent — disclose to your DPO and counsel.

3. **For the re-consent path** (recommended):
   - In `/account` settings, the toggle defaults to off; users see
     it and decide. No backfill needed; users opt back in if they want.
   - If you want to actively prompt, add a one-time banner on
     `/account` overview for users with `biody_uuid IS NOT NULL` AND
     no row in `client_consents` for `biody-import-v1`.

4. **For the grandfathered path:**
   ```sql
   INSERT INTO public.client_consents
     (client_id, consent_key, consent_version, text_hash, granted, metadata)
   SELECT
     id,
     'biody-import-v1-grandfathered',
     'v1.0',
     '00000000000000000000000000000000',  -- placeholder hash; document this
     true,
     jsonb_build_object('reason', 'pre-existing user, consent inferred from prior TOS acceptance')
   FROM public.clients
   WHERE (biody_uuid IS NOT NULL OR biody_patient_id IS NOT NULL)
     AND id NOT IN (
       SELECT client_id FROM public.client_consents WHERE consent_key LIKE 'biody-import-v1%'
     );
   ```

**Done when:** every existing Biody-mirrored user either has an active
consent row or has been notified to re-consent on next login.

---

## 7. Schedule the first quarterly staff access review

**Why:** Sprint 2.4 introduced the `staff_access_reviews` table.
The whole point is that someone actually does the review every 90
days. Without a calendar trigger, it won't happen.

**Step by step:**

1. **Pick the cadence:** 1st of every quarter (Jan/Apr/Jul/Oct) is
   easiest to remember. First review by **2026-08-01**.

2. **Create a recurring calendar event** (Google Calendar, Apple
   Calendar, whatever you use):
   - Title: "Lifeline staff access review (90-day)"
   - Recurrence: every 3 months
   - Duration: 30 minutes
   - Attendees: you + (eventually) the DPO

3. **Process to follow each time:**
   ```sql
   -- See current staff and their permissions
   SELECT id, email, role, active, permissions, created_at
   FROM public.staff
   ORDER BY active DESC, created_at;
   ```
   For each active staff member, decide: keep / adjust permissions /
   change role / deactivate.

4. **Record each decision:**
   ```sql
   INSERT INTO public.staff_access_reviews
     (reviewed_staff_id, reviewer_id, decision, notes,
      before_role, after_role, before_permissions, after_permissions)
   VALUES
     ('<staff_id>', auth.uid(), 'keep', 'Still in role, access appropriate.',
      'coach', 'coach', NULL, NULL);
   ```
   For deactivations / role changes, also UPDATE `public.staff`.

5. **Spot-check the audit log** while you're there:
   ```sql
   SELECT actor_email, action, table_name, count(*)
   FROM public.health_audit_log
   WHERE occurred_at > now() - interval '90 days'
   GROUP BY 1, 2, 3
   ORDER BY count DESC LIMIT 50;
   ```
   Investigate any unusual patterns (single staff member with disproportionate
   reads, off-hours access, etc.).

**Done when:** calendar event is recurring and the first review is on
the calendar.

---

## 8. Encryption rollout (Sprint 1.1)

**Why:** Currently weight, body fat, message content, etc. are
plaintext at rest. Supabase encrypts at the storage layer (good), but
column-level encryption removes the entire database from the breach
blast radius for Art. 9 fields.

**This is genuinely multi-day work** that needs a maintenance window.
The full step-by-step is in
`supabase/migration-sprint1-encryption-runbook.sql` (intentionally
all-comments). Do **not** paste-and-run — naive execution corrupts
production data.

**Step-by-step kick-off (when you're ready):**

1. **Confirm backups are restorable.** Pick a recent nightly pg_dump
   (the cron from `2826e30` runs nightly to Supabase Storage),
   restore it to a temporary Supabase project, and verify it works.
   This is a hard prerequisite.

2. **Schedule a maintenance window.** 1-2 hours, off-peak.

3. **Pick one column to start with** (e.g. `clients.weight_kg`). Don't
   try to encrypt everything in one go.

4. **Follow the runbook steps 1-7 for that one column.** Each step is
   independently reversible up to step 7 (column drop). Stop at any
   point if anything looks wrong.

5. **Validate end-to-end** for a day before tackling the next column:
   read paths through the decrypted view work, write path goes
   through the trigger, performance is acceptable.

6. **Repeat for each column** in the priority order:
   - clients.weight_kg, body_fat_pct, muscle_mass_pct, height_cm
   - weight_log columns
   - messages.content
   - free-text notes/reason fields

**Done when:** every column listed in the runbook reads through a
decrypted view and the plaintext column is dropped.

**Owner:** Backend lead + DevOps + DPO. This is not a one-person job.

---

## Order of execution (suggested)

1. **#5 (env var)** — 1 min, optional. Skip if `contact@` is fine.
2. **#7 (calendar reminder)** — 5 min. Just set the recurring event.
3. **#1 (counsel review)** — 1-3 weeks elapsed time, mostly waiting.
   Send the brief today; let counsel work in parallel.
4. **#6 (Biody backfill)** — 30 min once you decide policy. Do this
   while waiting for counsel.
5. **#4 (DPO sign DPIA)** — depends on #1. If you self-DPO, do it
   directly after #1.
6. **#2 + #3 (sign Medalia + Biody)** — depends on #1 + counterparties.
   Likely 2-4 weeks elapsed.
7. **#8 (encryption rollout)** — schedule for after the above settle.
   This is the highest-effort, lowest-urgency item.
