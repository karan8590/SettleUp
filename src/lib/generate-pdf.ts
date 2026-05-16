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
  const margin = 56;
  const contentW = pageW - margin * 2;
  let y = 0;

  const hex2rgb = (hex: string): [number, number, number] => {
    const bigint = parseInt(hex.replace("#", ""), 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
  };

  const text = (s: string, x: number, yy: number, opts?: { size?: number; bold?: boolean; color?: [number, number, number] | string; align?: "left" | "right" | "center" }) => {
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(opts?.size ?? 13);
    const color = typeof opts?.color === "string" ? hex2rgb(opts.color) : (opts?.color ?? [17, 17, 17]);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(s, x, yy, { align: opts?.align ?? "left" });
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 48) {
      doc.addPage();
      y = 48; // Top margin for new pages
    }
  };

  // 1. HEADER (Navy Bar)
  doc.setFillColor(...hex2rgb("#1C2B4A")); // Deeper branded navy
  doc.rect(0, 0, pageW, 88, "F");
  
  // Header Accent Line
  doc.setFillColor(...hex2rgb("#2563EB"));
  doc.rect(0, 88, pageW / 2, 4, "F");
  doc.setFillColor(...hex2rgb("#16A34A"));
  doc.rect(pageW / 2, 88, pageW / 2, 4, "F");

  y = 38;
  // Circular Logo icon
  doc.setFillColor(...hex2rgb("#3B82F6"));
  doc.circle(margin + 6, y - 4, 7, "F");
  doc.setFillColor(...hex2rgb("#FFFFFF"));
  doc.circle(margin + 6, y - 4, 2.5, "F");

  text("LEDGER", margin + 18, y, { size: 11, bold: true, color: "#878B94" });
  text("GENERATED", pageW - margin, y, { size: 10, bold: true, color: "#878B94", align: "right" });
  
  y += 24;
  text("Borrowing History Report", margin, y, { size: 20, bold: true, color: "#FFFFFF" });
  const genDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeStyle: "short" }).format(new Date());
  text(genDate, pageW - margin, y, { size: 12, color: "#CCCCCC", align: "right" });

  y = 88 + 3 + 28;

  // 2. BORROWER INFO SECTION
  const noteLines = b.notes ? doc.splitTextToSize(`Note: ${b.notes}`, contentW - 48) : [];
  const boxHeight = 85 + (noteLines.length * 14);
  
  doc.setFillColor(...hex2rgb("#F9FAFB"));
  doc.setDrawColor(...hex2rgb("#E5E7EB"));
  doc.setLineWidth(1);
  doc.roundedRect(margin, y, contentW, boxHeight, 8, 8, "FD");
  
  // Left strong accent
  doc.setFillColor(...hex2rgb("#1C2B4A"));
  // To avoid radius bleed, just draw a small rect overlapping
  doc.rect(margin, y + 4, 4, boxHeight - 8, "F");

  let cy = y + 24;
  text("BORROWER", margin + 24, cy, { size: 10, bold: true, color: "#888888" });
  
  // Status Pill Badge (Right Aligned)
  const pct = b.total_borrowed > 0 ? (b.total_paid / b.total_borrowed) * 100 : 0;
  const status = pct === 0 ? "PENDING" : pct >= 100 ? "PAID" : "PARTIAL";
  let bg = "#FEF3C7", tc = "#92400E", bc = "#FCD34D";
  if (status === "PAID") { bg = "#DCFCE7"; tc = "#166534"; bc = "#86EFAC"; }
  if (status === "PARTIAL") { bg = "#DBEAFE"; tc = "#1E40AF"; bc = "#93C5FD"; }
  
  doc.setFillColor(...hex2rgb(bg));
  doc.setDrawColor(...hex2rgb(bc));
  doc.roundedRect(pageW - margin - 24 - 60, cy - 10, 60, 20, 10, 10, "FD");
  text(status, pageW - margin - 24 - 30, cy + 4, { size: 10, bold: true, color: tc, align: "center" });

  cy += 22;
  const initialsColorPallete = [
    { bg: "#DBEAFE", text: "#1E40AF" },
    { bg: "#EDE9FE", text: "#5B21B6" },
    { bg: "#FEF3C7", text: "#92400E" },
    { bg: "#F3F4F6", text: "#374151" }
  ];
  const charCode = b.person_name.charCodeAt(0) || 0;
  const { bg: initialBg, text: initialText } = initialsColorPallete[charCode % 4];

  doc.setFillColor(...hex2rgb(initialBg));
  doc.circle(margin + 40, cy - 6, 16, "F");
  text(b.person_name.charAt(0).toUpperCase(), margin + 40, cy - 1, { size: 14, bold: true, color: initialText, align: "center" });

  text(b.person_name, margin + 64, cy, { size: 22, bold: true, color: "#111111" });
  text(`Ref: #LOAN-${b.id.slice(0, 6).toUpperCase()}`, pageW - margin - 24, cy, { size: 11, color: "#999999", align: "right" });

  cy += 18;
  const metaInfo = [b.phone_number, `Borrowed on ${formatDate(b.borrow_date)}`].filter(Boolean).join("  ·  ");
  text(metaInfo, margin + 64, cy, { size: 13, color: "#666666" });

  if (noteLines.length > 0) {
    cy += 18;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(12);
    doc.setTextColor(...hex2rgb("#999999"));
    doc.text(noteLines, margin + 24, cy);
  }

  y += boxHeight + 36;

  // 3. SUMMARY SECTION
  text("SUMMARY", margin, y, { size: 10, bold: true, color: "#888888" });
  y += 12;
  
  doc.setFillColor(...hex2rgb("#F9FAFB"));
  doc.setDrawColor(...hex2rgb("#E5E7EB"));
  doc.roundedRect(margin, y, contentW, 80, 8, 8, "FD");
  
  y += 24;
  const colW = contentW / 3;
  
  // Col 1: Borrowed
  text("Total Borrowed", margin + 16, y, { size: 10, bold: true, color: "#888888" });
  text(rs(b.total_borrowed), margin + 16, y + 24, { size: 22, bold: true, color: "#111111" });
  
  // Col 2: Paid
  doc.line(margin + colW, y - 24, margin + colW, y + 56); // Left divider
  text("Amount Paid", margin + colW + 16, y, { size: 10, bold: true, color: "#888888" });
  text(rs(b.total_paid), margin + colW + 16, y + 24, { size: 22, bold: true, color: "#16A34A" });
  
  // Mini progress bar for paid
  doc.setFillColor(...hex2rgb("#E5E7EB"));
  doc.rect(margin + colW + 16, y + 36, colW - 32, 4, "F");
  doc.setFillColor(...hex2rgb("#16A34A"));
  doc.rect(margin + colW + 16, y + 36, (colW - 32) * (pct / 100), 4, "F");
  text(`${Math.round(pct)}% of total`, margin + colW + 16, y + 50, { size: 9, bold: true, color: "#16A34A" });

  // Col 3: Remaining
  doc.line(margin + colW * 2, y - 24, margin + colW * 2, y + 56); // Right divider
  text("Remaining", margin + colW * 2 + 16, y, { size: 10, bold: true, color: "#888888" });
  text(rs(b.remaining), margin + colW * 2 + 16, y + 24, { size: 22, bold: true, color: "#DC2626" });

  // Mini progress bar for remaining
  const remPct = Math.max(0, 100 - pct);
  doc.setFillColor(...hex2rgb("#E5E7EB"));
  doc.rect(margin + colW * 2 + 16, y + 36, colW - 32, 4, "F");
  doc.setFillColor(...hex2rgb("#DC2626"));
  doc.rect(margin + colW * 2 + 16, y + 36, (colW - 32) * (remPct / 100), 4, "F");
  text(`${Math.round(remPct)}% pending`, margin + colW * 2 + 16, y + 50, { size: 9, bold: true, color: "#DC2626" });

  y += 76;

  // 4. PAYMENT HISTORY SECTION
  text("PAYMENT HISTORY", margin, y, { size: 10, bold: true, color: "#888888" });
  text(`${payments.length} entries`, pageW - margin, y, { size: 11, color: "#999999", align: "right" });
  
  y += 10;
  doc.setLineWidth(2);
  doc.setDrawColor(...hex2rgb("#111111"));
  doc.line(margin, y, pageW - margin, y);

  if (payments.length === 0) {
    y += 40;
    text("No payments recorded yet.", pageW / 2, y, { size: 12, color: "#999999", align: "center" });
  } else {
    // Table Header
    doc.setFillColor(...hex2rgb("#F9FAFB"));
    doc.rect(margin, y, contentW, 28, "F");

    // Colored top border for table
    doc.setFillColor(...hex2rgb("#1C2B4A"));
    doc.rect(margin, y, contentW, 2, "F");

    doc.setLineWidth(1);
    doc.setDrawColor(...hex2rgb("#E5E7EB"));
    doc.line(margin, y + 28, pageW - margin, y + 28);
    
    y += 18;
    const cw1 = contentW * 0.25, cw2 = contentW * 0.20, cw3 = contentW * 0.35, cw4 = contentW * 0.20;
    let cx = margin + 16;
    text("DATE", cx, y, { size: 10, bold: true, color: "#888888" }); cx += cw1;
    text("MODE", cx, y, { size: 10, bold: true, color: "#888888" }); cx += cw2;
    text("NOTE", cx, y, { size: 10, bold: true, color: "#888888" }); cx += cw3;
    text("AMOUNT", pageW - margin - 16, y, { size: 10, bold: true, color: "#888888", align: "right" });
    
    y += 10;

    const sorted = [...payments].sort((a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime());
    
    let isOdd = true;
    for (const p of sorted) {
      ensureSpace(40);
      
      const rowH = 36;
      if (!isOdd) {
        doc.setFillColor(...hex2rgb("#F9FAFB"));
        doc.rect(margin, y, contentW, rowH, "F");
      }
      doc.setDrawColor(...hex2rgb("#F3F4F6"));
      doc.line(margin, y + rowH, pageW - margin, y + rowH);
      
      const ry = y + 22;
      cx = margin + 16;
      text(formatDate(p.payment_date), cx, ry, { size: 13, bold: true, color: "#111111" }); 
      cx += cw1;
      
      const mode = (p.payment_mode || "CASH").toString().toUpperCase();
      doc.setFillColor(...hex2rgb("#EFF6FF")); 
      doc.setDrawColor(...hex2rgb("#BFDBFE"));
      doc.roundedRect(cx, ry - 12, mode === "CASH" ? 44 : 52, 18, 9, 9, "FD");
      text(mode, cx + (mode === "CASH" ? 22 : 26), ry + 1, { size: 9, bold: true, color: "#1D4ED8", align: "center" });
      cx += cw2;
      
      const noteStr = p.payment_note ? p.payment_note : "—";
      text(noteStr.length > 30 ? noteStr.slice(0, 28) + "..." : noteStr, cx, ry, { size: 12, color: p.payment_note ? "#666666" : "#CCCCCC" });
      
      text(rs(Number(p.amount_paid)), pageW - margin - 16, ry, { size: 14, bold: true, color: "#16A34A", align: "right" });
      
      y += rowH;
      isOdd = !isOdd;
    }
    
    // Total Row
    ensureSpace(44);
    doc.setFillColor(...hex2rgb("#F9FAFB"));
    doc.rect(margin, y, contentW, 44, "F");
    doc.setDrawColor(...hex2rgb("#E5E7EB"));
    doc.setLineWidth(2);
    doc.line(margin, y, pageW - margin, y);
    
    text("Total Paid", margin + 16, y + 26, { size: 13, bold: true, color: "#111111" });
    text(rs(b.total_paid), pageW - margin - 16, y + 26, { size: 16, bold: true, color: "#16A34A", align: "right" });
    y += 44;
  }

  // 5. FOOTER (Every Page)
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const fy = pageH - 40;
    
    // Blue + green divider line above footer
    doc.setFillColor(...hex2rgb("#2563EB"));
    doc.rect(margin, fy - 18, (contentW) / 2, 2, "F");
    doc.setFillColor(...hex2rgb("#16A34A"));
    doc.rect(margin + (contentW) / 2, fy - 18, (contentW) / 2, 2, "F");
    
    text(`Ledger  ·  ${b.person_name}`, margin, fy, { size: 10, color: "#AAAAAA" });
    text("CONFIDENTIAL — FOR PERSONAL USE ONLY", pageW / 2, fy, { size: 8, bold: true, color: "#9CA3AF", align: "center" });
    text(`Page ${i} of ${pageCount}`, pageW - margin, fy, { size: 10, color: "#AAAAAA", align: "right" });
  }

  const filename = `${slugify(b.person_name)}-statement.pdf`;
  doc.save(filename);
}
