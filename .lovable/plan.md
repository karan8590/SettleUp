
# Borrowing Management App — Plan

A clean, light-themed app to track money lent to people and installment repayments. Mobile-first with bottom nav, desktop-friendly with sidebar. Currency: ₹ INR. Backend: Lovable Cloud (auth + database).

## Scope

- Email/password + Google sign-in (Lovable Cloud).
- Per-user data (RLS-scoped to `auth.uid()`).
- Pages: Home (active borrowings), Completed, Settings, Login.
- Flows: Add borrowing, record payment (prefilled to remaining), view history.
- Real-time search by name/phone.

## Backend (Lovable Cloud)

Tables (with RLS — owner-only access):

**borrowings**
- id (uuid, pk)
- user_id (uuid, fk → auth.users, default auth.uid())
- person_name (text)
- phone_number (text, nullable)
- borrow_date (date)
- total_borrowed (numeric)
- notes (text, nullable)
- created_at (timestamptz)

**payments**
- id (uuid, pk)
- borrowing_id (uuid, fk → borrowings, on delete cascade)
- user_id (uuid, fk → auth.users, default auth.uid())
- amount_paid (numeric)
- payment_date (date)
- payment_note (text, nullable)
- created_at (timestamptz)

Computed in queries: `total_paid = sum(payments.amount_paid)`, `remaining = total_borrowed - total_paid`, `completed = remaining <= 0`.

RLS: each table — `user_id = auth.uid()` for select/insert/update/delete.

## Frontend Routes (TanStack Start)

```
src/routes/
  __root.tsx               (providers, auth listener, layout shell)
  index.tsx                (redirects to /home or /login)
  login.tsx                (email + Google)
  _authenticated.tsx       (auth guard, sidebar/bottom-nav layout)
  _authenticated/home.tsx       (active borrowings)
  _authenticated/completed.tsx  (completed borrowings)
  _authenticated/settings.tsx   (export, about)
```

## Components

- `AppShell` — sidebar (desktop) + bottom nav (mobile), sticky header (logo, search, Add).
- `SummaryCards` — Total Borrowed / Total Paid / Remaining (soft tinted cards).
- `BorrowingCard` — name, phone, date, amounts, progress bar, % paid, Pay + History buttons. Soft orange tint when pending, soft green + completed badge when done.
- `AddBorrowingDialog` — Dialog (desktop) / Sheet bottom (mobile), form via react-hook-form + zod.
- `PaymentDialog` — same responsive pattern; amount prefilled to remaining, editable; updates progress on save.
- `HistorySheet` — summary at top, chronological payment timeline.
- `SearchBar` — sticky, real-time filter on name/phone.
- `EmptyState` — friendly empty state for no borrowings.

Responsive: `useIsMobile` hook to swap Dialog ↔ Sheet. Grid: 1 col mobile / 2 col md / 3 col xl.

## Design System (src/styles.css)

Light theme only. Soft neutral palette:
- background: off-white
- card: white with subtle border + soft shadow
- primary: deep neutral (slate-900-ish)
- success: soft green tint for completed cards
- warning: soft amber tint for pending cards
- Rounded-xl, thin borders, generous spacing.
- Typography: clean sans (Inter), clear hierarchy.
- Animations: subtle progress-bar transition, fade for modals — nothing flashy.

## Data Layer

- TanStack Query for fetching/caching.
- Server functions (`createServerFn` + `requireSupabaseAuth`) for:
  - `listBorrowings({ status: 'active' | 'completed' })` — joins payment sums
  - `createBorrowing(input)`
  - `recordPayment({ borrowingId, amount, date, note })`
  - `listPayments(borrowingId)`
  - `getSummary()` — totals across user's borrowings
  - `exportData()` — JSON download
- On payment save: invalidate borrowing + summary queries → progress bar animates to new value.

## Settings

- Export data (JSON download via server function).
- About / version.
- Sign out.

## Out of scope (per spec)

No charts, no interest calculations, no invoices, no analytics dashboards, no dark mode.

## Order of implementation

1. Enable Lovable Cloud, create tables + RLS.
2. Auth: login page, `_authenticated` guard, root auth listener.
3. Design tokens in styles.css.
4. App shell (sidebar + bottom nav + header).
5. Home: server fns, summary cards, borrowing cards, search.
6. Add borrowing flow.
7. Payment flow (with prefill logic).
8. History sheet.
9. Completed page + Settings page.
10. Polish: empty states, transitions, responsive QA.
