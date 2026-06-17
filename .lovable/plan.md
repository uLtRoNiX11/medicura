
# MediCura — Implementation Plan (with Auth + RLS focus)

A polished healthcare dashboard (deep emerald + slate + soft blue) for uploading medical bills, AI-parsed itemization, cheaper medication alternatives, billing-review emails, pill reminders, and a contextual chatbot. This revision pins down the authentication + RLS layer per the latest request.

## Stack

- **Frontend**: TanStack Start, React 19, Tailwind v4, shadcn/ui, lucide-react, framer-motion, AI Elements for chat.
- **Backend**: Lovable Cloud (Supabase) — Auth, Postgres, Storage.
- **AI**: Lovable AI Gateway (`google/gemini-3-flash-preview`) via AI SDK — multimodal bill parsing + streaming chat with a `get_user_bills` tool.
- **Email**: Resend connector for "Request Line-Item Review".
- **Notifications**: Browser Notifications API for pill reminders.

## Authentication & Onboarding

- Public route `/auth` with a single shadcn Card that toggles between **Log In** and **Create Account** (state-driven, no separate pages). Email + password only — no social providers this round.
- "Forgot password?" link reveals an inline email field; calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/reset-password })`.
- Public route `/reset-password` — reads the recovery token from the URL hash, shows a "Set new password" form, calls `supabase.auth.updateUser({ password })`, then redirects to `/`.
- Successful sign-in / sign-up navigates to `/` (Dashboard). If a `redirect` search param exists from the auth gate, navigate there instead.
- Profile onboarding: first sign-in to `/` checks `profiles.full_name`; if null, render a one-step onboarding card to collect full name + optional insurance provider, then continue.
- "Log out" lives in the sidebar footer. Sign-out hygiene: cancel in-flight queries, clear the React Query cache, call `supabase.auth.signOut()`, then `navigate({ to: "/auth", replace: true })`.

### Route gating

- All app routes live under `src/routes/_authenticated/` — the integration-managed `_authenticated/route.tsx` (`ssr: false`) redirects to `/auth` when there's no session.
- Public-only routes: `/auth`, `/reset-password`.
- `__root.tsx` registers a single `supabase.auth.onAuthStateChange` listener filtered to `SIGNED_IN`/`SIGNED_OUT`/`USER_UPDATED` that invalidates the router and (except on sign-out) invalidates queries.

## Database (single migration)

All tables in `public`, RLS enabled, explicit GRANTs.

### `profiles`
- Columns: `id uuid PK references auth.users(id) on delete cascade`, `email text`, `full_name text`, `insurance_provider text`, `created_at timestamptz default now()`.
- Trigger `handle_new_user` on `auth.users` AFTER INSERT → inserts `(id, email, raw_user_meta_data->>'full_name')` into `profiles`. `SECURITY DEFINER`, `search_path = public`.
- Policies (all `TO authenticated`):
  - SELECT `USING (auth.uid() = id)`
  - UPDATE `USING (auth.uid() = id) WITH CHECK (auth.uid() = id)`
  - INSERT `WITH CHECK (auth.uid() = id)` (covers manual creation if trigger is bypassed)
- Grants: `SELECT, INSERT, UPDATE, DELETE` to `authenticated`; `ALL` to `service_role`. No `anon`.

### `bills`
- Columns: `id uuid PK default gen_random_uuid()`, `user_id uuid NOT NULL references auth.users(id) on delete cascade`, `original_file_url text`, `hospital_name text`, `total_amount numeric(12,2)`, `plain_summary text`, `billing_items jsonb default '[]'::jsonb`, `potential_savings numeric(12,2) default 0`, `created_at timestamptz default now()`.
- Index on `user_id, created_at desc`.
- Policies (`TO authenticated`, all four CRUD verbs):
  - SELECT/UPDATE/DELETE `USING (auth.uid() = user_id)`
  - INSERT `WITH CHECK (auth.uid() = user_id)`
- Grants: authenticated CRUD, service_role ALL.

### `reminders`
- Columns: `id uuid PK`, `user_id uuid NOT NULL references auth.users(id) on delete cascade`, `medication_name text NOT NULL`, `dosage text`, `schedule_time time NOT NULL`, `days_of_week text[] NOT NULL`, `active boolean default true`, `created_at timestamptz default now()`.
- Same four `auth.uid() = user_id` policies + same grants as `bills`.

### `reminder_logs`
- For "today's remaining doses". `user_id` scoped, same RLS pattern.

### `medications` (reference data)
- Public read only. Policy SELECT `USING (true) TO anon, authenticated`. GRANT `SELECT TO anon, authenticated`. Seeded with 5 brand→generic entries.

### Chat tables (`chat_threads`, `chat_messages`)
- `user_id`-scoped with the same four policies as `bills`; `chat_messages` policies join through the thread's `user_id` via a `SECURITY DEFINER` helper to avoid recursion.

### Storage
- Private bucket `bills`. Storage RLS: users may SELECT/INSERT/UPDATE/DELETE only objects under `bills/{auth.uid()}/...`. App always reads via signed URLs.

## Application logic updates

- Browser Supabase client used in components/hooks; every query filters by `user_id = session.user.id` even though RLS enforces it (belt + suspenders, and lets indexes be used).
- Insert payloads (`bills`, `reminders`, `reminder_logs`, `chat_threads`, `chat_messages`) always set `user_id: session.user.id` before `.insert()`.
- Server functions for sensitive ops use `requireSupabaseAuth` middleware; the user's id comes from `context.userId`, never from client input. Examples:
  - `parseBill({ fileUrl })` — calls Gemini, then inserts the parsed bill with `user_id = context.userId`.
  - `sendBillingReviewEmail({ billId, hospitalEmail, userQuestions })` — verifies the bill belongs to the user, then POSTs through the Resend gateway.
  - `createThread`, `appendMessage`, `listThreads` — all scoped to `context.userId`.
- Public routes never call `requireSupabaseAuth` server fns (would 401 during SSR/prerender).

## Sidebar & user display

- Collapsible shadcn Sidebar (Dashboard, Bills, Reminders, Chat, Profile). Footer shows avatar + `profile.full_name || session.user.email` + Log out button.
- `useCurrentProfile` hook reads from React Query (`["profile", userId]`).

## Remaining MediCura scope (unchanged from prior plan)

- Dashboard: metrics cards (total spent, potential savings, active reminders) + bills history grid + floating chatbot widget.
- Bill detail page: itemized table with "MediCura Flag" badges, Medication Optimizer panel cross-referencing `medications`, "Request Line-Item Review" modal that drafts and sends via Resend.
- Reminders: form (med name, dosage, time, day-of-week checkboxes) + today's track + browser notifications scheduler.
- Chat: threaded conversations persisted in Cloud, AI Elements UI, pre-baked prompt chips, `get_user_bills` tool for grounded answers, per-thread URL `/_authenticated/chat/$threadId`.
- Design tokens in `src/styles.css` (oklch); Fraunces (display) + Inter (body) via `@fontsource`.

## Build order

1. Enable Lovable Cloud, ensure `LOVABLE_API_KEY`, connect Resend.
2. Migration: tables, trigger, RLS, grants, seed medications, storage bucket + policies.
3. Auth pages (`/auth`, `/reset-password`), `_authenticated` gate, sidebar shell with user display + logout, onboarding card.
4. Dashboard + bills list + upload → AI parsing server fn → detail page (table + optimizer + email modal).
5. Reminders page + browser notifications.
6. Chat (AI Elements, threads, streaming route, bills tool, floating widget).
7. Polish, SEO meta per route, a11y pass, run security scan.

## Out of scope

- Social OAuth providers (email/password only this round).
- Real-time push notifications when the tab is closed.
- HIPAA-grade auditing.
