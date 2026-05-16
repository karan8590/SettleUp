import jsPDF from "jspdf";
import type { BorrowingWithStats } from "./borrowings.functions";
import { formatDate } from "./format";

type Payment = {
  id: string;
  amount_paid: number | string;
  payment_date: string;
  payment_note: string | null;
  payment_mode?: string | null;
};

// Format INR without the ₹ glyph (jsPDF core fonts don't support it). Use "Rs ".
function rs(amount: number): string {
  const n = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);
  return `Rs ${n}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "borrower";
}

export function generateBorrowingPdf(b: BorrowingWithStats, payments: Payment[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  const text = (s: string, x: number, yy: number, opts?: { size?: number; bold?: boolean; color?: [number, number, number]; align?: "left" | "right" | "center" }) => {
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(opts?.size ?? 10);
    const [r, g, bl] = opts?.color ?? [30, 30, 30];
    doc.setTextColor(r, g, bl);
    doc.text(s, x, yy, { align: opts?.align ?? "left" });
  };

  const divider = (yy: number) => {
    doc.setDrawColor(225, 225, 225);
    doc.setLineWidth(0.5);
    doc.line(margin, yy, pageW - margin, yy);
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header
  text("Ledger", margin, y, { size: 11, bold: true, color: [90, 90, 90] });
  text(
    `Generated ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`,
    pageW - margin,
    y,
    { size: 9, color: [140, 140, 140], align: "right" },
  );
  y += 22;
  text("Borrowing History Report", margin, y, { size: 20, bold: true, color: [20, 20, 20] });
  y += 18;
  divider(y);
  y += 22;

  // Borrower details
  text("BORROWER", margin, y, { size: 8, bold: true, color: [140, 140, 140] });
  y += 14;
  text(b.person_name, margin, y, { size: 16, bold: true });
  y += 18;
  const meta: string[] = [];
  if (b.phone_number) meta.push(b.phone_number);
  meta.push(`Borrowed on ${formatDate(b.borrow_date)}`);
  text(meta.join("   •   "), margin, y, { size: 10, color: [110, 110, 110] });
  y += 16;
  if (b.notes) {
    const lines = doc.splitTextToSize(b.notes, pageW - margin * 2);
    text(lines, margin, y, { size: 10, color: [90, 90, 90] }) as unknown;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(90, 90, 90);
    doc.text(lines, margin, y);
    y += lines.length * 13;
  }
  y += 10;
  divider(y);
  y += 22;

  // Summary
  const pct = b.total_borrowed > 0 ? Math.round((b.total_paid / b.total_borrowed) * 100) : 0;
  text("SUMMARY", margin, y, { size: 8, bold: true, color: [140, 140, 140] });
  y += 18;

  const colW = (pageW - margin * 2) / 3;
  const drawStat = (label: string, value: string, x: number, color: [number, number, number]) => {
    text(label, x, y, { size: 8, color: [150, 150, 150] });
    text(value, x, y + 18, { size: 15, bold: true, color });
  };
  drawStat("Borrowed", rs(b.total_borrowed), margin, [30, 30, 30]);
  drawStat("Paid", rs(b.total_paid), margin + colW, [34, 139, 87]);
  drawStat("Remaining", rs(b.remaining), margin + colW * 2, b.completed ? [34, 139, 87] : [200, 120, 40]);
  y += 38;

  // Progress
  const barX = margin;
  const barW = pageW - margin * 2;
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(barX, y, barW, 6, 3, 3, "F");
  if (pct > 0) {
    doc.setFillColor(34, 139, 87);
    doc.roundedRect(barX, y, (barW * pct) / 100, 6, 3, 3, "F");
  }
  y += 16;
  text(`${pct}% paid`, margin, y, { size: 9, color: [120, 120, 120] });
  text(b.completed ? "Settled" : "Pending", pageW - margin, y, {
    size: 9,
    bold: true,
    color: b.completed ? [34, 139, 87] : [200, 120, 40],
    align: "right",
  });
  y += 22;
  divider(y);
  y += 22;

  // Payment history
  text("PAYMENT HISTORY", margin, y, { size: 8, bold: true, color: [140, 140, 140] });
  text(`${payments.length} ${payments.length === 1 ? "entry" : "entries"}`, pageW - margin, y, {
    size: 8,
    color: [140, 140, 140],
    align: "right",
  });
  y += 18;

  if (payments.length === 0) {
    text("No payments recorded yet.", margin, y, { size: 10, color: [140, 140, 140] });
    y += 18;
  } else {
    const sorted = [...payments].sort(
      (a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime(),
    );
    for (const p of sorted) {
      ensureSpace(48);
      text(formatDate(p.payment_date), margin, y, { size: 10, bold: true, color: [40, 40, 40] });
      text(rs(Number(p.amount_paid)), pageW - margin, y, {
        size: 11,
        bold: true,
        color: [34, 139, 87],
        align: "right",
      });
      y += 14;
      const mode = (p.payment_mode || "").toString().toUpperCase();
      const sub = [mode && `Mode: ${mode}`, p.payment_note].filter(Boolean).join("   •   ");
      if (sub) {
        const lines = doc.splitTextToSize(sub, pageW - margin * 2);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(130, 130, 130);
        doc.text(lines, margin, y);
        y += lines.length * 12;
      }
      y += 6;
      doc.setDrawColor(240, 240, 240);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
      y += 12;
    }
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(170, 170, 170);
    doc.text(`Ledger  •  ${b.person_name}`, margin, pageH - 20);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 20, { align: "right" });
  }

  const filename = `${slugify(b.person_name)}-borrowing-history.pdf`;
  doc.save(filename);
}
