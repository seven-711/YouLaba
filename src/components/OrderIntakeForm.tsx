import { useMemo, useState } from 'react';
import { AlertTriangle, Calculator, CheckCircle2, Plus, UserPlus, Users } from 'lucide-react';
import {
  computeEstimatedClaimIso,
  computeOrderPrice,
  formatDateTime,
  formatPHP,
  generateClaimSlipNumber,
  PAID_METHODS,
  VALID_PHONE_REGEX,
  type Customer,
  type LaundryOrder,
  type PaidMethod,
  type ServiceRate,
  type ShopSettings,
} from '../types/youlaba';
import { createLaundryOrderAtomic } from '../lib/firestoreService';

interface OrderIntakeFormProps {
  customers: Customer[];
  services: ServiceRate[];
  orders: LaundryOrder[];
  shopSettings: ShopSettings;
  actor: { uid: string; name: string; role: 'owner' | 'staff' };
  onOrderCreated: (createdOrder: LaundryOrder) => void;
}

export function OrderIntakeForm({
  customers,
  services,
  orders,
  shopSettings,
  actor,
  onOrderCreated,
}: OrderIntakeFormProps) {
  const activeServices = useMemo(
    () => services.filter((s) => s.active),
    [services]
  );

  const [customerMode, setCustomerMode] = useState<'new' | 'existing'>(
    customers.length > 0 ? 'existing' : 'new'
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    customers[0]?.id || ''
  );
  const [customerSearch, setCustomerSearch] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  const [serviceId, setServiceId] = useState<string>(activeServices[0]?.id || '');
  const [quantity, setQuantity] = useState<string>('4');
  const [bagCount, setBagCount] = useState<string>('1');
  const [itemsSummary, setItemsSummary] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [manualDiscount, setManualDiscount] = useState<string>('0');

  const [payNow, setPayNow] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaidMethod>('Cash');
  const [amountTendered, setAmountTendered] = useState<string>('');

  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedService = useMemo(
    () => activeServices.find((s) => s.id === serviceId) || activeServices[0] || null,
    [activeServices, serviceId]
  );

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.contactNumber.toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const effectiveName =
    customerMode === 'existing' && selectedCustomer
      ? selectedCustomer.fullName
      : customerName;
  const effectivePhone =
    customerMode === 'existing' && selectedCustomer
      ? selectedCustomer.contactNumber
      : customerPhone;

  const parsedQty = parseFloat(quantity) || 0;
  const parsedBags = Math.max(1, parseInt(bagCount, 10) || 1);

  const baseSubtotal = useMemo(() => {
    if (!selectedService) return 0;
    return computeOrderPrice(selectedService.rate, parsedQty, selectedService.minQuantity, 0).subtotal;
  }, [selectedService, parsedQty]);

  const promoApplied =
    Boolean(shopSettings.activePromoCode) &&
    promoCode.trim().toUpperCase() === shopSettings.activePromoCode.toUpperCase() &&
    shopSettings.activePromoPercent > 0;

  const computedDiscount = promoApplied
    ? Math.round(baseSubtotal * (shopSettings.activePromoPercent / 100) * 100) / 100
    : Math.max(0, parseFloat(manualDiscount) || 0);

  const pricing = useMemo(() => {
    if (!selectedService) {
      return { billableQty: 0, subtotal: 0, discount: 0, total: 0 };
    }
    return computeOrderPrice(
      selectedService.rate,
      parsedQty,
      selectedService.minQuantity,
      computedDiscount
    );
  }, [selectedService, parsedQty, computedDiscount]);

  const nextClaimSlip = useMemo(
    () => generateClaimSlipNumber(orders.map((o) => o.claimSlipNumber)),
    [orders]
  );

  const estimatedClaimPreview = useMemo(() => {
    const hrs = selectedService?.turnaroundHours || shopSettings.defaultTurnaroundHours;
    return computeEstimatedClaimIso(new Date(), hrs);
  }, [selectedService, shopSettings.defaultTurnaroundHours]);

  // Duplicate-Order Warning (Category 11 Feedback Mechanism)
  const potentialDuplicate = useMemo(() => {
    const cleanPhone = effectivePhone.replace(/\s+/g, '');
    const cleanName = effectiveName.trim().toLowerCase();
    if (!cleanName && !cleanPhone) return null;
    const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
    return (
      orders.find((o) => {
        if (o.status === 'Claimed') return false;
        const createdMs = new Date(o.dropOffAt).getTime();
        const samePerson =
          (cleanPhone && o.customerPhone.replace(/\s+/g, '') === cleanPhone) ||
          (cleanName && o.customerName.trim().toLowerCase() === cleanName);
        return samePerson && createdMs >= thirtyMinsAgo;
      }) || null
    );
  }, [orders, effectiveName, effectivePhone]);

  const changePreview = payNow
    ? Math.max(0, Math.round(((parseFloat(amountTendered) || pricing.total) - pricing.total) * 100) / 100)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedService) {
      setError('Please configure at least one active service rate before logging an order.');
      return;
    }

    if (effectiveName.trim().length < 2) {
      setError('Customer full name must be at least 2 characters.');
      return;
    }

    if (!VALID_PHONE_REGEX.test(effectivePhone.trim())) {
      setError('Enter a valid Philippine contact number (e.g. 0917-542-8810).');
      return;
    }

    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError('Weight or load quantity must be a positive number.');
      return;
    }

    if (potentialDuplicate && !duplicateAcknowledged) {
      setError(
        `Possible duplicate detected: ${potentialDuplicate.claimSlipNumber} was just logged for ${potentialDuplicate.customerName}. Confirm the duplicate warning box below if this is a separate order.`
      );
      return;
    }

    const tenderedVal = payNow ? parseFloat(amountTendered) || pricing.total : 0;
    if (payNow && tenderedVal < pricing.total) {
      setError('Amount tendered must be at least equal to the computed total.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createLaundryOrderAtomic({
        claimSlipNumber: nextClaimSlip,
        existingCustomer: customerMode === 'existing' ? selectedCustomer : null,
        customerName: effectiveName,
        customerPhone: effectivePhone,
        customerNotes:
          customerMode === 'existing' && selectedCustomer
            ? selectedCustomer.notes
            : customerNotes,
        service: selectedService,
        quantity: parsedQty,
        bagCount: parsedBags,
        itemsSummary: itemsSummary.trim() || `${parsedQty} ${selectedService.pricingUnit} ${selectedService.name}`,
        specialInstructions,
        discountAmount: pricing.discount,
        promoCode: promoApplied ? shopSettings.activePromoCode : '',
        payNow,
        paymentMethod,
        amountTendered: tenderedVal,
        actor,
      });

      // Reset form fields cleanly
      setItemsSummary('');
      setSpecialInstructions('');
      setPromoCode('');
      setManualDiscount('0');
      setPayNow(false);
      setAmountTendered('');
      setDuplicateAcknowledged(false);
      if (customerMode === 'new') {
        setCustomerName('');
        setCustomerPhone('');
        setCustomerNotes('');
      }
      onOrderCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Customer & Laundry Details */}
      <div className="lg:col-span-8 space-y-6">
        {/* Customer Block */}
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                1. Customer Information
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Protected under the Data Privacy Act of 2012 · Phone numbers stay private at the counter.
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setCustomerMode('existing')}
                disabled={customers.length === 0}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  customerMode === 'existing'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 disabled:opacity-40'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Returning ({customers.length})
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode('new')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  customerMode === 'new'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                New Customer
              </button>
            </div>
          </div>

          {customerMode === 'existing' && customers.length > 0 ? (
            <div className="pt-4 space-y-3">
              <div>
                <label htmlFor="cust-search" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Search & Select Customer
                </label>
                <input
                  id="cust-search"
                  type="text"
                  placeholder="Type name or phone number..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                />
              </div>
              <select
                aria-label="Choose returning customer"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
              >
                {filteredCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} — {c.contactNumber} ({c.totalOrders} past orders)
                  </option>
                ))}
              </select>
              {selectedCustomer?.notes && (
                <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2">
                  Preference on file: <span className="font-medium text-slate-900">{selectedCustomer.notes}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="new-cust-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Customer Full Name *
                </label>
                <input
                  id="new-cust-name"
                  type="text"
                  maxLength={100}
                  placeholder="e.g. Andrea M. Reyes"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                  required={customerMode === 'new'}
                />
              </div>
              <div>
                <label htmlFor="new-cust-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mobile / Contact Number *
                </label>
                <input
                  id="new-cust-phone"
                  type="tel"
                  maxLength={20}
                  placeholder="0917-555-0192"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                  required={customerMode === 'new'}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="new-cust-notes" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Customer Care Notes (Optional)
                </label>
                <input
                  id="new-cust-notes"
                  type="text"
                  maxLength={250}
                  placeholder="e.g. Sensitive skin — mild detergent only, Nazareth 14th St"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                />
              </div>
            </div>
          )}
        </section>

        {/* Service & Load Intake Block */}
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="pb-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              2. Service Selection & Garment Details
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Totals and estimated claim timestamps calculate automatically from active Nazareth branch rates.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeServices.map((svc) => {
              const selected = svc.id === selectedService?.id;
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => {
                    setServiceId(svc.id);
                    if (parseFloat(quantity) < svc.minQuantity) {
                      setQuantity(String(svc.minQuantity));
                    }
                  }}
                  className={`text-left p-4 rounded-lg border transition-colors ${
                    selected
                      ? 'border-[#0B6E99] bg-sky-50/60 ring-1 ring-[#0B6E99]'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">{svc.name}</span>
                    <span className="font-mono text-sm font-bold text-[#0B6E99] tabular-nums whitespace-nowrap">
                      {formatPHP(svc.rate)}/{svc.pricingUnit}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    {svc.category} · Min {svc.minQuantity} {svc.pricingUnit} · {svc.turnaroundHours}h turnaround
                  </p>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div>
              <label htmlFor="intake-qty" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Weight / Load ({selectedService?.pricingUnit || 'kg'}) *
              </label>
              <input
                id="intake-qty"
                type="number"
                step="0.1"
                min="0.1"
                max="1000"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                required
              />
              {selectedService && parsedQty > 0 && parsedQty < selectedService.minQuantity && (
                <p className="text-[11px] text-amber-700 mt-1">
                  Minimum billable: {selectedService.minQuantity} {selectedService.pricingUnit}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="intake-bags" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Physical Bags Received *
              </label>
              <input
                id="intake-bags"
                type="number"
                min="1"
                max="100"
                value={bagCount}
                onChange={(e) => setBagCount(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                required
              />
            </div>

            <div>
              <label htmlFor="intake-promo" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Promo Code or Discount (₱)
              </label>
              <div className="flex gap-2">
                <input
                  id="intake-promo"
                  type="text"
                  maxLength={32}
                  placeholder={shopSettings.activePromoCode || 'PROMO'}
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2.5 text-xs font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                />
                {!promoApplied && (
                  <input
                    aria-label="Manual discount in PHP"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="₱0"
                    value={manualDiscount}
                    onChange={(e) => setManualDiscount(e.target.value)}
                    className="w-20 px-2.5 py-2.5 text-xs font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                  />
                )}
              </div>
              {promoApplied && (
                <p className="text-[11px] font-medium text-emerald-700 mt-1">
                  {shopSettings.activePromoPercent}% promo applied ({shopSettings.activePromoCode})
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="intake-items" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Items / Garments Summary
              </label>
              <textarea
                id="intake-items"
                rows={2}
                maxLength={300}
                placeholder="e.g. 6 shirts, 3 jeans, 2 towels, 1 bedsheet"
                value={itemsSummary}
                onChange={(e) => setItemsSummary(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
              />
            </div>

            <div>
              <label htmlFor="intake-instructions" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Special Care Instructions
              </label>
              <textarea
                id="intake-instructions"
                rows={2}
                maxLength={300}
                placeholder="e.g. No bleach, separate dark colors, hang-dry delicate blouse"
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
              />
            </div>
          </div>
        </section>
      </div>

      {/* Right Column: Live Automated Computation & Payment at Drop-Off */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#0B6E99]" />
              <h3 className="text-sm font-bold text-slate-900">Automated Order Summary</h3>
            </div>
            <span className="font-mono text-xs font-bold text-[#0B6E99] tabular-nums">
              {nextClaimSlip}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Billable Quantity</span>
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                {pricing.billableQty} {selectedService?.pricingUnit || 'kg'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Unit Rate</span>
              <span className="font-mono text-slate-900 tabular-nums">
                {formatPHP(selectedService?.rate || 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-mono text-slate-900 tabular-nums">
                {formatPHP(pricing.subtotal)}
              </span>
            </div>
            {pricing.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount</span>
                <span className="font-mono font-semibold tabular-nums">
                  -{formatPHP(pricing.discount)}
                </span>
              </div>
            )}
            <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
              <span className="text-sm font-bold text-slate-900">Computed Total</span>
              <span className="font-mono text-2xl font-extrabold text-slate-900 tabular-nums">
                {formatPHP(pricing.total)}
              </span>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Drop-Off Timestamp</span>
              <span className="font-mono text-slate-800 tabular-nums">Now</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Est. Claim Time</span>
              <span className="font-mono font-semibold text-[#0B6E99] tabular-nums">
                {formatDateTime(estimatedClaimPreview)}
              </span>
            </div>
          </div>

          {/* Optional Pay at Drop-off */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={payNow}
                onChange={(e) => {
                  setPayNow(e.target.checked);
                  if (e.target.checked) {
                    setAmountTendered(pricing.total.toFixed(2));
                  }
                }}
                className="rounded border-slate-300 text-[#0B6E99] focus:ring-[#0B6E99]"
              />
              <span className="text-xs font-semibold text-slate-800">
                Customer is paying now at drop-off
              </span>
            </label>

            {payNow && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-3 gap-1.5">
                  {PAID_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(m);
                        if (m !== 'Cash') setAmountTendered(pricing.total.toFixed(2));
                      }}
                      className={`py-2 px-2 text-[11px] font-semibold rounded-md border transition-colors whitespace-nowrap ${
                        paymentMethod === m
                          ? 'bg-[#0B6E99] text-white border-[#0B6E99]'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="intake-tendered" className="block text-[11px] font-medium text-slate-600 mb-1">
                      Tendered (₱)
                    </label>
                    <input
                      id="intake-tendered"
                      type="number"
                      step="0.01"
                      min={pricing.total}
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium text-slate-600 mb-1">Change</span>
                    <div className="px-3 py-2 text-xs font-mono font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg tabular-nums">
                      {formatPHP(changePreview)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Duplicate Order Detection Warning */}
          {potentialDuplicate && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3.5 space-y-2">
              <div className="flex items-start gap-2 text-amber-900">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                <p className="text-xs leading-relaxed">
                  <strong>Duplicate Check:</strong> Order{' '}
                  <span className="font-mono font-bold">{potentialDuplicate.claimSlipNumber}</span>{' '}
                  was logged for {potentialDuplicate.customerName} within the last 30 minutes.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-950 font-medium">
                <input
                  type="checkbox"
                  checked={duplicateAcknowledged}
                  onChange={(e) => setDuplicateAcknowledged(e.target.checked)}
                  className="rounded border-amber-400 text-amber-700"
                />
                Confirm this is a separate laundry order
              </label>
            </div>
          )}

          {error && (
            <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
          >
            {submitting ? (
              'Creating Order & Claim Slip...'
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Create Order & Issue Claim Slip
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            Automatically logs to database, public tracker & spreadsheet export.
          </p>
        </div>
      </div>
    </form>
  );
}
