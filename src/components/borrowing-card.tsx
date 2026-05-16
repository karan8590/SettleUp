import { useState } from "react";
import { listPayments, type BorrowingWithStats } from "@/lib/borrowings.functions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatINR, formatDate } from "@/lib/format";
import { Phone, Calendar, Check, Clock, History, Wallet, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { generateBorrowingPdf } from "@/lib/generate-pdf";
import { toast } from "sonner";

export function BorrowingCard({
  b,
  onPay,
  onHistory,
}: {
  b: BorrowingWithStats;
  onPay: (b: BorrowingWithStats) => void;
  onHistory: (b: BorrowingWithStats) => void;
}) {
  const pct = b.total_borrowed > 0 ? Math.round((b.total_paid / b.total_borrowed) * 100) : 0;
  const fetchPayments = useServerFn(listPayments);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    const t = toast.loading("Generating PDF…");
    try {
      const payments = await fetchPayments({ data: { borrowing_id: b.id } });
      generateBorrowingPdf(b, payments as never);
      toast.success("PDF downloaded successfully", { id: t });
    } catch (e) {
      toast.error("Failed to generate PDF. Please try again.", { id: t });
    } finally {
      setDownloading(false);
    }
  }
  return (
    <article
      className={cn(
        "group rounded-2xl border bg-card p-5 shadow-sm transition hover:shadow-md hover:-translate-y-0.5",
        b.completed
          ? "border-success-border bg-success/30"
          : "border-border",
      )}
    >
      <header className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="font-semibold truncate">{b.person_name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {b.phone_number && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" /> {b.phone_number}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {formatDate(b.borrow_date)}
            </span>
          </div>
        </div>
        {b.completed ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success-foreground bg-success border border-success-border rounded-full px-2.5 py-1">
            <Check className="h-3 w-3" /> Paid
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-foreground bg-warning border border-warning-border rounded-full px-2.5 py-1">
            <Clock className="h-3 w-3" /> Pending
          </span>
        )}
      </header>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="Borrowed" value={formatINR(b.total_borrowed)} />
        <Stat label="Paid" value={formatINR(b.total_paid)} />
        <Stat label="Remaining" value={formatINR(b.remaining)} highlight={!b.completed} />
      </div>

      <div className="mb-4">
        <Progress value={pct} className="h-1.5 transition-all" />
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{pct}% paid</span>
          {b.notes && <span className="truncate ml-3 max-w-[60%]">{b.notes}</span>}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 rounded-xl h-10"
          disabled={b.completed}
          onClick={() => onPay(b)}
        >
          <Wallet className="h-4 w-4 mr-1" />
          {b.completed ? "Settled" : "Pay"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 rounded-xl h-10"
          onClick={() => onHistory(b)}
        >
          <History className="h-4 w-4 mr-1" /> History
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-10 w-10 p-0 shrink-0"
          onClick={handleDownload}
          disabled={downloading}
          aria-label="Download PDF"
          title="Download PDF"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </Button>
      </div>
    </article>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-semibold mt-0.5 tabular-nums", highlight && "text-foreground")}>{value}</p>
    </div>
  );
}
