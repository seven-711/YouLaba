import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react';
import {
  computeEstimatedClaimIso,
  computeOrderPrice,
  FEEDBACK_CATEGORIES,
  formatDateTime,
  formatPHP,
  normalizeClaimSlip,
  type FeedbackCategory,
  type ServiceRate,
  type ShopSettings,
} from '../types/youlaba';
import { submitPublicFeedback } from '../lib/firestoreService';

const HERO_IMG = '/src/assets/images/youlaba_hero_laundry_1795491806345.jpg';
const FOLD_IMG = '/src/assets/images/youlaba_fold_craft_1795491805744.jpg';
const COMFORTER_IMG = '/src/assets/images/youlaba_comforter_care_1795491827370.jpg';

interface PublicStorefrontProps {
  services: ServiceRate[];
  shopSettings: ShopSettings;
  isAuthenticatedStaff: boolean;
  onOpenPortal: () => void;
  onOpenOrderStatus: (claimSlipCode?: string) => void;
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

  // Quick Claim Slip Redirect Input
  const [trackingCode, setTrackingCode] = useState('');
  const [trackingError, setTrackingError] = useState('');

  // Interactive Price Estimator State
  const [estServiceId, setEstServiceId] = useState(activeServices[0]?.id || '');
  const [estQty, setEstQty] = useState('5');
  const [estPromo, setEstPromo] = useState('');

  // Public Feedback Form State
  const [fbName, setFbName] = useState('');
  const [fbSlip, setFbSlip] = useState('');
  const [fbCategory, setFbCategory] = useState<FeedbackCategory>('Service Quality');
  const [fbRating, setFbRating] = useState(5);
  const [fbMessage, setFbMessage] = useState('');
  const [fbSubmitting, setFbSubmitting] = useState(false);
  const [fbSuccess, setFbSuccess] = useState(false);
  const [fbError, setFbError] = useState('');

  // Image fallback state (Zero-Broken-Image Policy)
  const [heroImgErr, setHeroImgErr] = useState(false);
  const [foldImgErr, setFoldImgErr] = useState(false);
  const [comforterImgErr, setComforterImgErr] = useState(false);

