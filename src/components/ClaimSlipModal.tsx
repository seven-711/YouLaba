import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Printer, Tag, Receipt, X } from 'lucide-react';
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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback ignored silently if clipboard blocked in sandbox
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Claim slip and laundry bag tag"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden shadow-xl">
        {/* Modal Header (hidden on print) */}
        <div className="no-print flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              {isPublicView ? 'Digital Claim Slip' : 'Claim Slip & Bag Tag'}
            </h3>
            <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
              {order.claimSlipNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher (Staff only can print Bag Tag too) */}
        {!isPublicView && (
          <div className="no-print px-5 pt-4">
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setPrintMode('slip')}
                className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  printMode === 'slip'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                Customer Claim Slip
              </button>
              <button
                type="button"
                onClick={() => setPrintMode('tag')}
                className={`inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  printMode === 'tag'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                Laundry Bag Tag
              </button>
            </div>
          </div>
        )}

        {/* Printable Thermal Receipt / Bag Tag */}
        <div className="p-5">
          <div
            id="youlaba-printable-slip"
            className="border border-dashed border-slate-300 rounded-lg p-5 bg-slate-50/50 text-slate-900"
          >
            {printMode === 'slip' ? (
              <div>
                <div className="text-center pb-4 border-b border-dashed border-slate-300">
                  <p className="font-display text-lg font-extrabold tracking-tight text-slate-900">
                    {shopSettings.shopName}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {shopSettings.branchAddress}
                  </p>
                  <p className="text-xs text-slate-500 font-mono tabular-nums">
                    {shopSettings.contactPhone} · {shopSettings.operatingHours}
                  </p>
                </div>

                <div className="py-4 border-b border-dashed border-slate-300 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Claim Slip Number</p>
                    <p className="font-mono text-xl font-bold tracking-tight text-slate-900 tabular-nums mt-0.5">
                      {order.claimSlipNumber}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Customer: <span className="font-semibold text-slate-900">{customerDisplay}</span>
                    </p>
                    {isFullOrder(order) && (
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {order.customerPhone}
                      </p>
                    )}
                  </div>
                  <div className="bg-white p-2 border border-slate-200 rounded-md shrink-0">
                    <QRCodeSVG value={trackingUrl} size={72} level="M" />
                  </div>
                </div>

                <div className="py-3.5 space-y-2 text-xs border-b border-dashed border-slate-300">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Service</span>
                    <span className="font-medium text-slate-900 text-right">{order.serviceName}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Weight / Quantity</span>
                    <span className="font-mono tabular-nums text-slate-900">
                      {order.quantity} {order.pricingUnit} ({order.bagCount} bag{order.bagCount > 1 ? 's' : ''})
                    </span>
                  </div>
                  {isFullOrder(order) && order.itemsSummary && (
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-500 shrink-0">Items</span>
                      <span className="text-slate-700 text-right">{order.itemsSummary}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Drop-Off Time</span>
                    <span className="font-mono tabular-nums text-slate-900 text-right">
                      {formatDateTime(order.dropOffAt)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Est. Claim Time</span>
                    <span className="font-mono tabular-nums font-semibold text-[#0B6E99] text-right">
                      {formatDateTime(order.estimatedClaimAt)}
                    </span>
                  </div>
                  {order.claimedAt && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Actual Claimed</span>
                      <span className="font-mono tabular-nums font-semibold text-emerald-700 text-right">
                        {formatDateTime(order.claimedAt)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="py-3.5 space-y-1.5 text-xs border-b border-dashed border-slate-300">
                  {isFullOrder(order) && order.discountAmount > 0 && (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>Subtotal</span>
                        <span className="font-mono tabular-nums">{formatPHP(order.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-emerald-700">
                        <span>Discount {order.promoCode ? `(${order.promoCode})` : ''}</span>
                        <span className="font-mono tabular-nums">-{formatPHP(order.discountAmount)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-sm font-bold text-slate-900 pt-1">
                    <span>Total Amount</span>
                    <span className="font-mono tabular-nums">{formatPHP(order.totalPrice)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Payment Status</span>
                    <span className="font-semibold text-slate-900">
                      {order.paymentStatus}
                      {isFullOrder(order) && order.paymentMethod !== 'None'
                        ? ` · ${order.paymentMethod}`
                        : ''}
                    </span>
                  </div>
                  {isFullOrder(order) && order.amountPaid > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Amount Paid</span>
                      <span className="font-mono tabular-nums">{formatPHP(order.amountPaid)}</span>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 text-center pt-3 leading-relaxed">
                  Scan QR or enter <span className="font-mono font-semibold text-slate-700">{order.claimSlipNumber}</span> on the YouLaba website to track live laundry status. Please present this slip upon claiming.
                </p>
              </div>
            ) : (
              /* Laundry Bag Tag / Label Layout */
              <div className="text-center space-y-3">
                <div className="border-b-2 border-slate-900 pb-2">
                  <p className="text-xs font-semibold tracking-wide text-slate-600">
                    YOULABA LAUNDRY BAG TAG
                  </p>
                  <p className="font-mono text-2xl font-extrabold tracking-tight text-slate-900 tabular-nums mt-1">
                    {order.claimSlipNumber}
                  </p>
                </div>

                <div className="flex justify-center py-2">
                  <div className="bg-white p-2 border border-slate-300 rounded">
                    <QRCodeSVG value={order.claimSlipNumber} size={96} level="H" />
                  </div>
                </div>

                <div className="text-left space-y-1.5 text-xs border-t border-dashed border-slate-300 pt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Customer</span>
                    <span className="font-bold text-slate-900">{customerDisplay}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Service</span>
                    <span className="font-semibold text-slate-900">{order.serviceName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Load / Bags</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {order.quantity} {order.pricingUnit} · {order.bagCount} BAG{order.bagCount > 1 ? 'S' : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Target Ready</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatDateTime(order.estimatedClaimAt)}
                    </span>
                  </div>
                  {isFullOrder(order) && order.specialInstructions && (
                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-slate-500 block">Handling Notes:</span>
                      <span className="font-semibold text-slate-900">{order.specialInstructions}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Footer (hidden on print) */}
        <div className="no-print px-5 pb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Link Copied' : 'Copy Track Link'}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] rounded-lg transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Print {printMode === 'slip' ? 'Claim Slip' : 'Bag Tag'}
          </button>
        </div>
      </div>
    </div>
  );
}
