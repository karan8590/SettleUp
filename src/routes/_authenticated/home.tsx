import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBorrowings, type BorrowingWithStats } from "@/lib/borrowings.functions";
import { BorrowingCard } from "@/components/borrowing-card";
import { AddBorrowingDialog } from "@/components/add-borrowing-dialog";
import { PaymentDialog } from "@/components/payment-dialog";
import { HistorySheet } from "@/components/history-sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Wallet } from "lucide-react";
import { formatINR } from "@/lib/format";
import { motion, AnimatePresence } from "framer-motion";
import { vibrate, HAPTIC_PATTERNS } from "@/lib/haptics";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

function debounce<T extends (...args: any[]) => void>(fn: T, delay = 300): T {
  let timer: any = null;
  return ((...args: any[]) => {
    if (timer) return;
    fn(...args);
    timer = setTimeout(() => {
      timer = null;
    }, delay);
  }) as any;
}

function HomePage() {
  const list = useServerFn(listBorrowings);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["borrowings"], queryFn: () => list() });

  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<BorrowingWithStats | null>(null);
  const [histTarget, setHistTarget] = useState<BorrowingWithStats | null>(null);

  const handleAddOpen = useRef(debounce(() => setAddOpen(true), 300)).current;

  const active = useMemo(() => (data ?? []).filter((b) => !b.completed), [data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return active;
    return active.filter(
      (b) => b.person_name.toLowerCase().includes(q) || (b.phone_number ?? "").toLowerCase().includes(q),
    );
  }, [active, query]);

  const handleSettleComplete = (id: string) => {
    qc.setQueryData<BorrowingWithStats[]>(["borrowings"], (old) => {
      return (old ?? []).map((b) =>
        b.id === id ? { ...b, completed: true } : b
      );
    });
  };

  const totals = useMemo(() => {
    const all = data ?? [];
    return {
      borrowed: all.reduce((s, b) => s + b.total_borrowed, 0),
      paid: all.reduce((s, b) => s + b.total_paid, 0),
      remaining: all.reduce((s, b) => s + b.remaining, 0),
    };
  }, [data]);

  return (
    <>
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
        <div className="px-4 md:px-8 pt-[calc(0.875rem+env(safe-area-inset-top))] pb-3.5 flex items-center gap-2 md:gap-3 max-w-6xl mx-auto w-full">
          <div className="md:hidden h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
            <Wallet className="h-4 w-4" />
          </div>
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => vibrate(HAPTIC_PATTERNS.SEARCH_BAR_FOCUS)}
              placeholder="Search name or phone…"
              className="pl-9 h-10 rounded-xl bg-muted/60 border-transparent focus-visible:bg-card focus:shadow-[0_0_0_3px_rgba(0,0,0,0.1)] transition-all duration-200"
            />
          </div>
          <Button
            onClick={() => {
              vibrate(HAPTIC_PATTERNS.BUTTON_TAP);
              handleAddOpen();
            }}
            className="h-9 rounded-[10px] shrink-0"
          >
            <Plus className="h-4 w-4 md:mr-1" />
            <span className="hidden md:inline">Add</span>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="px-4 md:px-8 py-5 max-w-6xl mx-auto w-full">
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Active borrowings</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-12 text-center">Loading…</p>
          ) : filtered.length === 0 ? (
            <EmptyState onAdd={handleAddOpen} hasQuery={!!query} hasAny={active.length > 0} />
          ) : (
            <motion.div
              variants={{ show: { transition: { staggerChildren: 0.025 } } }}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              <AnimatePresence mode="popLayout">
                {filtered.map((b, index) => (
                  <motion.div
                    key={b.id}
                    layout="position"
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                  >
                    <BorrowingCard
                      b={b}
                      index={index}
                      onPay={setPayTarget}
                      onHistory={setHistTarget}
                      onSettleComplete={handleSettleComplete}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </section>
      </main>

      <AddBorrowingDialog open={addOpen} onOpenChange={setAddOpen} />
      <PaymentDialog borrowing={payTarget} open={!!payTarget} onOpenChange={(v) => !v && setPayTarget(null)} />
      <HistorySheet borrowing={histTarget} open={!!histTarget} onOpenChange={(v) => !v && setHistTarget(null)} />
    </>
  );
}

function SummaryCard({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className={`rounded-2xl border p-3 md:p-4 ${tint}`}>
      <p className="text-[10px] md:text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-base md:text-xl font-semibold mt-1 tabular-nums truncate">{value}</p>
    </div>
  );
}

function EmptyState({ onAdd, hasQuery, hasAny }: { onAdd: () => void; hasQuery: boolean; hasAny: boolean }) {
  if (hasQuery) {
    return <p className="text-sm text-muted-foreground py-12 text-center">No matches.</p>;
  }
  return (
    <div className="rounded-2xl border border-dashed border-border py-16 px-6 text-center">
      <div className="h-12 w-12 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-3">
        <Wallet className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="font-medium">{hasAny ? "All caught up" : "Nothing here yet"}</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-5">
        {hasAny ? "Every borrowing is paid off." : "Add your first borrowing to get started."}
      </p>
      {!hasAny && <Button onClick={onAdd} className="rounded-xl"><Plus className="h-4 w-4 mr-1" />Add borrowing</Button>}
    </div>
  );
}
