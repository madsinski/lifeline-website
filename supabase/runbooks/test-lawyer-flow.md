# Test the lawyer onboarding + sign-off flow before sending to Ragnar

You want to verify the whole journey end-to-end before inviting a real
external party. Use a Gmail "+ alias" so you can reuse your own inbox
without provisioning a real second account.

## Setup (5 min)

1. **Pick a test email.** Gmail accepts `+anything` aliases:
   - `madsinski+lawyer-test@gmail.com` → all mail still lands in your
     normal inbox; from Lifeline's perspective it's a brand new user.
   - Or use any throwaway you can read.

2. **Open `/admin/team` → Add team member.** Fill in:
   - Name: `Test Lawyer`
   - Email: `madsinski+lawyer-test@gmail.com`
   - Phone: leave blank
   - Role: **External counsel (lawyer)**
   - Employment: **Shareholder (no payment relationship)** (matches what Ragnar will be)
   - Permissions: `view_legal` (auto-set when you pick lawyer role)
   - ✅ Send invite email
   - Click **Add team member**

3. **Verify the staff row was created with aligned ids.** SQL Editor:
   ```sql
   SELECT s.id AS staff_id, u.id AS auth_id, s.id = u.id AS aligned,
          s.role, s.active, s.invited
   FROM public.staff s
   JOIN auth.users u ON u.email = s.email
   WHERE s.email = 'madsinski+lawyer-test@gmail.com';
   ```
   Should return one row with `aligned = true`, `role = 'lawyer'`,
   `active = true`, `invited = true`.

## Run through the lawyer journey (10 min)

4. **Receive the invite email** in your normal Gmail inbox. Click the
   "Sign in" / set-password link.

5. **Set a password** and complete the Supabase auth flow. You'll be
   redirected to `/admin/login`.

6. **Sign in** with the test email + the password you just set.

7. **You should hit `/admin/onboard`** with two pending documents:
   - Trúnaðarsamningur (NDA)
   - Persónuverndarfræðsla (Data protection briefing)

   No clinical confidentiality, no operational checklist, no employment
   contract — confirms the lawyer's narrow doc set.

8. **Sign both documents.** Each generates a PDF certificate stored in
   `staff-acceptance-pdfs/<your-test-uid>/`.

9. **You're redirected to `/admin/legal/drafts`** automatically (lawyer
   landing page).

10. **Sidebar check.** Only "Legal" should be visible. No clients, no
    messages, no scheduling, no business, no settings.

11. **Greeting check.** Top of the dashboard should show a rotating
    lawyer-themed greeting (e.g. "Counsel has entered the chambers,
    Test"). Reload the page a few times — greeting changes each time.

12. **Try the review flow on any document.** E.g. open the
    Privacy Policy section:
    - Type a comment in the textarea
    - Click **Add comment** → status badge flips to "Under review"
    - Reload the page — your comment appears under "History (1)"
    - Click **Approve & sign** → status flips to "Approved by counsel"
    - A signed PDF is generated and stored in `legal-signoff-pdfs/`

13. **Verify isolation.** Try to manually navigate to:
    - `/admin/clients` → should redirect away or show "not authorised"
    - `/admin/messages` → same
    - `/admin/team` → same

    These should all fail / redirect because the sidebar gates were
    bypassed but the underlying RLS still enforces.

14. **Verify in DB that signoffs are recorded:**
    ```sql
    SELECT document_key, document_version, status, comments,
           reviewer_name, signed_at, pdf_storage_path
    FROM public.legal_review_signoffs
    WHERE reviewer_id = (
      SELECT id FROM public.staff WHERE email = 'madsinski+lawyer-test@gmail.com'
    )
    ORDER BY created_at DESC;
    ```

## Cleanup (2 min)

15. **Switch back to your admin account.** Sign out, sign back in as
    mads@lifelinehealth.is.

16. **Delete the test user.** From `/admin/team` → click the three-dots
    menu next to "Test Lawyer" → Delete. This removes the staff row +
    the auth user (existing flow handles both).

17. **Optionally clean up the signoffs:**
    ```sql
    DELETE FROM public.legal_review_signoffs
    WHERE reviewer_name = 'Test Lawyer';
    ```

    And the PDFs in storage:
    ```sql
    DELETE FROM storage.objects
    WHERE bucket_id = 'legal-signoff-pdfs'
      AND name LIKE '<test-staff-uid>/%';
    ```

## What "good" looks like

- ✅ Test user can log in, sees only Legal section.
- ✅ Lawyer-themed greeting rotates on each load.
- ✅ Test user can sign off on any document; status + history + PDF cert all persist.
- ✅ Test user CANNOT access any client / message / staff data.
- ✅ The DB shows `staff.id = auth.users.id` for the test user (aligned).
- ✅ Cleanup removes both the staff row and the auth user.

If any of those fail, reply with the specific symptom and I'll fix
before you send the real invite to Ragnar.

## Then: send Ragnar the real invite

Same flow as above but:
- Email: `ragnar@fosslogmenn.is`
- Name: `Ragnar Björgvinsson`
- Employment: **Shareholder (no payment relationship)**

He'll get the invite email, set his password, sign NDA + Persónuvernd,
and land on the drafts page with the same lawyer experience you just
tested.
