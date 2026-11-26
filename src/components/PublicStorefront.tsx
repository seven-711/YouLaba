import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  MapPin,
  Phone,
  Search,
  Shirt,
  ShoppingBag,
  Star,
  Timer,
  WashingMachine,
} from 'lucide-react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  computeEstimatedClaimIso,
  computeOrderPrice,
  FEEDBACK_CATEGORIES,
  formatDateTime,
  formatPHP,
  normalizeClaimSlip,
  type FeedbackCategory,
  type OrderStatus,
  type OrderTrackingPublic,
  type ServiceRate,
  type ShopSettings,
} from '../types/youlaba';
import { submitPublicFeedback } from '../lib/firestoreService';

interface PublicStorefrontProps {
  services: ServiceRate[];
  shopSettings: ShopSettings;
  isAuthenticatedStaff: boolean;
  onOpenPortal: () => void;
  onOpenOrderStatus: (claimSlipCode?: string) => void;
}

const STEP_ICONS = [ShoppingBag, Timer, Layers, CheckCircle2];
const STEPS = [
  { label: 'Drop off your laundry' },
  { label: 'We wash & fold it' },
  { label: 'Track it online' },
  { label: 'Pick it up clean' },
];

// Status pill colors
const STATUS_COLORS: Record<OrderStatus, string> = {
  'Received': 'bg-slate-100 text-slate-600',
  'Washing': 'bg-blue-50 text-blue-700',
  'Drying': 'bg-sky-50 text-sky-700',
  'Folding/Ironing': 'bg-violet-50 text-violet-700',
  'Ready for Pickup': 'bg-emerald-50 text-emerald-700',
  'Claimed': 'bg-slate-100 text-slate-500',
};
const STATUS_ICONS: Record<OrderStatus, typeof Clock> = {
  'Received': Clock,
  'Washing': WashingMachine,
  'Drying': Timer,
  'Folding/Ironing': Layers,
  'Ready for Pickup': CheckCircle2,
  'Claimed': CheckCircle2,
};

/** Format a raw string into YL-YYYY-XXXX as the user types */
function formatClaimInput(raw: string): string {
  // Strip everything except alphanumeric
  const digits = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Build the formatted string progressively
  // Expected: YL + YYYY + NNNN
  // We store internally without dashes, then display with them

  // If user typed the dashes themselves, strip and re-format
  let clean = digits;

  // Try to match segments
  if (clean.startsWith('YL')) {
    clean = clean.slice(2);
  }

  const year = clean.slice(0, 4);
  const num = clean.slice(4, 8);

  let result = 'YL';
  if (year.length > 0) result += `-${year}`;
  if (num.length > 0) result += `-${num}`;

  return result;
}

/** Check if formatted value is a complete valid claim slip */
function isComplete(formatted: string): boolean {
  return /^YL-\d{4}-\d{4}$/.test(formatted);
}

