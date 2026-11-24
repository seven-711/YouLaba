import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  MapPin,
  Phone,
  Printer,
  Search,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  formatDateTime,
  formatPHP,
  getStageIndex,
  normalizeClaimSlip,
  ORDER_STAGES,
  type OrderStatus,
  type OrderTrackingPublic,
  type ShopSettings,
} from '../types/youlaba';
import { ClaimSlipModal } from './ClaimSlipModal';

interface OrderStatusPageProps {
  initialClaimSlip?: string;
  shopSettings: ShopSettings;
  isAuthenticatedStaff: boolean;
  onNavigateHome: (sectionHash?: string) => void;
  onOpenPortal: () => void;
  onClaimSlipChange: (code: string) => void;
}

const STAGE_DESCRIPTIONS: Record<OrderStatus, string> = {
  Received: 'Logged at our Nazareth counter and queued for sorting and washing.',
  Washing: 'Your garments are currently going through their wash and rinse cycle.',
  Drying: 'Wash cycle complete. Your laundry is currently drying.',
  'Folding/Ironing': 'Dry and fresh. Our attendants are folding and preparing your items.',
  'Ready for Pickup': 'Your laundry is packed and waiting at the Nazareth counter for pickup.',
  Claimed: 'This order has been released and claimed. Thank you for choosing YouLaba.',
};

