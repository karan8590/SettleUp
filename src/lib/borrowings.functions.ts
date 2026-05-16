import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BorrowingWithStats = {
  id: string;
  person_name: string;
  phone_number: string | null;
  borrow_date: string;
  total_borrowed: number;
  notes: string | null;
  created_at: string;
  total_paid: number;
  remaining: number;
  completed: boolean;
};

export const listBorrowings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BorrowingWithStats[]> => {
    const { supabase } = context;
    const { data: borrowings, error } = await supabase
      .from("borrowings")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (borrowings ?? []).map((b) => b.id);
    let sums: Record<string, number> = {};
    if (ids.length) {
      const { data: payments, error: pErr } = await supabase
        .from("payments")
        .select("borrowing_id, amount_paid")
        .in("borrowing_id", ids);
      if (pErr) throw new Error(pErr.message);
      for (const p of payments ?? []) {
        sums[p.borrowing_id] = (sums[p.borrowing_id] ?? 0) + Number(p.amount_paid);
      }
    }

    return (borrowings ?? []).map((b) => {
      const total_paid = sums[b.id] ?? 0;
      const total = Number(b.total_borrowed);
      const remaining = Math.max(total - total_paid, 0);
      return {
        id: b.id,
        person_name: b.person_name,
        phone_number: b.phone_number,
        borrow_date: b.borrow_date,
        total_borrowed: total,
        notes: b.notes,
        created_at: b.created_at,
        total_paid,
        remaining,
        completed: remaining <= 0 && total > 0,
      };
    });
  });

export const createBorrowing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        person_name: z.string().min(1).max(120),
        phone_number: z.string().max(40).optional().nullable(),
        borrow_date: z.string().min(1),
        total_borrowed: z.number().positive().max(1_000_000_000),
        notes: z.string().max(2000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("borrowings")
      .insert({
        user_id: userId,
        person_name: data.person_name,
        phone_number: data.phone_number || null,
        borrow_date: data.borrow_date,
        total_borrowed: data.total_borrowed,
        notes: data.notes || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteBorrowing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("borrowings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        borrowing_id: z.string().uuid(),
        amount_paid: z.number().positive().max(1_000_000_000),
        payment_date: z.string().min(1),
        payment_mode: z.enum(["cash", "online"]),
        payment_note: z.string().max(2000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("payments")
      .insert({
        user_id: userId,
        borrowing_id: data.borrowing_id,
        amount_paid: data.amount_paid,
        payment_date: data.payment_date,
        payment_mode: data.payment_mode,
        payment_note: data.payment_note || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ borrowing_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: payments, error } = await context.supabase
      .from("payments")
      .select("*")
      .eq("borrowing_id", data.borrowing_id)
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return payments ?? [];
  });

export const deletePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("payments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const exportData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: borrowings, error: bErr }, { data: payments, error: pErr }] =
      await Promise.all([
        context.supabase.from("borrowings").select("*"),
        context.supabase.from("payments").select("*"),
      ]);
    if (bErr) throw new Error(bErr.message);
    if (pErr) throw new Error(pErr.message);
    return { borrowings: borrowings ?? [], payments: payments ?? [], exportedAt: new Date().toISOString() };
  });
