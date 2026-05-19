import { useEffect, useState, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { vibrate, HAPTIC_PATTERNS } from "@/lib/haptics";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPayments, deletePayment, type BorrowingWithStats } from "@/lib/borrowings.functions";
import { formatINR, formatDate } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Trash2, Receipt } from "lucide-react";
import { toast } from "sonner";

export function HistorySheet({
  borrowing,
  open,
  onOpenChange,
}: {
  borrowing: BorrowingWithStats | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const list = useServerFn(listPayments);
  const del = useServerFn(deletePayment);
  const qc = useQueryClient();

  const [cachedBorrowing, setCachedBorrowing] = useState<BorrowingWithStats | null>(null);

  useEffect(() => {
    if (borrowing) {
      setCachedBorrowing(borrowing);
    }
  }, [borrowing]);

  const activeBorrowing = borrowing || cachedBorrowing;

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (open) {
      vibrate(HAPTIC_PATTERNS.BOTTOM_SHEET_OPEN);
    } else {
      vibrate(HAPTIC_PATTERNS.BOTTOM_SHEET_CLOSE);
    }
  }, [open]);

  // Data is pre-fetched by BorrowingCard before the sheet opens.
  // initialData ensures the sheet renders immediately with cached content.
  const { data: payments } = useQuery({
    queryKey: ["payments", activeBorrowing?.id],
    queryFn: () => list({ data: { borrowing_id: activeBorrowing!.id } }),
    enabled: !!activeBorrowing,
    staleTime: 30000,
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      vibrate(HAPTIC_PATTERNS.DELETE_UNDO);
      qc.invalidateQueries({ queryKey: ["borrowings"] });
      qc.invalidateQueries({ queryKey: ["payments", activeBorrowing?.id] });
      // Also clear stale time so next History tap re-fetches fresh data
      qc.removeQueries({ queryKey: ["payments", activeBorrowing?.id] });
      toast.success("Payment deleted");
    },
    onError: () => {
      vibrate(HAPTIC_PATTERNS.ERROR_FAILED);
      toast.error("Failed to delete payment");
    },
  });

  if (!activeBorrowing) return null;
  const pct = activeBorrowing.total_borrowed > 0
    ? Math.round((activeBorrowing.total_paid / activeBorrowing.total_borrowed) * 100)
    : 0;

  const body = (
    <div className="pt-2 space-y-4 pb-4">
      {/* Stats card */}
      <div
        className="rounded-[14px] p-4 space-y-3"
        style={{
          background: "var(--bg-card-hover)",
          border: "1px solid var(--border-card)",
        }}
      >
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Borrowed" value={formatINR(activeBorrowing.total_borrowed)} />
          <Stat label="Paid" value={formatINR(activeBorrowing.total_paid)} valueClass="text-paid-green" />
          <Stat label="Remaining" value={formatINR(activeBorrowing.remaining)} valueClass="text-remaining-red" />
        </div>
        <Progress
          value={pct}
          className="h-1.5 bg-progress-track"
          indicatorClassName="bg-progress-fill"
        />
        <p className="text-xs font-medium text-center text-muted-foreground">{pct}% paid</p>
      </div>

      {/* History list */}
      <div>
        <p
          className="mb-3"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Payment history
        </p>

        {/* Empty state — only shown when array is genuinely empty, never "Loading" */}
        {!payments || payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Receipt
              className="opacity-30"
              style={{ width: 32, height: 32, color: "var(--text-muted)" }}
            />
            <p
              style={{ fontSize: 14, color: "#636366", textAlign: "center" }}
            >
              No payments recorded yet
            </p>
          </div>
        ) : (
          <ul>
            {payments.map((p, i) => (
              <li
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "14px 0",
                  borderBottom: i < payments.length - 1
                    ? "1px solid var(--bg-card-hover)"
                    : "none",
                }}
              >
                {/* Left: date + mode */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--text-secondary)",
                      marginBottom: 4,
                    }}
                  >
                    {formatDate(p.payment_date)}
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {p.payment_mode && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.4px",
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: "var(--bg-card-hover)",
                          color: "var(--text-secondary)",
                          border: "1px solid var(--border-card)",
                        }}
                      >
                        {p.payment_mode}
                      </span>
                    )}
                    {p.payment_note && (
                      <span
                        style={{
                          fontSize: 13,
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 140,
                        }}
                      >
                        {p.payment_note}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: amount + delete */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: "var(--paid-green)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatINR(Number(p.amount_paid))}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    disabled={delM.isPending}
                    onClick={() => {
                      vibrate(HAPTIC_PATTERNS.BUTTON_TAP);
                      delM.mutate(p.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const title = `${activeBorrowing.person_name}`;
  const desc = activeBorrowing.phone_number ?? "Payment history";

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="m-2 mb-[max(8px,env(safe-area-inset-bottom))] overflow-hidden !rounded-[40px] border border-border/50 shadow-2xl after:hidden max-h-[85dvh]">
          <div className="mx-auto w-full max-w-md flex flex-col h-full overflow-hidden">
            <DrawerHeader className="text-left px-4 pt-4 shrink-0">
              <DrawerTitle>{title}</DrawerTitle>
              <DrawerDescription>{desc}</DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-4 flex-1">
              {body}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          color: "var(--text-secondary)",
          fontWeight: 500,
          marginBottom: 2,
        }}
      >
        {label}
      </p>
      <p
        className={`font-semibold text-sm tabular-nums ${valueClass || "text-foreground"}`}
      >
        {value}
      </p>
    </div>
  );
}
