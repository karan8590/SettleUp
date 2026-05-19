import { useState, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { type BorrowingWithStats } from "@/lib/borrowings.functions";
import { vibrate, HAPTIC_PATTERNS } from "@/lib/haptics";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createBorrowing } from "@/lib/borrowings.functions";
import { toast } from "sonner";

export function AddBorrowingDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const create = useServerFn(createBorrowing);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

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

  const m = useMutation({
    mutationFn: (vars: {
      person_name: string;
      phone_number: string | null;
      borrow_date: string;
      total_borrowed: number;
      notes: string | null;
    }) =>
      create({
        data: vars,
      }),
    onMutate: async (newBorrowing) => {
      await qc.cancelQueries({ queryKey: ["borrowings"] });
      const previousBorrowings = qc.getQueryData<BorrowingWithStats[]>(["borrowings"]);

      const tempId = "optimistic-" + Math.random().toString(36).slice(2);
      const optimisticItem: BorrowingWithStats = {
        id: tempId,
        person_name: newBorrowing.person_name,
        phone_number: newBorrowing.phone_number,
        borrow_date: newBorrowing.borrow_date,
        total_borrowed: newBorrowing.total_borrowed,
        notes: newBorrowing.notes,
        created_at: new Date().toISOString(),
        total_paid: 0,
        remaining: newBorrowing.total_borrowed,
        completed: false,
      };

      qc.setQueryData<BorrowingWithStats[]>(["borrowings"], (old) => {
        return [optimisticItem, ...(old ?? [])];
      });

      onOpenChange(false);
      setName(""); setPhone(""); setAmount(""); setNotes("");
      setDate(new Date().toISOString().slice(0, 10));

      setTimeout(() => {
        vibrate(HAPTIC_PATTERNS.ADD_BORROWING);
      }, 100);

      return { previousBorrowings, tempId };
    },
    onError: (err, newBorrowing, context) => {
      vibrate(HAPTIC_PATTERNS.ERROR_FAILED);
      if (context?.previousBorrowings) {
        qc.setQueryData<BorrowingWithStats[]>(["borrowings"], (old) => {
          return (old ?? []).map((b) =>
            b.id === context.tempId ? { ...b, failed: true } as any : b
          );
        });
        setTimeout(() => {
          qc.setQueryData(["borrowings"], context.previousBorrowings);
        }, 600);
      }
      toast.error("Failed to add borrowing.");
    },
    onSuccess: (data, variables, context) => {
      qc.setQueryData<BorrowingWithStats[]>(["borrowings"], (old) => {
        return (old ?? []).map((b) =>
          b.id === context?.tempId
            ? {
                id: data.id,
                person_name: data.person_name,
                phone_number: data.phone_number,
                borrow_date: data.borrow_date,
                total_borrowed: Number(data.total_borrowed),
                notes: data.notes,
                created_at: data.created_at,
                total_paid: 0,
                remaining: Number(data.total_borrowed),
                completed: false,
              }
            : b
        );
      });
      toast.success("Borrowing added");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["borrowings"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim().length > 0 && phone.trim().length !== 10) {
      vibrate(HAPTIC_PATTERNS.ERROR_FAILED);
      toast.error("Phone number must be exactly 10 digits.");
      return;
    }
    vibrate(HAPTIC_PATTERNS.BUTTON_TAP);
    m.mutate({
      person_name: name.trim(),
      phone_number: phone.trim() || null,
      borrow_date: date,
      total_borrowed: Number(amount),
      notes: notes.trim() || null,
    });
  };

  const fields = (
    <div className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <Label htmlFor="name">Person name</Label>
        <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aman Sharma" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone">
          Phone <span className="text-muted-foreground font-normal text-xs">(optional)</span>
        </Label>
        <Input
          id="phone"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          pattern="[0-9]{10}"
          value={phone}
          onChange={(e) => {
            // strip any non-digit characters
            const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
            setPhone(digits);
          }}
          placeholder="10-digit mobile number"
        />
        {phone.length > 0 && phone.length < 10 && (
          <p className="text-xs text-destructive mt-1">
            {10 - phone.length} more digit{10 - phone.length !== 1 ? "s" : ""} needed
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="amount">Total borrowed (₹)</Label>
        <Input id="amount" type="number" inputMode="decimal" required min="1" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <DrawerContent className="m-2 mb-[max(8px,env(safe-area-inset-bottom))] overflow-hidden !rounded-[40px] border border-border/50 shadow-2xl after:hidden max-h-[85dvh]">
          <div className="mx-auto w-full max-w-md flex flex-col h-full overflow-hidden">
            <DrawerHeader className="text-left px-4 pt-4 shrink-0">
              <DrawerTitle>Add borrowing</DrawerTitle>
              <DrawerDescription>Record money you've lent.</DrawerDescription>
            </DrawerHeader>
            {/* Scrollable fields */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto px-4 flex-1">
                {fields}
              </div>
              {/* Sticky submit pinned to bottom of drawer */}
              <div className="shrink-0 px-4 pt-3 pb-4 bg-background/80 backdrop-blur-md border-t border-border/40">
                <Button type="submit" disabled={m.isPending} className="w-full h-12 rounded-full shadow-lg text-base font-medium">
                  {m.isPending ? "Saving…" : "Save borrowing"}
                </Button>
              </div>
            </form>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Add borrowing</DialogTitle>
          <DialogDescription>Record money you've lent.</DialogDescription>
        </DialogHeader>
        {/* Dialog: simple flow layout, button sits naturally below notes */}
        <form onSubmit={handleSubmit} className="space-y-0">
          {fields}
          <div className="pt-5">
            <Button type="submit" disabled={m.isPending} className="w-full h-11 rounded-xl text-base font-medium">
              {m.isPending ? "Saving…" : "Save borrowing"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