export function PublicStorefront({
  services,
  shopSettings,
  isAuthenticatedStaff,
  onOpenPortal,
  onOpenOrderStatus,
}: PublicStorefrontProps) {
  const activeServices = useMemo(
    () => services.filter((s) => s.active),
    [services]
  );

  const [trackingCode, setTrackingCode] = useState('');
  const [trackingError, setTrackingError] = useState('');

  // Recent orders from public orderTracking collection
  const [recentOrders, setRecentOrders] = useState<OrderTrackingPublic[]>([]);

  const [estServiceId, setEstServiceId] = useState(activeServices[0]?.id || '');
  const [estQty, setEstQty] = useState('5');

  const [fbName, setFbName] = useState('');
  const [fbCategory, setFbCategory] = useState<FeedbackCategory>('Service Quality');
  const [fbRating, setFbRating] = useState(5);
  const [fbMessage, setFbMessage] = useState('');
  const [fbSubmitting, setFbSubmitting] = useState(false);
  const [fbSuccess, setFbSuccess] = useState(false);
  const [fbError, setFbError] = useState('');

  const selectedEstService = useMemo(
    () => activeServices.find((s) => s.id === estServiceId) || activeServices[0] || null,
    [activeServices, estServiceId]
  );

  // Live feed: last 10 active (non-Claimed) orders, ordered by most recently updated
  useEffect(() => {
    const q = query(
      collection(db, 'orderTracking'),
      where('status', '!=', 'Claimed'),
      orderBy('status'),
      orderBy('updatedAt', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(q, (snap) => {
      setRecentOrders(
        snap.docs.map((d) => d.data() as OrderTrackingPublic)
      );
    }, () => {
      // Silently fail — public, non-critical
    });
    return () => unsub();
  }, []);

  const handleTrackInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatClaimInput(e.target.value);
    setTrackingCode(formatted);
    setTrackingError('');
    // Auto-submit when complete
    if (isComplete(formatted)) {
      onOpenOrderStatus(normalizeClaimSlip(formatted));
    }
  };

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeClaimSlip(trackingCode);
    if (clean.length < 5) {
      setTrackingError('Enter your Claim Slip Number (e.g. YL-2026-0001).');
      return;
    }
    setTrackingError('');
    onOpenOrderStatus(clean);
  };

  const estResult = useMemo(() => {
    if (!selectedEstService) {
      return { subtotal: 0, discount: 0, total: 0, billableQty: 0, estReady: '' };
    }
    const qty = Math.max(0.5, parseFloat(estQty) || selectedEstService.minQuantity);
    const computed = computeOrderPrice(
      selectedEstService.rate,
      qty,
      selectedEstService.minQuantity,
      0
    );
    return {
      ...computed,
      estReady: computeEstimatedClaimIso(new Date(), selectedEstService.turnaroundHours),
    };
  }, [selectedEstService, estQty]);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFbError('');
    setFbSuccess(false);
    if (fbName.trim().length < 2) {
      setFbError('Enter your name.');
      return;
    }
    if (fbMessage.trim().length < 5) {
      setFbError('Write a brief comment.');
      return;
    }
    setFbSubmitting(true);
    try {
      await submitPublicFeedback({
        authorName: fbName,
        authorRole: 'customer',
        claimSlipNumber: '',
        rating: fbRating,
        category: fbCategory,
        message: fbMessage,
      });
      setFbSuccess(true);
      setFbName('');
      setFbMessage('');
      setFbRating(5);
    } catch {
      setFbError('Could not submit. Try again.');
    } finally {
      setFbSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* ── NAV ── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between gap-6">
          <a
            href="#top"
            className="font-display text-lg font-extrabold tracking-tight text-slate-900 shrink-0"
          >
            {shopSettings.shopName}
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
            <button
              type="button"
              onClick={() => onOpenOrderStatus()}
              className="hover:text-slate-900 transition-colors"
            >
              Track Order
            </button>
            <a href="#services" className="hover:text-slate-900 transition-colors">
              Rates
            </a>
            <a href="#contact" className="hover:text-slate-900 transition-colors">
              Contact
            </a>
          </nav>

          <button
            type="button"
            onClick={onOpenPortal}
            className="shrink-0 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] rounded-lg transition-colors"
          >
            {isAuthenticatedStaff ? 'Counter' : 'Staff Login'}
          </button>
        </div>
      </header>

      <main id="top">
        {/* ── HERO ── */}
        <section className="max-w-5xl mx-auto px-5 pt-16 pb-14 text-center">
          <p className="text-xs font-semibold text-[#0B6E99] mb-3 tracking-wide uppercase">
            Nazareth, Cagayan de Oro · {shopSettings.operatingHours}
          </p>
          <h1 className="font-display text-5xl sm:text-6xl font-extrabold tracking-tight leading-[1.06] text-slate-900 text-balance mb-5">
            Clean clothes,<br />
            <span className="text-[#0B6E99]">ready when we say.</span>
          </h1>
          <p className="text-base text-slate-500 mb-10 max-w-sm mx-auto">
            Drop off, track live, pick up fresh. No guessing.
          </p>

          {/* ── TRACK ORDER BOX ── */}
          <div className="max-w-md mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left">
            <p className="text-sm font-bold text-slate-800 mb-1">Track your order</p>
            <p className="text-xs text-slate-500 mb-3">
              Type your Claim Slip ID — it fills in automatically.
            </p>
            <form onSubmit={handleTrackSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  inputMode="text"
                  maxLength={14}
                  placeholder="YL-2026-0001"
                  value={trackingCode}
                  onChange={handleTrackInputChange}
                  className="w-full pl-9 pr-3 py-2.5 text-sm font-mono uppercase border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99] bg-white tracking-wider"
                  aria-label="Claim slip number"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] rounded-xl transition-colors shrink-0"
              >
                Check
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
            {trackingError && (
              <p className="mt-2 text-xs text-red-600">{trackingError}</p>
            )}

            {/* ── RECENT ORDERS ── */}
            {recentOrders.length > 0 && (
              <div className="mt-5 pt-4 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-500 mb-2.5 uppercase tracking-wide">
                  Recent orders
                </p>
                <div className="space-y-1.5">
                  {recentOrders.map((order) => {
                    const StatusIcon = STATUS_ICONS[order.status] ?? Clock;
                    const pillClass = STATUS_COLORS[order.status] ?? 'bg-slate-100 text-slate-500';
                    return (
                      <button
                        key={order.claimSlipNumber}
                        type="button"
                        onClick={() => onOpenOrderStatus(order.claimSlipNumber)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-[#0B6E99]/40 hover:bg-[#0B6E99]/5 transition-all group text-left"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono text-xs font-bold text-slate-800 shrink-0">
                            {order.claimSlipNumber}
                          </span>
                          <span className="text-xs text-slate-400 truncate">
                            {order.customerLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${pillClass}`}>
                            <StatusIcon className="w-3 h-3" />
                            {order.status}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#0B6E99] transition-colors" />
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-slate-400 mt-2.5">
                  Showing active orders only · tap any row to view details
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="bg-slate-50 border-y border-slate-100 py-12">
          <div className="max-w-5xl mx-auto px-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {STEPS.map((step, i) => {
                const Icon = STEP_ICONS[i];
                return (
                  <div key={i} className="flex flex-col items-center text-center gap-3 py-2">
                    <div className="w-11 h-11 rounded-full bg-[#0B6E99]/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#0B6E99]" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800 leading-snug">
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── SERVICES & ESTIMATOR ── */}
        <section id="services" className="max-w-5xl mx-auto px-5 py-14">
          <h2 className="font-display text-2xl font-bold text-slate-900 mb-1">
            Services &amp; Rates
          </h2>
          <p className="text-sm text-slate-500 mb-8">
            Nazareth branch · {shopSettings.operatingHours}
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Rate Cards */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeServices.map((svc) => (
                <div
                  key={svc.id}
                  className="border border-slate-200 rounded-xl p-4 hover:border-[#0B6E99]/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-[#0B6E99]/10 flex items-center justify-center shrink-0">
                      <Shirt className="w-4 h-4 text-[#0B6E99]" />
                    </div>
                    <p className="font-mono text-lg font-extrabold text-slate-900 tabular-nums">
                      {formatPHP(svc.rate)}
                      <span className="text-xs font-normal text-slate-500">/{svc.pricingUnit}</span>
                    </p>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{svc.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {svc.turnaroundHours}h turnaround · min {svc.minQuantity} {svc.pricingUnit}
                  </p>
                </div>
              ))}
            </div>

            {/* Price Estimator */}
            <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <p className="text-sm font-bold text-slate-900">Estimate your cost</p>

              <div>
                <label htmlFor="est-service" className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Service
                </label>
                <select
                  id="est-service"
                  value={selectedEstService?.id || ''}
                  onChange={(e) => {
                    setEstServiceId(e.target.value);
                    const found = activeServices.find((s) => s.id === e.target.value);
                    if (found) setEstQty(String(Math.max(found.minQuantity, 4)));
                  }}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                >
                  {activeServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="est-qty" className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Weight ({selectedEstService?.pricingUnit || 'kg'})
                </label>
                <input
                  id="est-qty"
                  type="number"
                  step="0.5"
                  min="1"
                  max="100"
                  value={estQty}
                  onChange={(e) => setEstQty(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                />
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-xs text-slate-500">Estimated total</span>
                  <span className="font-mono text-2xl font-extrabold text-[#0B6E99] tabular-nums">
                    {formatPHP(estResult.total)}
                  </span>
                </div>
                {estResult.estReady && (
                  <p className="text-xs text-slate-500">
                    Ready by{' '}
                    <span className="font-semibold text-slate-700">
                      {formatDateTime(estResult.estReady)}
                    </span>
                  </p>
                )}
                <p className="text-[11px] text-slate-400 mt-2">
                  Final weight verified on our counter scale. Cash, GCash, or bank transfer accepted.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── CONTACT + FEEDBACK ── */}
        <section id="contact" className="bg-slate-50 border-t border-slate-100 py-14">
          <div className="max-w-5xl mx-auto px-5 grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Contact */}
            <div className="space-y-5">
              <h2 className="font-display text-2xl font-bold text-slate-900">
                Find us
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#0B6E99] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Address</p>
                    <p className="text-xs text-slate-500 mt-0.5">{shopSettings.branchAddress}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-[#0B6E99] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Phone &amp; Hours</p>
                    <p className="text-xs font-mono text-slate-500 mt-0.5">
                      {shopSettings.contactPhone} · {shopSettings.operatingHours}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#0B6E99]/5 border border-[#0B6E99]/20 rounded-xl p-4">
                <p className="text-xs font-semibold text-[#0B6E99] mb-1">
                  Got your claim slip?
                </p>
                <p className="text-xs text-slate-600">
                  Track your order anytime at the top of this page — no login required.
                </p>
              </div>
            </div>

            {/* Feedback Form */}
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900 mb-5">
                Leave feedback
              </h2>
              <form
                onSubmit={handleFeedbackSubmit}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="fb-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Your name *
                    </label>
                    <input
                      id="fb-name"
                      type="text"
                      maxLength={80}
                      placeholder="Maricel"
                      value={fbName}
                      onChange={(e) => setFbName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="fb-cat" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Topic
                    </label>
                    <select
                      id="fb-cat"
                      value={fbCategory}
                      onChange={(e) => setFbCategory(e.target.value as FeedbackCategory)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                    >
                      {FEEDBACK_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-semibold text-slate-700 mb-1.5">Rating</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setFbRating(n)}
                        aria-label={`Rate ${n} of 5`}
                        className="p-0.5"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            n <= fbRating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="fb-msg" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Comment *
                  </label>
                  <textarea
                    id="fb-msg"
                    rows={3}
                    maxLength={500}
                    placeholder="How was your experience?"
                    value={fbMessage}
                    onChange={(e) => setFbMessage(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99] resize-none"
                    required
                  />
                </div>

                {fbError && (
                  <p className="text-xs text-red-600">{fbError}</p>
                )}
                {fbSuccess && (
                  <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Thanks! Feedback sent.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={fbSubmitting}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] disabled:opacity-60 rounded-lg transition-colors"
                >
                  {fbSubmitting ? 'Sending...' : 'Send Feedback'}
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 text-slate-400 py-8">
        <div className="max-w-5xl mx-auto px-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-display text-base font-extrabold text-white">
              {shopSettings.shopName}
            </p>
            <p className="text-xs mt-0.5">
              {shopSettings.branchAddress} · {shopSettings.contactPhone}
            </p>
          </div>
          <div className="flex items-center gap-5 text-xs">
            <button
              type="button"
              onClick={() => onOpenOrderStatus()}
              className="hover:text-white transition-colors"
            >
              Track Order
            </button>
            <a href="#services" className="hover:text-white transition-colors">
              Rates
            </a>
            <button
              type="button"
              onClick={onOpenPortal}
              className="hover:text-white transition-colors"
            >
              Staff Portal
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
