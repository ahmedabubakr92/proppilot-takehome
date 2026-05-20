# PropPilot Take-Home — Mini Inbox

Multi-tenant inbox where real estate agencies receive contacts from a public form. Anyone can submit; only the right agency's agents can see them.

**Live demo:** https://proppilot-takehome.vercel.app

**Demo accounts** (both password `DemoPass123!`):

- `agent.marina@proppilot-demo.com` — Marina Heights Real Estate
- `agent.palm@proppilot-demo.com` — Palm Horizon Properties

To verify multi-tenant isolation, log in as one, note the contacts, sign out, log in as the other. Public forms at `/c/marina-heights-real-estate` and `/c/palm-horizon-properties`.

## Stack

- Vite + React + TypeScript
- Tailwind v4
- React Router v6
- Supabase (Postgres, Auth, Realtime, RLS)
- Deployed on Vercel

Picked the Mumbai region for Supabase — closest to the UAE, lower realtime latency.

## Run locally

```bash
git clone https://github.com/ahmedabubakr92/proppilot-takehome.git
cd proppilot-takehome
npm install
```

Create `.env.local` with your Supabase project's URL and anon key:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

Then:

```bash
npm run dev
```

You'll need a Supabase project with the same schema, RLS policies, GRANTs, trigger, and realtime publication. The deployed app at the demo URL is the canonical reference, and the two demo accounts above are the cleanest way to verify isolation.

## How RLS works here

Two audiences hit the `contacts` table: anonymous form submitters and authenticated agents. I wrote separate policies for each.

The anonymous role can only insert. The insert policy has a `WITH CHECK` that confirms the `agency_id` references a real agency. They can't read anything — not even contacts they just submitted. If anon tries to `select * from contacts`, RLS returns an empty array, not an error. That's the right shape for a security boundary; an attacker can't tell the difference between "empty table" and "filtered out."

The authenticated role can read and update, but only rows where `agency_id` matches their own agency. I look that up with a subquery into the `profiles` table: `agency_id = (select agency_id from profiles where id = (select auth.uid()))`. The update policy uses the same condition as `WITH CHECK` too, so an agent can't reassign a contact to another agency.

I wrapped `auth.uid()` in `(select ...)` everywhere — Supabase's RLS performance guide says this lets Postgres cache the value once per query instead of evaluating it per row.

## GRANTs vs RLS

Spent a while debugging "Agency not found" before I realised newer Supabase projects don't auto-grant SELECT/INSERT permissions to `anon` and `authenticated`. RLS policies were correct, but queries were failing at the GRANT layer before RLS even ran (Postgres error 42501).

Two separate layers: GRANT decides if the role can touch the table at all, RLS decides which rows it sees. Both have to be set up.

## Profile creation

A Postgres trigger on `auth.users` creates a matching `profiles` row when a new user is created, reading `agency_id` from the signup metadata. Both rows get created in the same transaction, or neither — doing it client-side after signup would be racy.

For the two demo accounts I created auth users via the Supabase dashboard (no metadata) and inserted profile rows directly afterwards. The trigger is null-safe so it doesn't reject signups without metadata. The metadata pattern is the right shape for a real invite-based signup flow; the dashboard + manual profile insert was the simpler path for seeding demo accounts.

## Avoiding duplicates between initial fetch and realtime

The classic dedup problem: if you fetch on mount and then subscribe to realtime, there's a window where a row could be missed (subscription not ready yet) or duplicated (event fires for a row already in the initial fetch). Time-based or "subscribe first, buffer events, then fetch, then merge" approaches work but add complexity.

I store contacts in a `Map<id, contact>` instead of an array. The initial fetch loops `map.set(row.id, row)`; realtime INSERT and UPDATE handlers do the same. Setting the same id twice overwrites with the same data — no duplicates, no race conditions, idempotent by construction. The rendered list is derived from `Array.from(map.values()).sort(...)` via `useMemo`.

Worth noting: Supabase Realtime respects RLS. Agents only receive events for rows their SELECT policy lets them see. So even though `contacts` is published to the realtime channel globally, an agent at Agency A never receives an event for a contact submitted to Agency B. The multi-tenant boundary holds across realtime, not just queries — verified end-to-end with two browsers.

## What I left out and why

- **Public agent signup.** The trigger reads `agency_id` from signup metadata, which fits an invite-based flow, but I didn't build the invite UI. Out of scope.
- **Rate limiting / captcha on the public form.** A real product would need both to prevent spam and abuse. Skipped.
- **Pagination on the inbox.** Loads all contacts for the agency at once. Fine at this scope; a real PropPilot would need cursor pagination once an agency has a few thousand leads. The `(agency_id, created_at desc)` composite index on `contacts` is in place for it.
- **Filtering / search.** Spec said don't add extra features. Held the line.
- **Tests.** No unit or integration tests. The database-level constraints (RLS, FK, NOT NULL) are doing most of the validation. In a real codebase I'd at minimum write an RLS test suite, because RLS failures are silent — empty arrays, not errors — and easy to miss in manual testing.

## Where AI helped, and where it bit me

Used Claude throughout, mostly as a pair-programmer to talk through design decisions.

Where it helped:

- Reasoning about the RLS shape — two audiences, table by table, action by action. I knew what I wanted; it knew the syntax.
- The dedup pattern using a Map instead of arrays. I'd have probably hand-rolled a "subscribe-then-fetch-then-merge" version that's harder to reason about.
- Pointing out that I needed both GRANTs and RLS as separate layers, not just RLS.

Where it bit me:

- Confidently told me Supabase's API gateway auto-handles GRANTs in newer projects. Wrong. Cost about 20 minutes until I noticed the actual `42501` error in the browser console.
- Suggested `auth.admin_create_user()` for seeding demo users — doesn't exist as a callable function in Supabase's hosted Postgres. Caught the error, fell back to dashboard UI + manual profile insert.
- First version of the profile-creation trigger crashed when I created users via the dashboard (no metadata, `NOT NULL` on `agency_id`). Had to make it null-safe.
- During the realtime refactor, edits introduced calls to `setContacts` after the underlying state had been renamed to `setContactsById`. Caught it before running, but a good reminder that AI-suggested edits to existing files need careful diff review.

The habit that worked: trust the console error more than the AI's reasoning. When something didn't work, the actual error code told me exactly what was wrong; the AI's prior explanation was sometimes off.
