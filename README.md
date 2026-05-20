# PropPilot Take-Home — Mini Inbox

Multi-tenant inbox where real estate agencies receive contacts from a public form. Anyone can submit; only the right agency's agents can see them.

**Live demo:** _TBD_
**Demo accounts:** _TBD_

## Stack

- Vite + React + TypeScript
- Tailwind v4
- React Router v6
- Supabase (Postgres, Auth, Realtime, RLS)
- Deployed on Vercel

Picked the Mumbai region for Supabase — closest to the UAE, lower realtime latency.

## Run locally

_TBD — at the end_

## How RLS works here

Two audiences hit the `contacts` table: anonymous form submitters and authenticated agents. I wrote separate policies for each.

The anonymous role can only insert. The insert policy has a `WITH CHECK` that confirms the `agency_id` references a real agency. They can't read anything — not even contacts they just submitted. If anon tries to `select * from contacts`, RLS returns an empty array, not an error. That's the right shape for a security boundary; an attacker can't tell the difference between "empty table" and "filtered out."

The authenticated role can read and update, but only rows where `agency_id` matches their own agency. I look that up with a subquery into the `profiles` table: `agency_id = (select agency_id from profiles where id = (select auth.uid()))`. The update policy uses the same condition as `WITH CHECK` too, so an agent can't reassign a contact to another agency.

I wrapped `auth.uid()` in `(select ...)` everywhere — Supabase's RLS performance guide says this lets Postgres cache the value once per query instead of evaluating it per row.

## GRANTs vs RLS 

Spent a while debugging "Agency not found" before I realised newer Supabase projects don't auto-grant SELECT/INSERT permissions to `anon` and `authenticated`. RLS policies were correct, but queries were failing at the GRANT layer before RLS even ran (Postgres error 42501).

Two separate layers: GRANT decides if the role can touch the table at all, RLS decides which rows it sees. Both have to be set up.

## Profile creation

When a new auth user signs up, a Postgres trigger on `auth.users` creates a matching `profiles` row in the same transaction, reading the `agency_id` from the signup metadata. Either both rows are created or neither — doing it client-side after signup would be racy.

In a real product you'd want an invitation flow so people can't just sign up as any agency. Out of scope here.

## Avoiding duplicates between initial fetch and realtime

_TBD — Phase 4_

## What I left out and why

_TBD — final pass_

## Where AI helped, and where it bit me

_TBD — final pass_