export function OrderStatusPage({
  initialClaimSlip = '',
  shopSettings,
  isAuthenticatedStaff,
  onNavigateHome,
  onOpenPortal,
  onClaimSlipChange,
}: OrderStatusPageProps) {
  const [inputCode, setInputCode] = useState(normalizeClaimSlip(initialClaimSlip));
  const [activeCode, setActiveCode] = useState(normalizeClaimSlip(initialClaimSlip));
  const [order, setOrder] = useState<OrderTrackingPublic | null>(null);
  const [loading, setLoading] = useState(Boolean(normalizeClaimSlip(initialClaimSlip)));
  const [notFound, setNotFound] = useState(false);
  const [inputError, setInputError] = useState('');
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Keep synced if parent passes a new code (e.g. browser back/forward)
  useEffect(() => {
    const normalized = normalizeClaimSlip(initialClaimSlip);
    setInputCode(normalized);
    setActiveCode(normalized);
  }, [initialClaimSlip]);

  // Real-time Firestore listener on single PII-isolated document (get-only)
  useEffect(() => {
    if (!activeCode || activeCode.length < 5) {
      setOrder(null);
      setLoading(false);
      setNotFound(false);
      return;
    }

    setLoading(true);
    setNotFound(false);
    const path = `orderTracking/${activeCode}`;

    const unsub = onSnapshot(
      doc(db, 'orderTracking', activeCode),
      (snap) => {
        if (snap.exists()) {
          setOrder(snap.data() as OrderTrackingPublic);
          setNotFound(false);
        } else {
          setOrder(null);
          setNotFound(true);
        }
        setLoading(false);
      },
      (error) => {
        setLoading(false);
        handleFirestoreError(error, OperationType.GET, path);
      }
    );

    return () => unsub();
  }, [activeCode]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    setInputError('');
    const cleaned = normalizeClaimSlip(inputCode);
    if (cleaned.length < 5) {
      setInputError('Enter your Claim Slip Number (at least 5 characters, e.g. YL-2026-0001).');
      return;
    }
    setInputCode(cleaned);
    setActiveCode(cleaned);
    onClaimSlipChange(cleaned);
  };

  const trySampleSlip = () => {
    const sample = `YL-${new Date().getFullYear()}-0001`;
    setInputError('');
    setInputCode(sample);
    setActiveCode(sample);
    onClaimSlipChange(sample);
  };

  const handleCopyShareLink = async () => {
    if (!order) return;
    const url = `${window.location.origin}${window.location.pathname}?track=${encodeURIComponent(
      order.claimSlipNumber
    )}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in sandbox
    }
  };

  const stageIdx = order ? getStageIndex(order.status) : -1;
  const progressPercent =
    stageIdx >= 0 ? Math.round(((stageIdx + 1) / ORDER_STAGES.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => onNavigateHome()}
            className="font-display text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            {shopSettings.shopName}
          </button>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => onNavigateHome()}
              className="hover:text-[#0B6E99] transition-colors whitespace-nowrap shrink-0"
            >
              Home
            </button>
            <span className="text-[#0B6E99] font-semibold whitespace-nowrap shrink-0">
              Order Status
            </span>
            <button
              type="button"
              onClick={() => onNavigateHome('services')}
              className="hover:text-[#0B6E99] transition-colors whitespace-nowrap shrink-0"
            >
              Services & Rates
            </button>
            <button
              type="button"
              onClick={() => onNavigateHome('feedback')}
              className="hover:text-[#0B6E99] transition-colors whitespace-nowrap shrink-0"
            >
              Feedback
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={onOpenPortal}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {isAuthenticatedStaff ? 'Open Counter Workspace' : 'Staff Portal'}
            </button>
          </div>
        </div>
      </header>

      {/* Focused, Direct Single-Column Reading Experience */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10 sm:py-14 space-y-8">
        <div>
          <button
            type="button"
            onClick={() => onNavigateHome()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to YouLaba Home
          </button>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 text-balance">
            Laundry Order Status
          </h1>
          <p className="text-sm text-slate-600 mt-1.5">
            Enter your Claim Slip Number to see where your laundry is right now. Updates live automatically.
          </p>
        </div>

        {/* Direct Claim Slip Search Form */}
        <form
          onSubmit={handleLookup}
          className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3"
        >
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                aria-label="Claim Slip Number"
                type="text"
                maxLength={32}
                placeholder={`Enter Claim Slip # (e.g. YL-${new Date().getFullYear()}-0001)`}
                value={inputCode}
                onChange={(e) => {
                  setInputCode(e.target.value.toUpperCase());
                  setInputError('');
                }}
                className="w-full pl-10 pr-3.5 py-3 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 text-sm font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {loading ? 'Checking...' : 'Check Status'}
            </button>
          </div>

          {inputError && (
            <p className="text-xs font-medium text-red-700">{inputError}</p>
          )}

          {!activeCode && (
            <p className="text-xs text-slate-500">
              Need an example?{' '}
              <button
                type="button"
                onClick={trySampleSlip}
                className="font-mono font-semibold text-[#0B6E99] hover:underline"
              >
                Check sample slip YL-{new Date().getFullYear()}-0001
              </button>
            </p>
          )}
        </form>

        {/* Loading Skeleton */}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
            <div className="h-5 w-44 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 w-64 bg-slate-100 rounded animate-pulse" />
            <div className="h-2 w-full bg-slate-100 rounded-full animate-pulse" />
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-16 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          </div>
        )}

        {/* Not Found State */}
        {!loading && notFound && activeCode && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
            <p className="font-display text-lg font-bold text-slate-900">
              No order found for{' '}
              <span className="font-mono text-[#0B6E99]">{activeCode}</span>
            </p>
            <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
              Double-check the code printed at the top of your YouLaba claim slip. If you dropped off your laundry just now, ask our counter staff or call us at{' '}
              <span className="font-mono font-semibold text-slate-900">
                {shopSettings.contactPhone}
              </span>
              .
            </p>
          </div>
        )}

        {/* Direct, High-Clarity Live Status View */}
        {!loading && order && (
          <article className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Primary Answer Header */}
            <div className="p-6 sm:p-8 border-b border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="font-mono font-semibold text-slate-700 tabular-nums">
                  {order.claimSlipNumber}
                </span>
                <span>
                  Customer: <strong className="text-slate-900">{order.customerLabel}</strong>
                  {' · '}
                  Step {stageIdx + 1} of {ORDER_STAGES.length}
                </span>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">Current Status</p>
                  <h2
                    className={`font-display text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 ${
                      order.status === 'Ready for Pickup' || order.status === 'Claimed'
                        ? 'text-emerald-700'
                        : 'text-[#0B6E99]'
                    }`}
                  >
                    {order.status}
                  </h2>
                  <p className="text-sm text-slate-600 mt-2 max-w-xl leading-relaxed">
                    {STAGE_DESCRIPTIONS[order.status]}
                  </p>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <p className="text-xs text-slate-500">Amount Due / Paid</p>
                  <p className="font-mono text-2xl font-extrabold text-slate-900 tabular-nums mt-0.5">
                    {formatPHP(order.totalPrice)}
                  </p>
                  <p
                    className={`text-xs font-semibold mt-0.5 ${
                      order.paymentStatus === 'Paid'
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {order.paymentStatus === 'Paid'
                      ? 'Paid in Full'
                      : order.paymentStatus === 'Partial'
                      ? 'Partially Paid · Balance at Pickup'
                      : 'Unpaid · Pay at Pickup'}
                  </p>
                </div>
              </div>

              {/* Clean Progress Bar */}
              <div className="mt-6">
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      order.status === 'Ready for Pickup' || order.status === 'Claimed'
                        ? 'bg-emerald-600'
                        : 'bg-[#0B6E99]'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 6-Stage Linear Checklist (Easy to Read at a Glance) */}
            <div className="p-6 sm:p-8 border-b border-slate-200">
              <h3 className="text-xs font-bold text-slate-500 mb-4">
                Stage Progress
              </h3>
              <ol className="space-y-3">
                {ORDER_STAGES.map((stage, idx) => {
                  const isDone = idx < stageIdx;
                  const isCurrent = idx === stageIdx;

                  return (
                    <li
                      key={stage}
                      className={`flex items-center justify-between gap-4 py-2.5 px-3.5 rounded-lg border ${
                        isCurrent
                          ? order.status === 'Ready for Pickup' || order.status === 'Claimed'
                            ? 'border-emerald-200 bg-emerald-50/70'
                            : 'border-sky-200 bg-sky-50/70'
                          : 'border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0 ${
                            isDone
                              ? 'bg-emerald-600 text-white'
                              : isCurrent
                              ? order.status === 'Ready for Pickup' || order.status === 'Claimed'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-[#0B6E99] text-white'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {isDone || (isCurrent && order.status === 'Claimed') ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            idx + 1
                          )}
                        </span>
                        <span
                          className={`text-sm ${
                            isCurrent
                              ? 'font-bold text-slate-900'
                              : isDone
                              ? 'font-medium text-slate-700'
                              : 'text-slate-400'
                          }`}
                        >
                          {stage}
                        </span>
                      </div>

                      <span className="text-xs font-medium shrink-0">
                        {isDone ? (
                          <span className="text-emerald-700 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Done
                          </span>
                        ) : isCurrent ? (
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              order.status === 'Ready for Pickup' || order.status === 'Claimed'
                                ? 'text-emerald-700'
                                : 'text-[#0B6E99]'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            {order.status === 'Claimed' ? 'Completed' : 'In Progress'}
                          </span>
                        ) : (
                          <span className="text-slate-400">Pending</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* Direct Key Timestamps & Order Summary */}
            <div className="p-6 sm:p-8 border-b border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-slate-500">Drop-Off Time</p>
                  <p className="font-mono text-sm font-semibold text-slate-900 tabular-nums mt-1">
                    {formatDateTime(order.dropOffAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">
                    {order.claimedAt ? 'Actual Claimed Time' : 'Estimated Ready Time'}
                  </p>
                  <p className="font-mono text-sm font-bold text-[#0B6E99] tabular-nums mt-1">
                    {formatDateTime(order.claimedAt || order.estimatedClaimAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Service & Load</p>
                  <p className="text-sm font-semibold text-slate-900 mt-1">
                    {order.serviceName}
                  </p>
                  <p className="font-mono text-xs text-slate-600 tabular-nums">
                    {order.quantity} {order.pricingUnit} · {order.bagCount} bag{order.bagCount > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Pickup Branch Info & Slip Actions */}
            <div className="p-6 sm:p-8 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 text-xs text-slate-600">
                <p className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <MapPin className="w-3.5 h-3.5 text-[#0B6E99] shrink-0" />
                  {shopSettings.branchAddress}
                </p>
                <p className="flex items-center gap-1.5 font-mono tabular-nums">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {shopSettings.contactPhone} · {shopSettings.operatingHours}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied ? 'Link Copied' : 'Copy Link'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSlipModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] rounded-lg transition-colors whitespace-nowrap"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Digital Claim Slip
                </button>
              </div>
            </div>
          </article>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-3xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            <strong className="text-slate-900">{shopSettings.shopName}</strong> · Nazareth, Cagayan de Oro City
          </span>
          <span>Phone numbers stay private per Data Privacy Act of 2012.</span>
        </div>
      </footer>

      {showSlipModal && order && (
        <ClaimSlipModal
          order={order}
          shopSettings={shopSettings}
          isPublicView
          onClose={() => setShowSlipModal(false)}
        />
      )}
    </div>
  );
}
