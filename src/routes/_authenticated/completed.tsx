import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBorrowings, type BorrowingWithStats } from "@/lib/borrowings.functions";
import { BorrowingCard } from "@/components/borrowing-card";
import { HistorySheet } from "@/components/history-sheet";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/completed")({
  component: CompletedPage,
});

function CompletedPage() {
  const list = useServerFn(listBorrowings);
  const { data, isLoading } = useQuery({ queryKey: ["borrowings"], queryFn: () => list() });
  const [hist, setHist] = useState<BorrowingWithStats | null>(null);
  const completed = useMemo(() => (data ?? []).filter((b) => b.completed), [data]);

  return (
    <>
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
        <div className="px-4 md:px-8 py-4 max-w-6xl mx-auto w-full">
          <h1 className="text-lg font-semibold">Completed</h1>
        </div>
      </header>
      <main className="px-4 md:px-8 py-5 max-w-6xl mx-auto w-full">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-12 text-center">Loading…</p>
        ) : completed.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-16 px-6 text-center">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-muted flex items-center justify-center mb-3">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="font-medium">No settled borrowings yet</h3>
            <p className="text-sm text-muted-foreground mt-1">They'll show up here once fully paid.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {completed.map((b) => (
              <BorrowingCard key={b.id} b={b} onPay={() => {}} onHistory={setHist} />
            ))}
          </div>
        )}
      </main>
      <HistorySheet borrowing={hist} open={!!hist} onOpenChange={(v) => !v && setHist(null)} />
    </>
  );
}
