# Phase 5 — Landlord Client Portal

Landlords get their own login to see their units and applicant status —
`client-portal.html`, separate from your dashboard (`landlord.html`). They see
name + pipeline stage + screening result + the "Approved by Cyril" badge —
**never** an applicant's email or phone. You stay the one point of contact,
same as the "Direct access — always... you call us directly" positioning on
the site.

## Security model (read this first)

Every table's row-level security used to be one blanket rule: *any* logged-in
Supabase user could read/write *everything*. That was safe only because the
only login was you. This phase replaces it with:

- **You (admin)** — matched by login email — keep full read/write on
  everything, exactly as before.
- **A landlord** — matched via `landlords.auth_user_id` — can only read their
  **own** `landlords` row and their **own** `units`. They reach applicant data
  only through a purpose-built view (`landlord_applicant_view`) that excludes
  email/phone.

This was tested end-to-end against a real Postgres instance before shipping:
two landlords, cross-checked that neither can see the other's units, cannot
see applicant data at all until it's their own unit, cannot write anything,
and that the admin login is unaffected.

## 1. Run the migration

Supabase → **SQL Editor** → New query → paste
[`db/phase5-landlord-portal.sql`](../db/phase5-landlord-portal.sql) → **Run**.
Idempotent — safe to re-run. This is the important step: it replaces the old
blanket policy, so do this before inviting any landlord.

> New installs: this is already folded into `db/schema.sql` — nothing extra to run.

## 2. Add a landlord and assign their unit

1. Dashboard → **Landlords** tab → **Client Portal Accounts** → **+ Add Landlord**.
   Name + email is enough (phone optional).
2. Dashboard → **Vacancies** → edit a vacancy → set **Owner (portal access)**
   to that landlord → **Save Vacancy**.
3. Back in **Landlords** → find them in the list → **Invite**. This emails
   them a link to set a password and log in at `/client-portal.html`.

The **Units** column on that list shows how many vacancies are currently
assigned to each landlord, and **Portal** shows Not invited / Invited / Active.

## 3. Netlify env vars

- `SUPABASE_SERVICE_ROLE_KEY` — already set (Phase 1).
- `SUPABASE_PUBLISHABLE_KEY` — already set (Phase 2/3).
- *(optional)* `LANDLORD_PORTAL_URL` — where the invite email link lands.
  Defaults to `https://ottawarentalplug.com/client-portal.html`; only set this
  if the portal moves.

## Notes

- A landlord's applicant data is scoped by **unit**, not by lead source — as
  soon as an applicant is matched (`applications`) to one of their units, they
  show up in that landlord's portal automatically. Unassign a unit from a
  landlord any time by setting its Owner back to "— Unassigned —".
- Re-inviting an already-active landlord just resends the email; it won't
  duplicate their account.
- "Remove" on a landlord account only unassigns their units and revokes portal
  access — it doesn't delete their history.
