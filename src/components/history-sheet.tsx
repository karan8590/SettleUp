import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPayments, deletePayment, type BorrowingWithStats } from "@/lib/borrowings.functions";
import { formatINR, formatDate } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
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

  const { data: payments } = useQuery({
    queryKey: ["payments", borrowing?.id],
    queryFn: () => list({ data: { borrowing_id: borrowing!.id } }),
    enabled: !!borrowing && open,
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["borrowings"] });
      qc.invalidateQueries({ queryKey: ["payments", borrowing?.id] });
      toast.success("Payment deleted");
    },
  });

  if (!borrowing) return null;
  const pct = borrowing.total_borrowed > 0 ? Math.round((borrowing.total_paid / borrowing.total_borrowed) * 100) : 0;

  const body = (
    <div className="pt-2 space-y-5">
      <div className="rounded-2xl border border-border p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Borrowed" value={formatINR(borrowing.total_borrowed)} />
          <Stat label="Paid" value={formatINR(borrowing.total_paid)} />
          <Stat label="Remaining" value={formatINR(borrowing.remaining)} />
        </div>
        <Progress value={pct} className="h-1.5" />
        <p className="text-xs text-muted-foreground text-center">{pct}% paid</p>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Payment history</h3>
        {payments === undefined ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No payments yet.</p>
        ) : (
          <ul className="space-y-2">
            {payments.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-semibold">{formatINR(Number(p.amount_paid))}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(p.payment_date)}</span>
                    {p.payment_mode && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                        {p.payment_mode}
                      </span>
                    )}
                  </div>
                  {p.payment_note && <p className="text-sm text-muted-foreground mt-0.5 break-words">{p.payment_note}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0" onClick={() => delM.mutate(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const title = `${borrowing.person_name}`;
  const desc = borrowing.phone_number ?? "Payment history";

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[92vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{desc}</SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm mt-0.5">{value}</p>
    </div>
  );
}
