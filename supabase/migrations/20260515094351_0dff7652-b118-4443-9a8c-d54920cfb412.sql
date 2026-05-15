
create table public.borrowings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person_name text not null,
  phone_number text,
  borrow_date date not null default current_date,
  total_borrowed numeric(14,2) not null check (total_borrowed >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create index borrowings_user_id_idx on public.borrowings(user_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  borrowing_id uuid not null references public.borrowings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_paid numeric(14,2) not null check (amount_paid > 0),
  payment_date date not null default current_date,
  payment_note text,
  created_at timestamptz not null default now()
);

create index payments_borrowing_id_idx on public.payments(borrowing_id);
create index payments_user_id_idx on public.payments(user_id);

alter table public.borrowings enable row level security;
alter table public.payments enable row level security;

create policy "borrowings_select_own" on public.borrowings for select using (auth.uid() = user_id);
create policy "borrowings_insert_own" on public.borrowings for insert with check (auth.uid() = user_id);
create policy "borrowings_update_own" on public.borrowings for update using (auth.uid() = user_id);
create policy "borrowings_delete_own" on public.borrowings for delete using (auth.uid() = user_id);

create policy "payments_select_own" on public.payments for select using (auth.uid() = user_id);
create policy "payments_insert_own" on public.payments for insert with check (auth.uid() = user_id);
create policy "payments_update_own" on public.payments for update using (auth.uid() = user_id);
create policy "payments_delete_own" on public.payments for delete using (auth.uid() = user_id);
