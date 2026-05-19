import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Banknote, Smartphone } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
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
  const [mode, setMode] = useState<"cash" | "online">("cash");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  const [cachedBorrowing, setCachedBorrowing] = useState<BorrowingWithStats | null>(null);

  useEffect(() => {
    if (borrowing) {
      setCachedBorrowing(borrowing);
    }
  }, [borrowing]);

  useEffect(() => {
    if (open && borrowing) {
      setAmount(String(borrowing.remaining));
      setDate(new Date().toISOString().slice(0, 10));
      setMode("cash");
      setNote("");
      setShowNote(false);
    }
  }, [open, borrowing]);

  const activeBorrowing = borrowing || cachedBorrowing;

  const m = useMutation({
    mutationFn: () =>
      pay({
        data: {
          borrowing_id: activeBorrowing!.id,
          amount_paid: Number(amount),
          payment_date: date,
          payment_mode: mode,
          payment_note: note.trim() || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["borrowings"] });
      qc.invalidateQueries({ queryKey: ["payments", activeBorrowing?.id] });
      toast.success("Payment recorded");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!activeBorrowing) return null;

  const form = (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="pamount" className="text-foreground dark:text-[#F5F5F7] font-medium">Payment amount (₹)</Label>
          <span className="text-[11px] font-medium text-[#8E8E93] bg-[#F2F2F7] dark:bg-[#2C2C2E] border border-[#E5E5EA] dark:border-[#3A3A3C] px-2 py-0.5 rounded-md">
            Remaining: {formatINR(activeBorrowing.remaining)}
          </span>
        </div>
        <Input
          id="pamount" type="number" inputMode="decimal" required min="0.01" step="any"
          max={activeBorrowing.remaining}
          value={amount} onChange={(e) => setAmount(e.target.value)}
          className="bg-[#F2F2F7] border-[#E5E5EA] dark:bg-[#2C2C2E] dark:border-[#3A3A3C] rounded-xl text-foreground p-4 h-12 focus-visible:ring-0 focus-visible:border-primary"
        />
        <p className="text-xs text-[#8E8E93]">Edit to record a partial payment.</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pdate" className="text-foreground dark:text-[#F5F5F7] font-medium">Date</Label>
        <Input
          id="pdate" type="date" required value={date} onChange={(e) => setDate(e.target.value)}
          className="bg-[#F2F2F7] border-[#E5E5EA] dark:bg-[#2C2C2E] dark:border-[#3A3A3C] rounded-xl text-foreground p-4 h-12 focus-visible:ring-0 focus-visible:border-primary"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-foreground dark:text-[#F5F5F7] font-medium">Payment mode</Label>
        <div className="relative flex p-1 bg-[#E5E5EA] dark:bg-[#2C2C2E] rounded-xl">
          {/* Animated Slider Pill */}
          <div
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-[#3A3A3C] border border-black/5 dark:border-white/5 shadow-sm rounded-lg transition-all duration-300 ease-out"
            style={{
              transform: mode === "cash" ? "translateX(0)" : "translateX(calc(100% + 8px))",
            }}
          />
          <button
            type="button"
            onClick={() => setMode("cash")}
            className={`relative z-10 flex-1 flex items-center justify-center gap-2 h-10 text-sm rounded-lg transition-colors duration-300 ${
              mode === "cash"
                ? "text-foreground dark:text-[#FFFFFF] font-semibold"
                : "text-[#8E8E93] font-medium hover:text-foreground"
            }`}
          >
            <Banknote className="h-4 w-4" />
            Cash
          </button>
          <button
            type="button"
            onClick={() => setMode("online")}
            className={`relative z-10 flex-1 flex items-center justify-center gap-2 h-10 text-sm rounded-lg transition-colors duration-300 ${
              mode === "online"
                ? "text-foreground dark:text-[#FFFFFF] font-semibold"
                : "text-[#8E8E93] font-medium hover:text-foreground"
            }`}
          >
            <Smartphone className="h-4 w-4" />
            Online
          </button>
        </div>
      </div>

      {!showNote ? (
        <button
          type="button"
          onClick={() => setShowNote(true)}
          className="text-sm text-[#007AFF] dark:text-[#0A84FF] font-medium hover:underline flex items-center gap-1 pt-1"
        >
          + Add note
        </button>
      ) : (
        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
          <Label htmlFor="pnote" className="text-foreground dark:text-[#F5F5F7] font-medium">Note</Label>
          <Textarea
            id="pnote" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Optional details..."
            className="bg-[#F2F2F7] border-[#E5E5EA] dark:bg-[#2C2C2E] dark:border-[#3A3A3C] rounded-xl text-foreground p-4 min-h-[80px] focus-visible:ring-0 focus-visible:border-primary"
          />
        </div>
      )}
      <div className="sticky bottom-0 -mx-4 px-4 pt-4 pb-2 bg-background/80 backdrop-blur-md">
        <Button
          type="submit"
          disabled={m.isPending}
          className="w-full h-12 bg-[#1A1A1A] text-white dark:bg-[#FFFFFF] dark:text-[#000000] hover:opacity-90 rounded-full shadow-lg text-base font-semibold"
        >
          {m.isPending ? "Saving…" : `Record ${amount ? formatINR(Number(amount)) : "payment"}`}
        </Button>
      </div>
    </form>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="max-h-[85dvh]">
          <div className="mx-auto w-full max-w-md flex flex-col h-full overflow-hidden">
            <DrawerHeader className="text-left px-4 pt-4 shrink-0">
              <DrawerTitle>Record payment</DrawerTitle>
              <DrawerDescription>From {activeBorrowing.person_name}</DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-4 flex-1">
              {form}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>From {activeBorrowing.person_name}</DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}
