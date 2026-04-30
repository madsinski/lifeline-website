# Data Subject Rights — Internal Runbook

When a user submits a request via `/account` → Data & privacy, an email
arrives at `pv@lifelinehealth.is` with their auth.user id, email, and
the type of request. Use this runbook to fulfill each type within the
30-day GDPR window.

## Decide who fulfills

- **Lifeline-side data only** (operational data in Supabase) → DPO
  fulfills directly.
- **Health record data** (anything in Medalia / sjúkraskrá) →
  coordinate with Medalia per the GDPR Art. 26 joint-controller
  arrangement (`processor-agreements.ts` →
  `renderMedaliaJointControllerArrangement`).

## By request type

### 1. Access (Art. 15)

Produce a single bundle containing the user's data from every
Lifeline-controlled source. Use the service-role key.

```sql
-- Run in SQL Editor with the user's auth.uid as :uid
SELECT * FROM clients              WHERE id = :uid;
SELECT * FROM client_programs      WHERE client_id = :uid;
SELECT * FROM action_completions   WHERE client_id = :uid;
SELECT * FROM weight_log           WHERE client_id = :uid;
SELECT * FROM body_comp_bookings   WHERE client_id = :uid;
SELECT * FROM blood_test_bookings  WHERE client_id = :uid;
SELECT * FROM macro_targets        WHERE client_id = :uid;
SELECT * FROM client_consents      WHERE client_id = :uid;
SELECT * FROM conversations        WHERE client_id = :uid;
SELECT * FROM messages WHERE conversation_id IN (
  SELECT id FROM conversations WHERE client_id = :uid
);
SELECT * FROM payments             WHERE owner_type = 'client' AND owner_id = :uid;
SELECT * FROM refund_requests      WHERE client_id = :uid;
SELECT * FROM appointments         WHERE client_id = :uid;
SELECT * FROM checkin_log          WHERE client_id = :uid;
SELECT * FROM event_checkins       WHERE client_id = :uid;
SELECT * FROM audit_log WHERE actor_id = :uid OR row_id = :uid::text;
```

Export each as CSV/JSON. Bundle into a zip. Email to the user from a
Resend address signed with our DKIM. Note in the email that the
clinical record is in Medalia and how to request that side.

### 2. Rectification (Art. 16)

Validate the corrected value with the user (a typo? a name change? a
new address?). Update via the admin UI when possible; SQL when not.
Record the change in `audit_log` (auto-fires) and reply with what was
changed.

### 3. Erasure (Art. 17)

1. Confirm the user understands which data is in scope (Lifeline) and
   which is in Medalia (separate retention rules under Lög 55/2009).
2. Trigger the deletion edge function with their `userId`. It now
   covers all health-adjacent tables (Sprint 1.9).
3. Coordinate with Medalia for sjúkraskrá redaction where lawful.
4. Reply to the user when both sides are complete.

### 4. Restriction (Art. 18)

Add a row to `client_consents` with `granted = false` for the relevant
processing keys. Update RLS scope for that user if needed (rare).

### 5. Portability (Art. 20)

Same as access (1) but emit JSON-LD or another structured, machine-
readable format. CSV is acceptable when no obvious machine-readable
target exists.

### 6. Objection (Art. 21)

Stop processing for the named purpose unless we can demonstrate
compelling legitimate grounds. Most common: marketing emails — flip
`subscriptions` / `email_preferences` flags.

### 7. Withdraw consent (Art. 7(3))

Find the active row in `client_consents` with the relevant
`consent_key` and set `revoked_at = now()`. For the Biody-import
consent, also tombstone any cached rows in `weight_log`,
`body_comp_events`, and `clients.{weight_kg, body_fat_pct, muscle_mass_pct}`
(the values remain in Medalia / Biody as the source of truth).

## Response template (use as Resend reply)

> Hi [name],
>
> We've completed your request of [date]. [Summarise what was done.]
>
> If anything is missing or you'd like to discuss further, reply to
> this email.
>
> — Lifeline Health
> Data Protection Officer

## SLAs

- Acknowledge within 72 hours of receipt.
- Resolve within 30 days. If complex, extend by 60 more (notify the
  user) per Art. 12(3).

## Audit trail

Every action you take should leave a row in `audit_log`. The triggers
on health tables fire automatically; for actions outside those tables
(e.g. Resend email, Medalia coordination notes), use the
`log_health_access(action, table, row_id, metadata)` SECURITY DEFINER
helper to record context.