  const selectedEstService = useMemo(
    () => activeServices.find((s) => s.id === estServiceId) || activeServices[0] || null,
    [activeServices, estServiceId]
  );

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
    const base = computeOrderPrice(
      selectedEstService.rate,
      qty,
      selectedEstService.minQuantity,
      0
    );
    const promoMatch =
      Boolean(shopSettings.activePromoCode) &&
      estPromo.trim().toUpperCase() === shopSettings.activePromoCode.toUpperCase() &&
      shopSettings.activePromoPercent > 0;
    const discountAmt = promoMatch
      ? Math.round(base.subtotal * (shopSettings.activePromoPercent / 100) * 100) / 100
      : 0;
    const computed = computeOrderPrice(
      selectedEstService.rate,
      qty,
      selectedEstService.minQuantity,
      discountAmt
    );
    return {
      ...computed,
      estReady: computeEstimatedClaimIso(new Date(), selectedEstService.turnaroundHours),
    };
  }, [selectedEstService, estQty, estPromo, shopSettings]);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFbError('');
    setFbSuccess(false);

    if (fbName.trim().length < 2) {
      setFbError('Please enter your name (at least 2 characters).');
      return;
    }
    if (fbMessage.trim().length < 5) {
      setFbError('Please share a brief comment or suggestion (at least 5 characters).');
      return;
    }

    setFbSubmitting(true);
    try {
      await submitPublicFeedback({
        authorName: fbName,
        authorRole: 'customer',
        claimSlipNumber: fbSlip,
        rating: fbRating,
        category: fbCategory,
        message: fbMessage,
      });
      setFbSuccess(true);
      setFbName('');
      setFbSlip('');
      setFbMessage('');
      setFbRating(5);
    } catch {
      setFbError('Unable to submit feedback right now. Please try again.');
    } finally {
      setFbSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single clean text wordmark */}
          <a
            href="#top"
            className="font-display text-xl font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            {shopSettings.shopName}
          </a>

          {/* Zone 2: 4 clean single-line text nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => onOpenOrderStatus()}
              className="hover:text-[#0B6E99] transition-colors whitespace-nowrap shrink-0"
            >
              Order Status
            </button>
            <a
              href="#services"
              className="hover:text-[#0B6E99] transition-colors whitespace-nowrap shrink-0"
            >
              Services & Rates
            </a>
            <a
              href="#process"
              className="hover:text-[#0B6E99] transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#feedback"
              className="hover:text-[#0B6E99] transition-colors whitespace-nowrap shrink-0"
            >
              Feedback
            </a>
          </nav>

          {/* Zone 3: 1 Primary Action */}
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

      <main id="top">
        {/* Hero Split + Live Order Tracker */}
        <section id="track" className="max-w-6xl mx-auto px-6 pt-10 pb-12 lg:pt-14 lg:pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            {/* Left Dominant Anchor: Editorial Headline + Direct Claim Slip Lookup */}
            <div className="lg:col-span-6 flex flex-col justify-between">
              <div>
                <p className="text-xs font-medium text-[#0B6E99] mb-3">
                  Nazareth, Cagayan de Oro City · {shopSettings.operatingHours}
                </p>
                <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.08] text-balance">
                  Fresh laundry, tracked from drop-off to claim.
                </h1>
                <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-xl">
                  Every load dropped off at YouLaba receives a digital claim slip, automated per-kilo pricing, and real-time washing-to-folding status updates—so you never have to guess when your clothes are ready.
                </p>
              </div>

              {/* Embedded Live Order Tracker Box */}
              <div className="mt-8 bg-white border border-slate-200 rounded-xl p-5">
                <label
                  htmlFor="public-claim-slip-input"
                  className="block text-sm font-bold text-slate-900 mb-1"
                >
                  Check Your Laundry Status
                </label>
                <p className="text-xs text-slate-500 mb-3.5">
                  Enter the Claim Slip Number printed on your receipt (example:{' '}
                  <button
                    type="button"
                    onClick={() =>
                      onOpenOrderStatus(`YL-${new Date().getFullYear()}-0001`)
                    }
                    className="font-mono font-semibold text-[#0B6E99] hover:underline"
                  >
                    YL-{new Date().getFullYear()}-0001
                  </button>
                  )
                </p>

                <form onSubmit={handleTrackSubmit} className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="public-claim-slip-input"
                      type="text"
                      maxLength={32}
                      placeholder={`YL-${new Date().getFullYear()}-0001`}
                      value={trackingCode}
                      onChange={(e) => {
                        setTrackingCode(e.target.value.toUpperCase());
                        setTrackingError('');
                      }}
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Check Status
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                {trackingError && (
                  <p className="mt-3 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                    {trackingError}
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Editorial Shop Photography (Full Height Balance) */}
            <div className="lg:col-span-6">
              <div className="w-full h-full min-h-[300px] lg:min-h-[420px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100 relative">
                {!heroImgErr ? (
                  <img
                    src={HERO_IMG}
                    alt="YouLaba modern neighborhood laundry shop counter with neatly folded white and pale blue cotton towels"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgErr(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-sky-50 to-slate-100">
                    <Sparkles className="w-10 h-10 text-[#0B6E99] mb-3" />
                    <p className="font-display font-bold text-slate-900">YouLaba Nazareth Branch</p>
                    <p className="text-xs text-slate-600 mt-1">Modern garment care & digital order tracking</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Full-width 4-Column Operational Facts Strip (Below Hero Split) */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-slate-200 pt-8">
            <div>
              <p className="font-mono text-lg font-bold text-slate-900 tabular-nums">6 Stages</p>
              <p className="text-xs text-slate-600 mt-1">
                Live progress from Received through Washing, Drying, Folding, Ready, and Claimed.
              </p>
            </div>
            <div>
              <p className="font-mono text-lg font-bold text-slate-900 tabular-nums">6–24 Hours</p>
              <p className="text-xs text-slate-600 mt-1">
                Same-day express wash-dry-fold or next-day regular neighborhood turnaround.
              </p>
            </div>
            <div>
              <p className="font-mono text-lg font-bold text-slate-900 tabular-nums">Zero Mix-Ups</p>
              <p className="text-xs text-slate-600 mt-1">
                Every laundry bag is tagged with a unique QR claim slip code and exact drop-off time.
              </p>
            </div>
            <div>
              <p className="font-mono text-lg font-bold text-slate-900 tabular-nums">Privacy Safe</p>
              <p className="text-xs text-slate-600 mt-1">
                Public tracking displays initials only—phone numbers stay private per the Data Privacy Act of 2012.
              </p>
            </div>
          </div>
        </section>

        {/* Services, Transparent Rate Table & Price Estimator */}
        <section id="services" className="bg-white border-y border-slate-200 py-16">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
              <div>
                <p className="text-xs font-medium text-[#0B6E99] mb-2">
                  Transparent Pricing · Nazareth Branch
                </p>
                <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 text-balance">
                  Services & Current Counter Rates
                </h2>
              </div>
              {shopSettings.activePromoCode && shopSettings.activePromoPercent > 0 && (
                <p className="text-xs text-slate-600">
                  Active Promo: <span className="font-mono font-bold text-[#0B6E99]">{shopSettings.activePromoCode}</span>
                  {' · '}
                  {shopSettings.activePromoLabel}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Rate Directory + Garment Care Visuals */}
              <div className="lg:col-span-7 space-y-6">
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
                  {activeServices.map((svc) => (
                    <div
                      key={svc.id}
                      className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span>{svc.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{svc.turnaroundHours}h turnaround</span>
                          <span aria-hidden="true">·</span>
                          <span>Min {svc.minQuantity} {svc.pricingUnit}</span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900">{svc.name}</h3>
                        <p className="text-xs text-slate-600 leading-relaxed max-w-md">
                          {svc.description}
                        </p>
                      </div>
                      <div className="sm:text-right shrink-0">
                        <p className="font-mono text-xl font-extrabold text-slate-900 tabular-nums">
                          {formatPHP(svc.rate)}
                        </p>
                        <p className="text-xs text-slate-500">per {svc.pricingUnit}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Editorial Care Photography Duo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <figure className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                    <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                      {!foldImgErr ? (
                        <img
                          src={FOLD_IMG}
                          alt="Crisply pressed cotton dress shirts and neatly folded neutral bath towels"
                          referrerPolicy="no-referrer"
                          onError={() => setFoldImgErr(true)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                          Pressed Garments & Folded Towels
                        </div>
                      )}
                    </div>
                    <figcaption className="px-4 py-3 text-xs text-slate-600">
                      <strong className="font-semibold text-slate-900">Wash, Dry & Press</strong> — sorted by fabric weight for office and school wear.
                    </figcaption>
                  </figure>

                  <figure className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                    <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                      {!comforterImgErr ? (
                        <img
                          src={COMFORTER_IMG}
                          alt="Freshly laundered fluffy white quilted comforter and bed linens in a woven hamper"
                          referrerPolicy="no-referrer"
                          onError={() => setComforterImgErr(true)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                          Comforter & Bedding Care
                        </div>
                      )}
                    </div>
                    <figcaption className="px-4 py-3 text-xs text-slate-600">
                      <strong className="font-semibold text-slate-900">Bulky & Comforter Care</strong> — sanitized single-customer drum cycles.
                    </figcaption>
                  </figure>
                </div>
              </div>

              {/* Interactive Price & Turnaround Estimator */}
              <div className="lg:col-span-5 bg-[#F8FAFC] border border-slate-200 rounded-xl p-6 space-y-5">
                <div className="flex items-center gap-2.5 pb-4 border-b border-slate-200">
                  <Calculator className="w-5 h-5 text-[#0B6E99]" />
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Price & Claim Time Estimator
                    </h3>
                    <p className="text-xs text-slate-500">
                      Estimate your laundry cost before dropping off at the counter.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="est-service"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      Select Service
                    </label>
                    <select
                      id="est-service"
                      value={selectedEstService?.id || ''}
                      onChange={(e) => {
                        setEstServiceId(e.target.value);
                        const found = activeServices.find((s) => s.id === e.target.value);
                        if (found) setEstQty(String(Math.max(found.minQuantity, 4)));
                      }}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                    >
                      {activeServices.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({formatPHP(s.rate)}/{s.pricingUnit})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="est-qty"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Est. Weight / Loads ({selectedEstService?.pricingUnit || 'kg'})
                      </label>
                      <input
                        id="est-qty"
                        type="number"
                        step="0.5"
                        min="1"
                        max="100"
                        value={estQty}
                        onChange={(e) => setEstQty(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="est-promo"
                        className="block text-xs font-semibold text-slate-700 mb-1.5"
                      >
                        Promo Code (Optional)
                      </label>
                      <input
                        id="est-promo"
                        type="text"
                        placeholder={shopSettings.activePromoCode || 'Code'}
                        value={estPromo}
                        onChange={(e) => setEstPromo(e.target.value.toUpperCase())}
                        className="w-full px-3.5 py-2.5 text-sm font-mono uppercase bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Billable Quantity</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {estResult.billableQty} {selectedEstService?.pricingUnit || 'kg'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-mono tabular-nums">{formatPHP(estResult.subtotal)}</span>
                  </div>
                  {estResult.discount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Promo Discount ({shopSettings.activePromoPercent}%)</span>
                      <span className="font-mono tabular-nums">-{formatPHP(estResult.discount)}</span>
                    </div>
                  )}
                  <div className="pt-2.5 border-t border-slate-200 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-slate-900">Estimated Total</span>
                    <span className="font-mono text-2xl font-extrabold text-[#0B6E99] tabular-nums">
                      {formatPHP(estResult.total)}
                    </span>
                  </div>
                  <div className="pt-2 flex justify-between text-slate-600">
                    <span>If dropped off now, ready by</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {formatDateTime(estResult.estReady)}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Final weight is verified on our calibrated counter scale upon drop-off. Cash, GCash, and Bank Transfer accepted at the counter.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How YouLaba Works (Editorial 01–04) */}
        <section id="process" className="max-w-6xl mx-auto px-6 py-16">
          <div className="max-w-2xl mb-10">
            <p className="text-xs font-medium text-[#0B6E99] mb-2">
              Traceable Workflow
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 text-balance">
              Built to eliminate misplaced receipts and guesswork.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                num: '01.',
                title: 'Weighed & Tagged at Counter',
                body: 'Our attendant weighs your laundry, records special fabric care notes, and attaches a matching QR bag tag.',
              },
              {
                num: '02.',
                title: 'Instant Claim Slip & Timestamp',
                body: 'You receive a printed or digital claim slip showing your exact drop-off time, computed total, and guaranteed claim window.',
              },
              {
                num: '03.',
                title: 'Live Stage-by-Stage Updates',
                body: 'Track your load online from Received to Washing, Drying, Folding/Ironing, and Ready for Pickup without messaging repeatedly.',
              },
              {
                num: '04.',
                title: 'Verified Payment & Release',
                body: 'Pay via Cash, GCash, or Bank Transfer at drop-off or pickup. Every release is timestamped for complete accountability.',
              },
            ].map((step) => (
              <div
                key={step.num}
                className="bg-white border border-slate-200 rounded-xl p-6"
              >
                <p className="font-mono text-sm font-bold text-[#0B6E99] mb-3">
                  {step.num}
                </p>
                <h3 className="text-base font-bold text-slate-900 mb-2">
                  {step.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Branch Location + Customer Feedback Form */}
        <section id="feedback" className="bg-white border-t border-slate-200 py-16">
          <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Branch Details & Privacy Policy */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <p className="text-xs font-medium text-[#0B6E99] mb-2">
                  Visit Our Nazareth Shop
                </p>
                <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 text-balance">
                  We value your garments and your feedback.
                </h2>
                <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                  Share how your recent wash went, report a service concern, or suggest improvements. Every submission goes directly to YouLaba management.
                </p>
              </div>

              <div className="space-y-4 pt-2 text-sm text-slate-700 border-t border-slate-200">
                <div className="flex items-start gap-3 pt-4">
                  <MapPin className="w-4 h-4 text-[#0B6E99] shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-slate-900">Branch Address</p>
                    <p className="text-xs text-slate-600 mt-0.5">{shopSettings.branchAddress}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-[#0B6E99] shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-slate-900">Counter Contact & Hours</p>
                    <p className="text-xs text-slate-600 mt-0.5 font-mono tabular-nums">
                      {shopSettings.contactPhone} · {shopSettings.operatingHours}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-4 h-4 text-[#0B6E99] shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-slate-900">Data Privacy Act of 2012</p>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Customer names and contact numbers are stored solely for order tracking and claim verification, and are never exposed on public lookup pages.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Feedback Form */}
            <div className="lg:col-span-7">
              <form
                onSubmit={handleFeedbackSubmit}
                className="bg-[#F8FAFC] border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5"
              >
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  Customer Feedback & Service Report
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fb-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Your Name *
                    </label>
                    <input
                      id="fb-name"
                      type="text"
                      maxLength={80}
                      placeholder="e.g. Maricel V."
                      value={fbName}
                      onChange={(e) => setFbName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="fb-slip" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Claim Slip Number (Optional)
                    </label>
                    <input
                      id="fb-slip"
                      type="text"
                      maxLength={32}
                      placeholder={`YL-${new Date().getFullYear()}-0001`}
                      value={fbSlip}
                      onChange={(e) => setFbSlip(e.target.value.toUpperCase())}
                      className="w-full px-3.5 py-2.5 text-sm font-mono uppercase bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fb-cat" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Topic
                    </label>
                    <select
                      id="fb-cat"
                      value={fbCategory}
                      onChange={(e) => setFbCategory(e.target.value as FeedbackCategory)}
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                    >
                      {FEEDBACK_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Overall Rating
                    </span>
                    <div className="flex items-center gap-1.5 py-1.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setFbRating(n)}
                          aria-label={`Rate ${n} out of 5`}
                          className="p-1 text-amber-500 hover:scale-105 transition-transform"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              n <= fbRating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs font-mono text-slate-600 ml-2 tabular-nums">
                        {fbRating}/5
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="fb-msg" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Comments or Suggestions *
                  </label>
                  <textarea
                    id="fb-msg"
                    rows={3}
                    maxLength={500}
                    placeholder="Tell us about your wash quality, turnaround time, or how we can serve Nazareth better..."
                    value={fbMessage}
                    onChange={(e) => setFbMessage(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                    required
                  />
                </div>

                {fbError && (
                  <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                    {fbError}
                  </p>
                )}

                {fbSuccess && (
                  <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    Thank you! Your feedback has been recorded for the YouLaba shop owner.
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={fbSubmitting}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                  >
                    {fbSubmitting ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="bg-slate-900 text-slate-300 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <p className="font-display text-lg font-extrabold text-white tracking-tight">
              {shopSettings.shopName}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {shopSettings.branchAddress} · {shopSettings.contactPhone}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
            <button
              type="button"
              onClick={() => onOpenOrderStatus()}
              className="hover:text-white transition-colors"
            >
              Order Status
            </button>
            <a href="#services" className="hover:text-white transition-colors">
              Services & Rates
            </a>
            <a href="#feedback" className="hover:text-white transition-colors">
              Feedback
            </a>
            <button
              type="button"
              onClick={onOpenPortal}
              className="hover:text-white transition-colors"
            >
              Staff & Owner Portal
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
