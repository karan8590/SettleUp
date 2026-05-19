import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { vibrate, HAPTIC_PATTERNS } from "@/lib/haptics";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function debounce<T extends (...args: any[]) => void>(fn: T, delay = 300): T {
  let timer: any = null;
  return ((...args: any[]) => {
    if (timer) return;
    fn(...args);
    timer = setTimeout(() => { timer = null; }, delay);
  }) as any;
}

// ─── Confetti Canvas (runs entirely on <canvas>, returns Promise) ────────────
const CONFETTI_COLORS = ["#00C853", "#FFFFFF", "#FFD700", "#00E5FF"];

class Particle {
  x: number; y: number; vx: number; vy: number;
  rotation: number; rotationSpeed: number;
  size: number; color: string; isCircle: boolean;
  opacity: number; life: number; maxLife: number;

  constructor(canvasWidth: number) {
    this.x = Math.random() * canvasWidth;
    this.y = -10;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = Math.random() * 3 + 2;
    this.rotation = Math.random() * 360;
    this.rotationSpeed = (Math.random() - 0.5) * 8;
    this.size = Math.random() * 4 + 4;
    this.color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    this.isCircle = Math.random() > 0.4;
    this.opacity = 1;
    this.life = 0;
    this.maxLife = Math.random() * 40 + 60;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += 0.05;
    this.rotation += this.rotationSpeed;
    this.life++;
    this.opacity = this.life > this.maxLife * 0.7
      ? 1 - (this.life - this.maxLife * 0.7) / (this.maxLife * 0.3)
      : 1;
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.opacity);
    ctx.translate(this.x, this.y);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.fillStyle = this.color;
    if (this.isCircle) {
      ctx.beginPath();
      ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-this.size / 2, -this.size / 4, this.size, this.size / 2);
    }
    ctx.restore();
  }
  isDead() { return this.life >= this.maxLife; }
}

/** Launches confetti on a card element. Returns a Promise that resolves when all particles die. */
function runConfetti(article: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = article.offsetWidth;
    canvas.height = article.offsetHeight;
    Object.assign(canvas.style, {
      position: "absolute", top: "0", left: "0",
      width: "100%", height: "100%",
      pointerEvents: "none", borderRadius: "inherit", zIndex: "10",
    });
    article.appendChild(canvas);

    const ctx = canvas.getContext("2d")!;
    const particles: Particle[] = Array.from({ length: 40 }, () => new Particle(canvas.width));
    let rafId: number;

    function loop() {
      // If canvas was removed from DOM (e.g. on scroll cancellation), stop loop
      if (!canvas.parentNode) {
        resolve();
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw(ctx);
        if (particles[i].isDead()) particles.splice(i, 1);
      }
      if (particles.length > 0) {
        rafId = requestAnimationFrame(loop);
      } else {
        canvas.remove();
        resolve();
      }
    }
    rafId = requestAnimationFrame(loop);
    // Safety timeout
    setTimeout(() => { cancelAnimationFrame(rafId); if (canvas.parentNode) canvas.remove(); resolve(); }, 3000);
  });
}

