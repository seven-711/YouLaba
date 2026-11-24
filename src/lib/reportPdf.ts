/**
 * reportPdf.ts
 * Clean, direct, non-technical printable PDF report for shop owners and attendants.
 * Uses standard ASCII characters to avoid garbled glyphs and ambiguous symbols.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  getLocalDateKey,
  type LaundryOrder,
  type PaymentRecord,
  type ShopSettings,
} from '../types/youlaba';

export type ReportPeriod = 'daily' | 'weekly' | 'shift' | 'monthly';

export interface ReportInput {
  period: ReportPeriod;
  fromDate: Date;
  toDate: Date;
  orders: LaundryOrder[];
  payments: PaymentRecord[];
  shopSettings: ShopSettings;
  attendantName: string;
}

// Format currency using standard ASCII "PHP" to prevent broken font glyphs
function formatMoney(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `PHP ${safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function ordersInWindow(orders: LaundryOrder[], from: Date, to: Date): LaundryOrder[] {
  const fromMs = from.getTime();
  const toMs = to.getTime() + 86_400_000;
  return orders.filter((o) => {
    const ms = new Date(o.dropOffAt).getTime();
    return !Number.isNaN(ms) && ms >= fromMs && ms <= toMs;
  });
}

export function generateReportPDF(input: ReportInput): void {
  const { period, fromDate, toDate, orders, payments, shopSettings, attendantName } = input;

  const windowOrders = ordersInWindow(orders, fromDate, toDate);
  const orderIds = new Set(windowOrders.map((o) => o.id));
  const windowPayments = payments.filter((p) => orderIds.has(p.orderId));

  // Core metrics
  const totalOrders = windowOrders.length;
  const paidOrdersCount = windowOrders.filter((o) => o.paymentStatus === 'Paid').length;
  const unpaidOrders = windowOrders.filter(
    (o) => o.paymentStatus === 'Unpaid' || o.paymentStatus === 'Partial'
  );
  const unpaidOrdersCount = unpaidOrders.length;

  const totalSales = windowOrders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
  const totalCollected = windowOrders.reduce((sum, o) => sum + (o.amountPaid || 0), 0);
  const totalUnpaid = Math.max(0, totalSales - totalCollected);

  // Payment methods breakdown
  let cashAmount = 0;
  let gcashAmount = 0;
  let bankAmount = 0;

  for (const p of windowPayments) {
    if (p.method === 'Cash') cashAmount += p.amount;
    else if (p.method === 'GCash') gcashAmount += p.amount;
    else if (p.method === 'Bank Transfer') bankAmount += p.amount;
  }

  // Service breakdown
  const serviceSummary = new Map<string, { count: number; sales: number; collected: number }>();
  for (const o of windowOrders) {
    const cleanName = o.serviceName ? o.serviceName.split('(')[0].trim() : 'Regular Wash';
    const current = serviceSummary.get(cleanName) || { count: 0, sales: 0, collected: 0 };
    current.count += 1;
    current.sales += o.totalPrice || 0;
    current.collected += o.amountPaid || 0;
    serviceSummary.set(cleanName, current);
  }

  // PDF Document Initialization
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  // Title & Header (Clean, professional, high-contrast)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text((shopSettings.shopName || 'YOULABA LAUNDRY').toUpperCase(), margin, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(shopSettings.branchAddress || 'Nazareth, Cagayan de Oro City', margin, y);

  y += 4;
  doc.text(`Contact: ${shopSettings.contactPhone || 'N/A'}`, margin, y);

  // Report Label (Top Right)
  const reportTitle =
    period === 'daily'
      ? 'DAILY SHIFT REPORT'
      : period === 'weekly'
      ? 'WEEKLY SALES REPORT'
      : 'BRANCH SALES REPORT';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(11, 110, 153);
  doc.text(reportTitle, pageW - margin, margin, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const dateRangeStr =
    formatDate(fromDate) === formatDate(toDate)
      ? formatDate(fromDate)
      : `${formatDate(fromDate)} to ${formatDate(toDate)}`;
  doc.text(`Period: ${dateRangeStr}`, pageW - margin, margin + 5, { align: 'right' });
  doc.text(`Printed: ${formatDate(new Date())} ${formatTime(new Date())}`, pageW - margin, margin + 9, {
    align: 'right',
  });

  y += 6;
  doc.setDrawColor(210, 215, 220);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  // Shift Attendant Details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text(`Attendant on Duty: ${attendantName || 'Staff'}`, margin, y);
  doc.text(`Branch: Nazareth Branch`, margin + 90, y);
  y += 6;

  // 1. Direct Financial Summary Table
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Overview Summary', 'Details / Totals']],
    body: [
      ['Total Laundry Orders', `${totalOrders} orders (${paidOrdersCount} Paid, ${unpaidOrdersCount} Unpaid)`],
      ['Total Sales Amount', formatMoney(totalSales)],
      ['Total Money Collected', formatMoney(totalCollected)],
      ['Unpaid / Pending Balances', formatMoney(totalUnpaid)],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, textColor: [30, 30, 30] },
    headStyles: { fillColor: [11, 110, 153], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { fontStyle: 'bold', width: 60 },
      1: { halign: 'left' },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 7;

  // 2. Payments Collected Table (Cash vs Online)
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Payment Method', 'Amount Collected']],
    body: [
      ['Cash Payments', formatMoney(cashAmount)],
      ['GCash Payments', formatMoney(gcashAmount)],
      ['Bank Transfer Payments', formatMoney(bankAmount)],
    ],
    foot: [['Total Collected', formatMoney(totalCollected)]],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, textColor: [30, 30, 30] },
    headStyles: { fillColor: [50, 60, 70], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [240, 245, 250], textColor: [10, 10, 10], fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right', fontStyle: 'bold' },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 7;

  // 3. Service Breakdown
  const serviceRows = Array.from(serviceSummary.entries()).map(([name, data]) => [
    name,
    String(data.count),
    formatMoney(data.sales),
    formatMoney(data.collected),
    formatMoney(data.sales - data.collected),
  ]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Service Name', 'Orders', 'Total Sales', 'Collected', 'Balance']],
    body: serviceRows.length > 0 ? serviceRows : [['No orders recorded for this period', '0', '0.00', '0.00', '0.00']],
    foot: [
      [
        'Total',
        String(totalOrders),
        formatMoney(totalSales),
        formatMoney(totalCollected),
        formatMoney(totalUnpaid),
      ],
    ],
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5, textColor: [30, 30, 30] },
    headStyles: { fillColor: [11, 110, 153], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [240, 245, 250], textColor: [10, 10, 10], fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 7;

  // 4. Unpaid Customers List (Only printed if there are unpaid orders)
  if (unpaidOrders.length > 0) {
    if (y > pageH - 60) {
      doc.addPage();
      y = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(180, 20, 20);
    doc.text(`Unpaid Customer Balances (${unpaidOrders.length} Order${unpaidOrders.length > 1 ? 's' : ''})`, margin, y);
    y += 3;

    const unpaidRows = unpaidOrders.map((o) => {
      const balance = Math.max(0, (o.totalPrice || 0) - (o.amountPaid || 0));
      return [
        o.claimSlipNumber || '—',
        o.customerName || 'Walk-in Customer',
        o.customerPhone || '—',
        formatMoney(o.totalPrice),
        formatMoney(o.amountPaid),
        formatMoney(balance),
      ];
    });

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Claim Slip', 'Customer Name', 'Phone', 'Total', 'Paid', 'Balance Due']],
      body: unpaidRows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 30, 30] },
      headStyles: { fillColor: [180, 40, 40], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // 5. Verification Signatures (Bottom section)
  if (y > pageH - 45) {
    doc.addPage();
    y = margin + 10;
  } else {
    y += 6;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);

  const sigBoxW = (contentW - 20) / 2;
  const sigLeft = margin;
  const sigRight = margin + sigBoxW + 20;

  // Attendant Sign line
  doc.line(sigLeft, y + 14, sigLeft + sigBoxW, y + 14);
  doc.text(`Prepared By: ${attendantName || 'Attendant'}`, sigLeft, y + 19);
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  doc.text('Attendant Signature over Printed Name', sigLeft, y + 23);

  // Owner Sign line
  doc.setFontSize(8.5);
  doc.setTextColor(50, 50, 50);
  doc.line(sigRight, y + 14, sigRight + sigBoxW, y + 14);
  doc.text('Checked & Received By:', sigRight, y + 19);
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  doc.text('Owner / Supervisor Signature', sigRight, y + 23);

  // Page Numbers Footer
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(130, 130, 130);
    doc.text(
      `YouLaba Nazareth - ${reportTitle} - Page ${i} of ${pageCount}`,
      pageW / 2,
      pageH - 8,
      { align: 'center' }
    );
  }

  // Trigger browser download
  const safeDate = getLocalDateKey(fromDate);
  doc.save(`YouLaba_${period}_report_${safeDate}.pdf`);
}
