# PropPilot Take-Home — Mini Inbox

A multi-tenant lead inbox for real estate agencies. Public contact forms feed into agent dashboards in realtime, with database-level isolation between agencies.

**Live demo:** _TBD — link after deploy_
**Demo accounts:** _TBD — see bottom of README_

## Stack

- Vite + React + TypeScript
- Supabase (Postgres, Auth, Realtime, RLS)
- Tailwind CSS v4
- React Router v6
- Deployed on Vercel

## Run locally

_TBD — fill in at the end_

## Design notes

### RLS for two audiences

The `contacts` table receives traffic from two distinct roles: the
`anon` role (public form submitters) and the `authenticated` role
(agency agents). I modelled each one separately, table by table,
action by action.

**Anonymous role**
- `agencies`: SELECT allowed (used to resolve `:agencySlug → id`;
  slugs and names are public anyway).
- `profiles`: no access. Anonymous visitors have no business knowing
  agency staffing.
- `contacts`: INSERT only, with `WITH CHECK` validating that the
  target `agency_id` references a real agency. **Crucially, no
  SELECT** — even the contact a visitor just submitted, they cannot
  read back. RLS denies it silently (returns 0 rows, not an error),
  which is the right shape for a security boundary: an attacker
  can't tell whether they're filtered out or whether the table is
  empty.

**Authenticated role (agents)**
- `agencies`: SELECT allowed (so the dashboard can show agency name).
- `profiles`: SELECT, restricted to their own row via
  `id = (select auth.uid())`. Agents see their own agency_id and
  nothing else.
- `contacts`: SELECT and UPDATE, scoped by a subquery into `profiles`:
  `agency_id = (select agency_id from profiles where id = (select auth.uid()))`.
  This is the multi-tenant boundary. The UPDATE policy also has a
  matching `WITH CHECK` clause preventing an agent from re-parenting
  a contact to another agency.

I wrapped `auth.uid()` in a scalar subquery (`(select auth.uid())`)
per Supabase's RLS performance guide — it lets Postgres cache the
auth lookup once per query instead of evaluating it per row.

The profile-creation flow uses a Postgres trigger
(`on_auth_user_created`) instead of a client-side insert after
signup. That makes profile creation atomic with auth user creation
— they happen in the same transaction or neither happens. No race,
no orphaned auth users.

### Avoiding duplicates between initial fetch and realtime
_TBD — Phase 4_

### What I left out and why
_TBD — final pass_

### Where AI helped, and where it got me into trouble
_TBD — final pass_

## Decisions worth flagging

- **Supabase region:** Mumbai (`ap-south-1`) — closest to the UAE-based reviewer for lowest realtime latency.
- _More TBD as we build_