// ─── BorrowingCard ───────────────────────────────────────────────────────────
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
  const qc = useQueryClient();
  const [downloading, setDownloading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const handlePayClick = useRef(debounce(() => onPay(b), 300)).current;
  const handleDownloadClick = useRef(debounce(() => handleDownload(), 300)).current;

  const handleHistoryClick = async () => {
    vibrate(HAPTIC_PATTERNS.BUTTON_TAP);
    if (historyLoading) return;
    setHistoryLoading(true);
    try {
      await qc.fetchQuery({
        queryKey: ["payments", b.id],
        queryFn: () => fetchPayments({ data: { borrowing_id: b.id } }),
        staleTime: 30000,
      });
      onHistory(b);
    } catch (e) {
      vibrate(HAPTIC_PATTERNS.ERROR_FAILED);
      toast.error("Failed to load history");
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── Visual states ─────────────────────────────────────────────────────────
  const [progressVal, setProgressVal] = useState(0);
  const [flashPaid, setFlashPaid] = useState(false);

  // Celebration states
  const [badgeState, setBadgeState] = useState<"normal" | "fold" | "unfold" | "done">("normal");
  const [animating, setAnimating] = useState(false);

  const articleRef = useRef<HTMLElement>(null);
  const isMounted = useRef(false);
  const prevPaid = useRef(b.total_paid);
  const settlingStarted = useRef(false);

  // ── Progress bar entrance ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      const delay = index * 100;
      const t = setTimeout(() => setProgressVal(pct), delay);
      return () => clearTimeout(t);
    } else {
      setProgressVal(pct);
    }
  }, [pct, index]);

  // ── Paid flash ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (b.total_paid > prevPaid.current) {
      setFlashPaid(true);
      const t = setTimeout(() => setFlashPaid(false), 500);
      prevPaid.current = b.total_paid;
      return () => clearTimeout(t);
    }
    prevPaid.current = b.total_paid;
  }, [b.total_paid]);

  // ── Async celebration sequence ────────────────────────────────────────────
  const runCelebration = useCallback(async () => {
    const card = articleRef.current;
    if (!card) return;

    let cancelled = false;

    const cleanup = () => {
      window.removeEventListener("scroll", handleScroll);
      const stamp = card.querySelector(".stamp-badge");
      if (stamp) stamp.remove();
      const canvas = card.querySelector("canvas");
      if (canvas) canvas.remove();
      card.classList.remove("glow-pulse");
      card.style.transform = "";
      card.style.transition = "";
      card.style.opacity = "";
      card.style.pointerEvents = "";
      card.style.willChange = "";
      setAnimating(false);
      setBadgeState("done");
    };

    const handleScroll = () => {
      if (cancelled) return;
      cancelled = true;
      cleanup();
      // Fallback: instantly trigger parent shift
      onSettleComplete?.(b.id);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    setAnimating(true);
    card.style.pointerEvents = "none";
    card.style.willChange = "transform, opacity";

    try {
      // 0ms -> Sheet closes. Wait 300ms.
      await wait(300);
      if (cancelled) return;

      // PHASE 2 — Glow pulse (600ms)
      card.classList.add("glow-pulse");
      await wait(600);
      card.classList.remove("glow-pulse");
      if (cancelled) return;

      // PHASE 3 — Confetti (runs in parallel with stamp)
      const confettiPromise = runConfetti(card);

      // PHASE 4 — Stamp slams in (350ms spring), holds 800ms, fades 300ms
      const stampPromise = (async () => {
        const stamp = document.createElement("div");
        stamp.className = "stamp-badge";
        stamp.innerText = "FULLY PAID ✓";
        card.appendChild(stamp);

        // slam in: 350ms
        requestAnimationFrame(() => {
          stamp.classList.add("stamp-in");
        });

        vibrate(HAPTIC_PATTERNS.PAYMENT_COMPLETE);

        await wait(350 + 800);
        if (cancelled) return;

        stamp.classList.add("stamp-fade");
        await wait(300);
        if (cancelled) return;
        stamp.remove();
      })();

      await stampPromise;
      if (cancelled) return;

      // PHASE 5 — Badge flip (150ms fold + 150ms unfold)
      setBadgeState("fold");
      await wait(150);
      if (cancelled) return;

      setBadgeState("unfold");
      await wait(150);
      if (cancelled) return;

      setBadgeState("done");

      // Wait for confetti to fully finish
      await confettiPromise;
      if (cancelled) return;

      // Breathe pause
      await wait(200);
      if (cancelled) return;

      // PHASE 6a — Scale down (200ms)
      card.style.transition = "transform 200ms ease-in";
      card.style.transform = "scale(0.96)";
      await wait(200);
      if (cancelled) return;

      // PHASE 6b — Slide out right (380ms)
      card.style.transition = "transform 380ms ease-in, opacity 380ms ease-in";
      card.style.transform = "translateX(110%)";
      card.style.opacity = "0";
      await wait(380);
      if (cancelled) return;

      // Done — notify parent
      cleanup();
      onSettleComplete?.(b.id);
    } catch (e) {
      cleanup();
      onSettleComplete?.(b.id);
    }
  }, [b.id, onSettleComplete]);

  useEffect(() => {
    if (b.remaining === 0 && !b.completed && !settlingStarted.current) {
      settlingStarted.current = true;
      runCelebration();
    }
  }, [b.remaining, b.completed, runCelebration]);

  // ── Download handler ──────────────────────────────────────────────────────
  async function handleDownload() {
    vibrate(HAPTIC_PATTERNS.BUTTON_TAP);
    if (downloading) return;
    setDownloading(true);
    const t = toast.loading("Generating PDF…");
    try {
      const payments = await fetchPayments({ data: { borrowing_id: b.id } });
      generateBorrowingPdf(b, payments as never);
      toast.success("PDF downloaded successfully", { id: t });
    } catch (e) {
      vibrate(HAPTIC_PATTERNS.ERROR_FAILED);
      toast.error("Failed to generate PDF. Please try again.", { id: t });
    } finally {
      setDownloading(false);
    }
  }

  const isOptimistic = b.id.startsWith("optimistic-");
  const failed = (b as any).failed;

  // ── Badge renderer ────────────────────────────────────────────────────────
  const renderBadge = () => {
    if (badgeState === "done") {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#00C853] bg-[rgba(0,200,83,0.15)] border border-[#00C853] rounded-full px-2.5 py-1">
          <Check className="h-3 w-3" /> Completed
        </span>
      );
    }

    const scaleX = badgeState === "fold" ? 0 : 1;
    const isCompleted = b.completed;

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1",
          isCompleted
            ? "text-success-foreground bg-success border border-success-border"
            : "text-warning-foreground bg-warning border border-warning-border"
        )}
        style={{
          transform: `scaleX(${scaleX})`,
          transition: "transform 150ms ease-in-out",
        }}
      >
        {isCompleted
          ? <><Check className="h-3 w-3" /> Paid</>
          : <><Clock className="h-3 w-3" /> Pending</>
        }
      </span>
    );
  };

  return (
    <article
      ref={articleRef}
      className={cn(
        "group rounded-2xl border bg-card p-5 shadow-sm relative overflow-hidden",
        b.completed ? "border-success-border bg-success/30" : "border-border",
        isOptimistic && "border-dashed border-border/70 animate-pulse",
        failed && "animate-[shake_0.5s_ease-in-out] opacity-0 duration-500",
        !animating && "hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
      )}
      style={{
        transition: animating ? undefined : "all 300ms ease",
      }}
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
          {renderBadge()}
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
              valueClass={cn("text-paid-green transition-all duration-500", flashPaid && "scale-105 font-bold")}
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
            {isOptimistic ? "0% paid" : <AnimatedNumber value={pct} formatter={(v) => Math.round(v) + "% paid"} />}
          </span>
          {b.notes && <span className="truncate ml-3 max-w-[60%] text-muted-foreground font-normal">{b.notes}</span>}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 rounded-xl h-10 ripple-btn"
          disabled={b.completed || isOptimistic || animating}
          onClick={(e) => {
            vibrate(HAPTIC_PATTERNS.BUTTON_TAP);
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
          className="flex-1 rounded-xl h-10 transition-opacity"
          disabled={isOptimistic || historyLoading || animating}
          style={historyLoading ? { opacity: 0.6 } : undefined}
          onClick={handleHistoryClick}
        >
          {historyLoading
            ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            : <History className="h-4 w-4 mr-1" />}
          History
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl h-10 w-10 p-0 shrink-0"
          onClick={handleDownloadClick}
          disabled={downloading || isOptimistic || animating}
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
