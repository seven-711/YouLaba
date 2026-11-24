import type { Timestamp } from 'firebase/firestore';

export const BOOTSTRAP_OWNER_EMAIL = 'claridadjulyfranz@gmail.com';

export type UserRole = 'owner' | 'staff' | 'pending';
export type PricingUnit = 'kg' | 'load' | 'piece';
export type ServiceCategory = 'Regular' | 'Express' | 'Specialty';
export type OrderStatus =
  | 'Received'
  | 'Washing'
  | 'Drying'
  | 'Folding/Ironing'
  | 'Ready for Pickup'
  | 'Claimed';
export type PaymentStatus = 'Unpaid' | 'Partial' | 'Paid';
export type PaymentMethod = 'None' | 'Cash' | 'GCash' | 'Bank Transfer';
export type PaidMethod = 'Cash' | 'GCash' | 'Bank Transfer';
export type StatusLogAction =
  | 'ORDER_CREATED'
  | 'STATUS_UPDATED'
  | 'PAYMENT_RECORDED'
  | 'ORDER_CLAIMED'
  | 'ORDER_CORRECTED';
export type FeedbackCategory =
  | 'Service Quality'
  | 'Turnaround Time'
  | 'Garment Care'
  | 'System Issue'
  | 'Suggestion';
export type FeedbackStatus = 'Open' | 'Reviewed' | 'Resolved';

export const ORDER_STAGES: OrderStatus[] = [
  'Received',
  'Washing',
  'Drying',
  'Folding/Ironing',
  'Ready for Pickup',
  'Claimed',
];

export const PAID_METHODS: PaidMethod[] = ['Cash', 'GCash', 'Bank Transfer'];

export const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  'Service Quality',
  'Turnaround Time',
  'Garment Care',
  'System Issue',
  'Suggestion',
];

export interface UserAccount {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ServiceRate {
  id: string;
  name: string;
  description: string;
  pricingUnit: PricingUnit;
  rate: number;
  minQuantity: number;
  turnaroundHours: number;
  category: ServiceCategory;
  active: boolean;
  updatedAt?: Timestamp | null;
}

export interface ShopSettings {
  shopName: string;
  branchAddress: string;
  contactPhone: string;
  operatingHours: string;
  defaultTurnaroundHours: number;
  unclaimedAlertHours: number;
  activePromoCode: string;
  activePromoPercent: number;
  activePromoLabel: string;
  updatedAt?: Timestamp | null;
}

export interface Customer {
  id: string;
  fullName: string;
  contactNumber: string;
  notes: string;
  totalOrders: number;
  createdByUid: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface LaundryOrder {
  id: string;
  claimSlipNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  serviceName: string;
  pricingUnit: PricingUnit;
  unitRate: number;
  quantity: number;
  bagCount: number;
  itemsSummary: string;
  specialInstructions: string;
  subtotal: number;
  discountAmount: number;
  promoCode: string;
  totalPrice: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  dropOffAt: string;
  estimatedClaimAt: string;
  claimedAt: string;
  createdByUid: string;
  createdByName: string;
  updatedByUid: string;
  updatedByName: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface OrderTrackingPublic {
  claimSlipNumber: string;
  customerLabel: string;
  serviceName: string;
  pricingUnit: PricingUnit;
  quantity: number;
  bagCount: number;
  totalPrice: number;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  dropOffAt: string;
  estimatedClaimAt: string;
  claimedAt: string;
  updatedAt?: Timestamp | null;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  claimSlipNumber: string;
  amount: number;
  amountTendered: number;
  changeGiven: number;
  method: PaidMethod;
  notes: string;
  recordedByUid: string;
  recordedByName: string;
  createdAt?: Timestamp | null;
}

export interface StatusLog {
  id: string;
  orderId: string;
  claimSlipNumber: string;
  action: StatusLogAction;
  fromStatus: string;
  toStatus: string;
  note: string;
  actorUid: string;
  actorName: string;
  actorRole: 'owner' | 'staff';
  createdAt?: Timestamp | null;
}

export interface FeedbackEntry {
  id: string;
  authorName: string;
  authorRole: 'customer' | 'staff';
  claimSlipNumber: string;
  rating: number;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  createdAt?: Timestamp | null;
}

export interface DailyReconciliation {
  id: string;
  dateKey: string;
  systemCashTotal: number;
  actualCashCounted: number;
  cashVariance: number;
  systemBagCount: number;
  actualBagCount: number;
  bagVariance: number;
  notes: string;
  checkedByUid: string;
  checkedByName: string;
  createdAt?: Timestamp | null;
}

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  shopName: 'YouLaba',
  branchAddress: '14th–15th Street, Barangay Nazareth, Cagayan de Oro City',
  contactPhone: '0917-542-8810',
  operatingHours: 'Monday – Sunday, 7:00 AM – 8:00 PM',
  defaultTurnaroundHours: 24,
  unclaimedAlertHours: 48,
  activePromoCode: 'NAZARETH10',
  activePromoPercent: 10,
  activePromoLabel: '10% off for regular weekly loads',
};

export const DEFAULT_SERVICES: Omit<ServiceRate, 'updatedAt'>[] = [
  {
    id: 'svc-wash-dry-fold',
    name: 'Wash, Dry & Fold (Regular)',
    description: 'Full-service machine wash with hypoallergenic detergent, tumble dry, and crisp folding.',
    pricingUnit: 'kg',
    rate: 38,
    minQuantity: 3,
    turnaroundHours: 24,
    category: 'Regular',
    active: true,
  },
  {
    id: 'svc-express-sameday',
    name: 'Express Same-Day Wash & Fold',
    description: 'Priority queue washing, drying, and folding ready within 6 hours for urgent loads.',
    pricingUnit: 'kg',
    rate: 60,
    minQuantity: 3,
    turnaroundHours: 6,
    category: 'Express',
    active: true,
  },
  {
    id: 'svc-wash-dry-press',
    name: 'Wash, Dry & Steam Press',
    description: 'Ideal for office uniforms, polos, barongs, and school wear needing crisp steam pressing.',
    pricingUnit: 'kg',
    rate: 65,
    minQuantity: 2,
    turnaroundHours: 36,
    category: 'Specialty',
    active: true,
  },
  {
    id: 'svc-comforter-bulky',
    name: 'Comforter, Duvet & Beddings',
    description: 'Deep-sanitizing heavy-drum wash and extended gentle drying for comforters and blankets.',
    pricingUnit: 'load',
    rate: 220,
    minQuantity: 1,
    turnaroundHours: 48,
    category: 'Specialty',
    active: true,
  },
  {
    id: 'svc-self-drop-load',
    name: 'Full Load Bundle (Up to 7 kg)',
    description: 'Flat-rate single drum wash, dry, and fold bundle for student dorms and weekly households.',
    pricingUnit: 'load',
    rate: 235,
    minQuantity: 1,
    turnaroundHours: 24,
    category: 'Regular',
    active: true,
  },
];

// Blueprint-synchronized regex patterns & sanitizers
export const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
export const VALID_CLAIM_SLIP_REGEX = /^[A-Z0-9-]+$/;
export const VALID_PHONE_REGEX = /^[0-9+\-\s()]{7,20}$/;

export function sanitizeStr(val: string, maxLen: number): string {
  return val.trim().slice(0, maxLen);
}

export function normalizeClaimSlip(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32);
}

export function maskCustomerLabel(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Customer';
  if (parts.length === 1) return parts[0].slice(0, 20);
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0] || '';
  return `${first} ${lastInitial}.`.slice(0, 40);
}

