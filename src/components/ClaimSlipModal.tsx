import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Check,
  Clock,
  Copy,
  Printer,
  Receipt,
  Tag,
  X,
  AlertCircle,
  Phone,
} from 'lucide-react';
import {
  formatDateTime,
  formatPHP,
  type LaundryOrder,
  type OrderTrackingPublic,
  type ShopSettings,
} from '../types/youlaba';

interface ClaimSlipModalProps {
  order: LaundryOrder | OrderTrackingPublic;
  shopSettings: ShopSettings;
  isPublicView?: boolean;
  onClose: () => void;
}

function isFullOrder(o: LaundryOrder | OrderTrackingPublic): o is LaundryOrder {
  return 'customerPhone' in o;
}

export function ClaimSlipModal({
  order,
  shopSettings,
  isPublicView = false,
  onClose,
}: ClaimSlipModalProps) {
  const [printMode, setPrintMode] = useState<'slip' | 'tag'>('slip');
  const [copied, setCopied] = useState(false);

  const trackingUrl = `${window.location.origin}${window.location.pathname}?track=${encodeURIComponent(
    order.claimSlipNumber
  )}`;

  const customerDisplay = isFullOrder(order)
    ? order.customerName
    : order.customerLabel;

  const isPaid = order.paymentStatus === 'Paid';
  const isPartial = order.paymentStatus === 'Partial';
  const balanceDue = isFullOrder(order)
    ? Math.max(0, order.totalPrice - (order.amountPaid || 0))
    : 0;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored silently
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Customer Claim Slip"
    >
      <div className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[94vh]">
        {/* Modal Top Bar (Screen Only) */}
        <div className="no-print flex items-center justify-between px-5 py-3.5 bg-slate-50/80 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-[#0B6E99]/10 text-[#0B6E99]">
              <Receipt className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                {isPublicView ? 'Official Claim Slip' : 'Branch Receipt & Bag Tag'}
              </h3>
              <p className="text-[11px] font-mono text-slate-500">{order.claimSlipNumber}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher for Staff (Screen Only) */}
        {!isPublicView && (
          <div className="no-print px-5 pt-3.5 pb-1 bg-white">
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => setPrintMode('slip')}
                className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
                  printMode === 'slip'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Receipt className="w-3.5 h-3.5 text-[#0B6E99]" />
                Customer Claim Slip
              </button>
              <button
                type="button"
                onClick={() => setPrintMode('tag')}
                className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
                  printMode === 'tag'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <Tag className="w-3.5 h-3.5 text-amber-600" />
                Laundry Bag Tag
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Receipt Area */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-slate-100/40">
          <div
            id="youlaba-printable-slip"
            className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 text-slate-900 font-sans relative overflow-hidden"
          >
            {printMode === 'slip' ? (
              /* ================== CUSTOMER CLAIM SLIP ================== */
              <div className="space-y-4">
                {/* 1. Shop Header */}
                <div className="text-center pb-3 border-b border-dashed border-slate-300">
                  <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                    {shopSettings.shopName || 'YouLaba Laundry'}
                  </h2>
                  <p className="text-xs text-slate-600 font-medium mt-0.5">
                    {shopSettings.branchAddress}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                    Tel: {shopSettings.contactPhone} &bull; {shopSettings.operatingHours}
                  </p>
                </div>

                {/* 2. Claim Number & QR Code */}
                <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      Claim Slip Number
                    </span>
                    <span className="font-mono text-xl sm:text-2xl font-black text-slate-900 tracking-tight block truncate mt-0.5">
                      {order.claimSlipNumber}
                    </span>
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-700">
                      <span className="font-semibold text-slate-900 truncate">
                        {customerDisplay}
                      </span>
                    </div>
                    {isFullOrder(order) && order.customerPhone && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {order.customerPhone}
                      </div>
                    )}
                  </div>

                  {/* High Quality QR */}
                  <div className="bg-white p-1.5 border border-slate-200 rounded-lg shrink-0 text-center shadow-xs">
                    <QRCodeSVG value={trackingUrl} size={68} level="M" />
                    <span className="block text-[8px] font-semibold text-slate-500 tracking-tight mt-1">
                      SCAN TO TRACK
                    </span>
                  </div>
                </div>

                {/* 3. Expected Ready Highlight Card */}
                <div className="bg-[#0B6E99]/5 border border-[#0B6E99]/20 rounded-xl p-3 flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-[#0B6E99] shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#0B6E99] uppercase tracking-wide">
                        Target Ready Time
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-[#0B6E99] border border-[#0B6E99]/30">
                        {order.status}
                      </span>
                    </div>
                    <p className="font-mono text-xs sm:text-sm font-bold text-slate-900 mt-0.5">
                      {formatDateTime(order.estimatedClaimAt)}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Dropped off: {formatDateTime(order.dropOffAt)}
                    </p>
                  </div>
                </div>

                {/* 4. Order Details List */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Service Selected</span>
                    <span className="font-semibold text-slate-900 text-right">
                      {order.serviceName}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Quantity / Load</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {order.quantity} {order.pricingUnit} &bull; {order.bagCount} Bag{order.bagCount > 1 ? 's' : ''}
                    </span>
                  </div>

                  {isFullOrder(order) && order.itemsSummary && (
                    <div className="flex items-start justify-between pb-2 border-b border-slate-100 gap-4">
                      <span className="text-slate-500 font-medium shrink-0">Items Summary</span>
                      <span className="text-slate-700 text-right text-[11px] font-medium leading-relaxed">
                        {order.itemsSummary}
                      </span>
                    </div>
                  )}

                  {isFullOrder(order) && order.specialInstructions && (
                    <div className="pt-1">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg p-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">Note: {order.specialInstructions}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Pricing & Payment Breakdown */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                  {isFullOrder(order) && order.discountAmount > 0 && (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>Original Subtotal</span>
                        <span className="font-mono tabular-nums">{formatPHP(order.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700 font-medium">
                        <span>Discount {order.promoCode ? `(${order.promoCode})` : ''}</span>
                        <span className="font-mono tabular-nums">-{formatPHP(order.discountAmount)}</span>
                      </div>
                    </>
                  )}

                  <div className="flex items-baseline justify-between pt-1 border-t border-slate-200">
                    <span className="text-sm font-bold text-slate-900">Total Billed</span>
                    <span className="font-mono text-lg font-black text-slate-900 tabular-nums">
                      {formatPHP(order.totalPrice)}
                    </span>
                  </div>

                  {/* Payment Status Pill */}
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">Payment Status</span>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-md ${
                        isPaid
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : isPartial
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {isPaid && <Check className="w-3 h-3" />}
                      {order.paymentStatus}
                      {isFullOrder(order) && order.paymentMethod !== 'None'
                        ? ` (${order.paymentMethod})`
                        : ''}
                    </span>
                  </div>

                  {/* Outstanding Balance if not fully paid */}
                  {!isPaid && balanceDue > 0 && (
                    <div className="mt-1 pt-2 border-t border-dashed border-rose-200 flex items-center justify-between text-xs text-rose-700 font-bold">
                      <span>Remaining Balance Due:</span>
                      <span className="font-mono text-sm tabular-nums">
                        {formatPHP(balanceDue)}
                      </span>
                    </div>
                  )}
                </div>

                {/* 6. Footer Terms & Notice */}
                <div className="pt-2 text-center text-[10px] text-slate-500 space-y-1">
                  <div className="border-t border-dashed border-slate-300 my-2" />
                  <p className="font-medium text-slate-600">
                    Please present this claim slip or digital QR code upon claiming.
                  </p>
                  <p className="text-slate-400">
                    Items unclaimed after 30 days are subject to disposal policy. Thank you!
                  </p>
                </div>
              </div>
            ) : (
              /* ================== LAUNDRY BAG TAG ================== */
              <div className="text-center space-y-3.5 py-1">
                <div className="border-b-2 border-slate-900 pb-2">
                  <div className="inline-block bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-sm">
                    BAG IDENTIFICATION TAG
                  </div>
                  <p className="font-mono text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
                    {order.claimSlipNumber}
                  </p>
                </div>

                <div className="flex justify-center py-1">
                  <div className="bg-white p-2.5 border-2 border-slate-900 rounded-lg shadow-xs">
                    <QRCodeSVG value={order.claimSlipNumber} size={110} level="H" />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-left space-y-2 text-xs">
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500 font-medium">Customer</span>
                    <span className="font-bold text-slate-900 truncate max-w-[180px]">
                      {customerDisplay}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500 font-medium">Service</span>
                    <span className="font-semibold text-slate-900">{order.serviceName}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500 font-medium">Load Count</span>
                    <span className="font-mono font-bold text-slate-900">
                      {order.quantity} {order.pricingUnit} &bull; {order.bagCount} BAG{order.bagCount > 1 ? 'S' : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Target Ready</span>
                    <span className="font-mono font-bold text-[#0B6E99]">
                      {formatDateTime(order.estimatedClaimAt)}
                    </span>
                  </div>

                  {isFullOrder(order) && order.specialInstructions && (
                    <div className="pt-2 border-t border-slate-200 text-amber-900 font-medium bg-amber-50 p-2 rounded-lg">
                      <span className="block text-[10px] uppercase font-bold text-amber-700">
                        Special Instructions:
                      </span>
                      {order.specialInstructions}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Buttons (Screen Only) */}
        <div className="no-print p-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-500" />
            )}
            {copied ? 'Link Copied!' : 'Copy Tracking Link'}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#0B6E99] hover:bg-[#085A7E] active:scale-[0.98] rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print {printMode === 'slip' ? 'Claim Slip' : 'Bag Tag'}
          </button>
        </div>
      </div>
    </div>
  );
}
