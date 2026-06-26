# Phase 1 — Go-Live Checklist (Apply + Match)

Phase 1 adds a public application form that writes tenants into Supabase and
auto-matches them to your available units, shown in the dashboard's
**Applicants** tab. The code is deployed via the branch/PR; these are the
manual steps only you can do (Supabase + Netlify access).

## 1. Create the database tables
Supabase → **SQL Editor** → New query → paste the contents of
[`db/schema.sql`](../db/schema.sql) → **Run**.
You should see `Success. No rows returned.` This creates `applicants`,
`units`, `applications`, `screenings`, etc., all with row-level security on.

> `app_state` (Phase 0) is unaffected — your existing leads/vacancies keep working.

## 2. Add the service-role key to Netlify
This lets the public form insert applicants **without** exposing write access
to the browser (the tables stay locked behind RLS; only this server-side key
can write).

1. Supabase → **Project Settings → API** → copy the **`service_role`** secret.
2. Netlify → **Site settings → Environment variables** → add:
   - `SUPABASE_SERVICE_ROLE_KEY` = *(the service_role key)*
   - *(optional)* `SUPABASE_URL` = your project URL (defaults to the known project if omitted)
3. Redeploy (Netlify → Deploys → Trigger deploy) so the function picks it up.

> ⚠️ The `service_role` key is a master key. Keep it only in Netlify env vars —
> never in the HTML/JS or committed to git.

## 3. Publish your vacancies for matching
In the dashboard → **Vacancies → Publish to cloud**. This copies your current
vacancies into the `units` table so incoming applicants get scored against
them. Re-run it whenever your vacancies change.

## 4. Test the round-trip
1. Visit **ottawarentalplug.com/apply** and submit a test application.
2. You should get a phone alert (ntfy topic `ottawarentalplug`) and the
   success screen should say how many units it matched.
3. Dashboard → **Applicants** → your test applicant appears with a match score.

## Notes
- Matching mirrors the dashboard's lead scoring (beds 40 / budget 30 / timing 20 / profile 10).
- Screening consent (for the future SingleKey step) is captured with a
  timestamp + IP at apply time when the applicant ticks the consent box.
- No raw screening/credit data is ever stored here — that stays with SingleKey
  in Phase 2.