export function generateClaimSlipNumber(existingCodes: string[]): string {
  const year = new Date().getFullYear();
  const prefix = `YL-${year}-`;
  let maxNum = 0;
  for (const code of existingCodes) {
    if (code.startsWith(prefix)) {
      const parsed = parseInt(code.slice(prefix.length), 10);
      if (!Number.isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }
  const next = maxNum + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

export function computeOrderPrice(
  rate: number,
  quantity: number,
  minQuantity: number,
  discountAmount: number
): { billableQty: number; subtotal: number; discount: number; total: number } {
  const safeQty = Math.max(0, Number.isFinite(quantity) ? quantity : 0);
  const billableQty = Math.max(safeQty, minQuantity);
  const subtotal = Math.round(billableQty * rate * 100) / 100;
  const discount = Math.min(subtotal, Math.max(0, Math.round(discountAmount * 100) / 100));
  const total = Math.max(0, Math.round((subtotal - discount) * 100) / 100);
  return { billableQty, subtotal, discount, total };
}

export function computeEstimatedClaimIso(dropOffDate: Date, turnaroundHours: number): string {
  const ms = dropOffDate.getTime() + Math.max(1, turnaroundHours) * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

export function formatPHP(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₱${safe.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatShortDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

export function getLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isOrderOverdue(order: LaundryOrder, now = new Date()): boolean {
  if (order.status === 'Claimed' || order.status === 'Ready for Pickup') return false;
  const est = new Date(order.estimatedClaimAt);
  return !Number.isNaN(est.getTime()) && now.getTime() > est.getTime();
}

export function isOrderUnclaimedAlert(
  order: LaundryOrder,
  alertHours = 48,
  now = new Date()
): boolean {
  if (order.status !== 'Ready for Pickup') return false;
  const refDate = new Date(order.estimatedClaimAt);
  if (Number.isNaN(refDate.getTime())) return false;
  return now.getTime() - refDate.getTime() >= alertHours * 60 * 60 * 1000;
}

export function getStageIndex(status: OrderStatus): number {
  return ORDER_STAGES.indexOf(status);
}

export function ordersToCsv(orders: LaundryOrder[]): string {
  const headers = [
    'Claim Slip Number',
    'Customer Name',
    'Contact Number',
    'Service Type',
    'Quantity',
    'Unit',
    'Bags',
    'Items Summary',
    'Subtotal (PHP)',
    'Discount (PHP)',
    'Total Price (PHP)',
    'Amount Paid (PHP)',
    'Payment Status',
    'Payment Method',
    'Order Status',
    'Drop-Off Time',
    'Estimated Claim Time',
    'Actual Claim Time',
    'Recorded By',
  ];

  const escapeCsv = (value: string | number) => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = orders.map((o) =>
    [
      o.claimSlipNumber,
      o.customerName,
      o.customerPhone,
      o.serviceName,
      o.quantity,
      o.pricingUnit,
      o.bagCount,
      o.itemsSummary,
      o.subtotal.toFixed(2),
      o.discountAmount.toFixed(2),
      o.totalPrice.toFixed(2),
      o.amountPaid.toFixed(2),
      o.paymentStatus,
      o.paymentMethod,
      o.status,
      o.dropOffAt,
      o.estimatedClaimAt,
      o.claimedAt || '',
      o.createdByName,
    ]
      .map(escapeCsv)
      .join(',')
  );

  // UTF-8 BOM ensures Excel & Google Sheets open cleanly
  return '\uFEFF' + [headers.join(','), ...rows].join('\n');
}

export interface SpreadsheetMismatch {
  claimSlipNumber: string;
  type: 'Missing in System' | 'Status Mismatch' | 'Total Mismatch' | 'Payment Mismatch';
  sheetValue: string;
  systemValue: string;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function compareSpreadsheetCsvToOrders(
  csvText: string,
  systemOrders: LaundryOrder[]
): { checkedRows: number; matchedRows: number; mismatches: SpreadsheetMismatch[] } {
  const cleaned = csvText.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return { checkedRows: 0, matchedRows: 0, mismatches: [] };

  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { checkedRows: 0, matchedRows: 0, mismatches: [] };

  const headerCells = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const slipIdx = headerCells.findIndex((h) => h.includes('claim slip') || h.includes('order'));
  const totalIdx = headerCells.findIndex((h) => h.includes('total'));
  const statusIdx = headerCells.findIndex((h) => h === 'order status' || h === 'status');
  const payIdx = headerCells.findIndex((h) => h.includes('payment status'));

  const bySlip = new Map<string, LaundryOrder>();
  systemOrders.forEach((o) => bySlip.set(o.claimSlipNumber.toUpperCase(), o));

  const mismatches: SpreadsheetMismatch[] = [];
  let checkedRows = 0;
  let matchedRows = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const slip = (cols[slipIdx >= 0 ? slipIdx : 0] || '').toUpperCase().trim();
    if (!slip) continue;
    checkedRows++;

    const sys = bySlip.get(slip);
    if (!sys) {
      mismatches.push({
        claimSlipNumber: slip,
        type: 'Missing in System',
        sheetValue: 'Present in spreadsheet',
        systemValue: 'Not found in database',
      });
      continue;
    }

    let rowHasMismatch = false;
    if (totalIdx >= 0 && cols[totalIdx]) {
      const sheetTotal = parseFloat(cols[totalIdx].replace(/[^0-9.-]/g, ''));
      if (!Number.isNaN(sheetTotal) && Math.abs(sheetTotal - sys.totalPrice) > 0.01) {
        rowHasMismatch = true;
        mismatches.push({
          claimSlipNumber: slip,
          type: 'Total Mismatch',
          sheetValue: formatPHP(sheetTotal),
          systemValue: formatPHP(sys.totalPrice),
        });
      }
    }

    if (statusIdx >= 0 && cols[statusIdx]) {
      if (cols[statusIdx].toLowerCase() !== sys.status.toLowerCase()) {
        rowHasMismatch = true;
        mismatches.push({
          claimSlipNumber: slip,
          type: 'Status Mismatch',
          sheetValue: cols[statusIdx],
          systemValue: sys.status,
        });
      }
    }

    if (payIdx >= 0 && cols[payIdx]) {
      if (cols[payIdx].toLowerCase() !== sys.paymentStatus.toLowerCase()) {
        rowHasMismatch = true;
        mismatches.push({
          claimSlipNumber: slip,
          type: 'Payment Mismatch',
          sheetValue: cols[payIdx],
          systemValue: sys.paymentStatus,
        });
      }
    }

    if (!rowHasMismatch) matchedRows++;
  }

  return { checkedRows, matchedRows, mismatches };
}
