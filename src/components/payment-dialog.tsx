import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { recordPayment, type BorrowingWithStats } from "@/lib/borrowings.functions";
import { toast } from "sonner";
import { formatINR } from "@/lib/format";

export function PaymentDialog({
  borrowing,
  open,
  onOpenChange,
}: {
  borrowing: BorrowingWithStats | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const pay = useServerFn(recordPayment);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open && borrowing) {
      setAmount(String(borrowing.remaining));
      setDate(new Date().toISOString().slice(0, 10));
      setNote("");
    }
  }, [open, borrowing]);

  const m = useMutation({
    mutationFn: () =>
      pay({
        data: {
          borrowing_id: borrowing!.id,
          amount_paid: Number(amount),
          payment_date: date,
          payment_note: note.trim() || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["borrowings"] });
      qc.invalidateQueries({ queryKey: ["payments", borrowing?.id] });
      toast.success("Payment recorded");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!borrowing) return null;

  const form = (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4 pt-2">
      <div className="rounded-xl bg-muted px-4 py-3 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Remaining</span>
        <span className="font-semibold">{formatINR(borrowing.remaining)}</span>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pamount">Payment amount (₹)</Label>
        <Input
          id="pamount" type="number" inputMode="decimal" required min="0.01" step="any"
          max={borrowing.remaining}
          value={amount} onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
        <p className="text-xs text-muted-foreground">Edit to record a partial payment.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pdate">Date</Label>
        <Input id="pdate" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pnote">Note</Label>
        <Textarea id="pnote" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </div>
      <Button type="submit" disabled={m.isPending} className="w-full h-11 rounded-xl">
        {m.isPending ? "Saving…" : `Record ${amount ? formatINR(Number(amount)) : "payment"}`}
      </Button>
    </form>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[92vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>Record payment</SheetTitle>
            <SheetDescription>From {borrowing.person_name}</SheetDescription>
          </SheetHeader>
          {form}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>From {borrowing.person_name}</DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}
