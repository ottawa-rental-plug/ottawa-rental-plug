# Phase 3 — Approved (decision + "Approved by Cyril" badge)

Phase 3 turns a screened applicant into a decision. From the dashboard's
**Applicants** tab you run a fixed criteria checklist, approve or decline, and —
on approval — issue the reusable **Approved by Cyril** badge and generate a
one-click **Tenant Summary** PDF to hand to landlords.

No new setup: the `approvals` table already ships in
[`db/schema.sql`](../db/schema.sql), and the decision is written directly under
your signed-in session (no secrets, no Netlify function).

## Flow
1. Once an applicant's screening shows **Completed**, a **Review for approval**
   button appears in the Applicants tab.
2. It opens a modal with the **fixed criteria checklist** (same items for
   everyone) and an optional notes field.
3. **Approve & issue badge** or **Decline**:
   - Approve → writes an `approvals` row (`decision=approved`,
     `badge_issued_at=now`, the ticked criteria, notes, and your email as
     `decided_by`), sets the applicant stage to `approved`, and shows the
     **Approved by Cyril** badge on the row.
   - Decline → records the decision and sets the stage to `declined`.
4. For an approved applicant, **Tenant Summary** opens a clean, printable page
   (Print → Save as PDF) with the applicant, matched unit, screening result, and
   the criteria — ready to send to a landlord. **Re-review** re-opens the modal
   (pre-ticked from the last decision) if anything changes.

## The fixed criteria
Defined once in `landlord.html` (`APPROVAL_CRITERIA`) and applied to every
applicant:
- Identity verified (government photo ID)
- Income / employment verified
- Rental history & references checked
- Screening completed with an acceptable result
- Application complete (required fields & documents)
- First & last month's deposit confirmed

Edit that list to change the checklist for everyone; each approval stores the
exact set that was ticked, so past decisions stay auditable.

## Compliance (built in)
- **Consistency.** The same objective criteria are shown for every applicant
  (Ontario Human Rights Code). The modal spells out the protected grounds that
  must **not** factor into a decision (race, ancestry, place of origin, colour,
  ethnic origin, citizenship, creed, sex, sexual orientation, gender
  identity/expression, age, marital or family status, disability, or receipt of
  public assistance).
- **The badge is not a guarantee.** Both the modal and the Tenant Summary state
  the badge reflects a consistent screening process, not a guarantee of tenancy.
- **Data minimization.** The Tenant Summary includes only the screening *result
  summary* — never the raw credit/background report, which stays with SingleKey.
- **Auditability.** Every decision records who decided, when, the criteria
  ticked, and any notes.
