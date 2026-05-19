import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
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

  const m = useMutation({
    mutationFn: () =>
      create({
        data: {
          person_name: name.trim(),
          phone_number: phone.trim() || null,
          borrow_date: date,
          total_borrowed: Number(amount),
          notes: notes.trim() || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["borrowings"] });
      toast.success("Borrowing added");
      onOpenChange(false);
      setName(""); setPhone(""); setAmount(""); setNotes("");
      setDate(new Date().toISOString().slice(0, 10));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const form = (
    <form
      onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
      className="space-y-4 pt-2"
    >
      <div className="space-y-1.5">
        <Label htmlFor="name" className="text-foreground dark:text-[#F5F5F7] font-medium">Person name</Label>
        <Input
          id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aman Sharma"
          className="bg-[#F2F2F7] border-[#E5E5EA] dark:bg-[#2C2C2E] dark:border-[#3A3A3C] rounded-xl text-foreground p-4 h-12 focus-visible:ring-0 focus-visible:border-primary"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="phone" className="text-foreground dark:text-[#F5F5F7] font-medium">Phone</Label>
        <Input
          id="phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional"
          className="bg-[#F2F2F7] border-[#E5E5EA] dark:bg-[#2C2C2E] dark:border-[#3A3A3C] rounded-xl text-foreground p-4 h-12 focus-visible:ring-0 focus-visible:border-primary"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="date" className="text-foreground dark:text-[#F5F5F7] font-medium">Date</Label>
        <Input
          id="date" type="date" required value={date} onChange={(e) => setDate(e.target.value)}
          className="bg-[#F2F2F7] border-[#E5E5EA] dark:bg-[#2C2C2E] dark:border-[#3A3A3C] rounded-xl text-foreground p-4 h-12 focus-visible:ring-0 focus-visible:border-primary"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="amount" className="text-foreground dark:text-[#F5F5F7] font-medium">Total borrowed (₹)</Label>
        <Input
          id="amount" type="number" inputMode="decimal" required min="1" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
          className="bg-[#F2F2F7] border-[#E5E5EA] dark:bg-[#2C2C2E] dark:border-[#3A3A3C] rounded-xl text-foreground p-4 h-12 focus-visible:ring-0 focus-visible:border-primary"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-foreground dark:text-[#F5F5F7] font-medium">Notes</Label>
        <Textarea
          id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional"
          className="bg-[#F2F2F7] border-[#E5E5EA] dark:bg-[#2C2C2E] dark:border-[#3A3A3C] rounded-xl text-foreground p-4 min-h-[80px] focus-visible:ring-0 focus-visible:border-primary"
        />
      </div>
      <div className="sticky bottom-0 -mx-4 px-4 pt-4 pb-2 bg-background/80 backdrop-blur-md">
        <Button
          type="submit"
          disabled={m.isPending}
          className="w-full h-12 bg-[#1A1A1A] text-white dark:bg-[#FFFFFF] dark:text-[#000000] hover:opacity-90 rounded-full shadow-lg text-base font-semibold"
        >
          {m.isPending ? "Saving…" : "Save borrowing"}
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
              <DrawerTitle>Add borrowing</DrawerTitle>
              <DrawerDescription>Record money you've lent.</DrawerDescription>
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
          <DialogTitle>Add borrowing</DialogTitle>
          <DialogDescription>Record money you've lent.</DialogDescription>
        </DialogHeader>
        {form}
      </DialogContent>
    </Dialog>
  );
}
