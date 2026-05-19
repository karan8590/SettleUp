import { useState, useEffect, useRef } from "react";
import { listPayments, type BorrowingWithStats } from "@/lib/borrowings.functions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatINR, formatDate } from "@/lib/format";
import { Phone, Calendar, Check, Clock, History, Wallet, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import { generateBorrowingPdf } from "@/lib/generate-pdf";
import { toast } from "sonner";
import { AnimatedNumber } from "@/components/animated-number";

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

export function BorrowingCard({
  b,
  onPay,
  onHistory,
  index = 0,
  onSettleComplete,
}: {
  b: BorrowingWithStats;
  onPay: (b: BorrowingWithStats) => void;
  onHistory: (b: BorrowingWithStats) => void;
  index?: number;
  onSettleComplete?: (id: string) => void;
}) {
  const pct = b.total_borrowed > 0 ? Math.round((b.total_paid / b.total_borrowed) * 100) : 0;
  const fetchPayments = useServerFn(listPayments);
  const [downloading, setDownloading] = useState(false);

  const handlePayClick = useRef(debounce(() => onPay(b), 300)).current;
  const handleHistoryClick = useRef(debounce(() => onHistory(b), 300)).current;
  const handleDownloadClick = useRef(debounce(() => handleDownload(), 300)).current;

  // States for micro-animations
  const [progressVal, setProgressVal] = useState(0);
  const [flashGreen, setFlashGreen] = useState(false);
  const [showBadge, setShowBadge] = useState(false);
  const [slideOut, setSlideOut] = useState(false);
  const [flashPaid, setFlashPaid] = useState(false);

  // Refs
  const isMounted = useRef(false);
  const prevPaid = useRef(b.total_paid);
  const settlingStarted = useRef(false);

  // 1. Progress Bar Staggered entrance and subsequent update timings
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      const delay = index * 100;
      const t = setTimeout(() => {
        setProgressVal(pct);
      }, delay);
      return () => clearTimeout(t);
    } else {
      setProgressVal(pct);
    }
  }, [pct, index]);

  // 2. Paid value green flash pulse
  useEffect(() => {
    if (b.total_paid > prevPaid.current) {
      setFlashPaid(true);
      const t = setTimeout(() => setFlashPaid(false), 500);
      prevPaid.current = b.total_paid;
      return () => clearTimeout(t);
    }
    prevPaid.current = b.total_paid;
  }, [b.total_paid]);

  // 3. Final payment card transfer sequence (Problem 3)
  useEffect(() => {
    if (b.remaining === 0 && !b.completed && !settlingStarted.current) {
      settlingStarted.current = true;

      // Step 1: Flash card border green for 400ms
      setFlashGreen(true);

      const t1 = setTimeout(() => {
        setFlashGreen(false);
        // Step 2 & 3: Show Completed! badge (scale spring)
        setShowBadge(true);
      }, 400);

      // Step 4: After 1200ms (400ms flash + 800ms wait), slide out to the right
      const t2 = setTimeout(() => {
        setSlideOut(true);
      }, 1200);

      // Step 5: After slide out finishes (350ms duration), trigger onSettleComplete
      const t3 = setTimeout(() => {
        onSettleComplete?.(b.id);
      }, 1550);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [b.remaining, b.completed, b.id, onSettleComplete]);

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

  const isOptimistic = b.id.startsWith("optimistic-");
  const failed = (b as any).failed;

  return (
    <article
      className={cn(
        "group rounded-2xl border bg-card p-5 shadow-sm transition-all duration-300 will-change-transform relative overflow-hidden",
        b.completed
          ? "border-success-border bg-success/30"
          : "border-border",
        flashGreen && "border-[#00C853] bg-[#E8F5E9]/10 dark:bg-[#E8F5E9]/5 shadow-[0_0_12px_rgba(0,200,83,0.2)]",
        slideOut && "translate-x-[110%] opacity-0 duration-[350ms] ease-in",
        isOptimistic && "border-dashed border-border/70 animate-pulse",
        failed && "animate-[shake_0.5s_ease-in-out] opacity-0 duration-500",
        "hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)] duration-200 ease-in-out"
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
        <div className="flex items-center gap-2">
          {showBadge && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#00C853] border border-[#00C853] rounded-full px-2.5 py-1 animate-[scale-spring_0.3s_cubic-bezier(0.34,1.56,0.64,1)]">
              ✓ Completed!
            </span>
          )}
          {!showBadge && (
            b.completed ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success-foreground bg-success border border-success-border rounded-full px-2.5 py-1">
                <Check className="h-3 w-3" /> Paid
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-foreground bg-warning border border-warning-border rounded-full px-2.5 py-1">
                <Clock className="h-3 w-3" /> Pending
              </span>
            )
          )}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {isOptimistic ? (
          <>
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Borrowed</span>
              <div className="h-5 w-20 bg-muted/80 rounded animate-pulse" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Paid</span>
              <div className="h-5 w-20 bg-muted/80 rounded animate-pulse" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Remaining</span>
              <div className="h-5 w-20 bg-muted/80 rounded animate-pulse" />
            </div>
          </>
        ) : (
          <>
            <Stat label="Borrowed" value={formatINR(b.total_borrowed)} />
            <Stat
              label="Paid"
              value={<AnimatedNumber value={b.total_paid} formatter={formatINR} />}
              valueClass={cn("text-paid-green transition-all duration-500", flashPaid && "text-[#00C853] scale-105 font-bold")}
            />
            <Stat
              label="Remaining"
              value={<AnimatedNumber value={b.remaining} formatter={formatINR} />}
              valueClass="text-remaining-red"
            />
          </>
        )}
      </div>

      <div className="mb-4">
        <Progress
          value={progressVal}
          className="h-1.5 bg-progress-track"
          indicatorClassName="bg-progress-fill"
          indicatorStyle={{
            transition: isMounted.current
              ? "transform 600ms cubic-bezier(0.16, 1, 0.3, 1)"
              : `transform 800ms cubic-bezier(0.16, 1, 0.3, 1) ${index * 100}ms`,
          }}
        />
        <div className="mt-2 flex items-center justify-between text-xs text-foreground font-medium">
          <span>
            {isOptimistic ? (
              "0% paid"
            ) : (
              <AnimatedNumber value={pct} formatter={(v) => Math.round(v) + "% paid"} />
            )}
          </span>
          {b.notes && <span className="truncate ml-3 max-w-[60%] text-muted-foreground font-normal">{b.notes}</span>}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 rounded-xl h-10 ripple-btn"
          disabled={b.completed || isOptimistic}
          onClick={(e) => {
            const btn = e.currentTarget;
            const circle = document.createElement("span");
            const diameter = Math.max(btn.clientWidth, btn.clientHeight);
            const radius = diameter / 2;
            circle.style.width = circle.style.height = `${diameter}px`;
            circle.style.left = `${e.clientX - btn.getBoundingClientRect().left - radius}px`;
            circle.style.top = `${e.clientY - btn.getBoundingClientRect().top - radius}px`;
            circle.classList.add("ripple-span");
            const existing = btn.getElementsByClassName("ripple-span")[0];
            if (existing) existing.remove();
            btn.appendChild(circle);
            handlePayClick();
          }}
        >
          <Wallet className="h-4 w-4 mr-1" />
          {b.completed ? "Settled" : "Pay"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 rounded-xl h-10"
          disabled={isOptimistic}
          onClick={handleHistoryClick}
        >
          <History className="h-4 w-4 mr-1" /> History
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-10 w-10 p-0 shrink-0"
          onClick={handleDownloadClick}
          disabled={downloading || isOptimistic}
          aria-label="Download PDF"
          title="Download PDF"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </Button>
      </div>
    </article>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
      <p className={cn("text-sm font-semibold mt-0.5 tabular-nums will-change-transform transition-all", valueClass || "text-foreground")}>{value}</p>
    </div>
  );
}
