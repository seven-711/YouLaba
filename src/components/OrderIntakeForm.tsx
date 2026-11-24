import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Plus,
  Receipt,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import {
  computeEstimatedClaimIso,
  computeOrderPrice,
  formatDateTime,
  formatPHP,
  generateClaimSlipNumber,
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

const WEIGHT_PRESETS = [4, 6, 8, 10];
const BAG_PRESETS = [1, 2, 3];

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

  // Customer Mode: 'existing' or 'new'
  const [customerMode, setCustomerMode] = useState<'existing' | 'new'>(
    customers.length > 0 ? 'existing' : 'new'
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    customers[0]?.id || ''
  );
  const [customerSearch, setCustomerSearch] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  // Service & Load
  const [serviceId, setServiceId] = useState<string>(activeServices[0]?.id || '');
  const [quantity, setQuantity] = useState<string>('4');
  const [bagCount, setBagCount] = useState<string>('1');
  const [itemsSummary, setItemsSummary] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [manualDiscount, setManualDiscount] = useState<string>('0');

  // Payment Status: 'unpaid' | 'Cash' | 'GCash' | 'Bank Transfer'
  const [paymentChoice, setPaymentChoice] = useState<'unpaid' | PaidMethod>('unpaid');
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

  // Duplicate Check
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

  const isPayingNow = paymentChoice !== 'unpaid';
  const effectiveTendered = isPayingNow
    ? parseFloat(amountTendered) || pricing.total
    : 0;
  const changePreview = isPayingNow
    ? Math.max(0, Math.round((effectiveTendered - pricing.total) * 100) / 100)
    : 0;

  const handleSelectPayment = (choice: 'unpaid' | PaidMethod) => {
    setPaymentChoice(choice);
    if (choice !== 'unpaid') {
      setAmountTendered(pricing.total.toFixed(2));
    } else {
      setAmountTendered('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedService) {
      setError('Please select an active laundry service.');
      return;
    }

    if (effectiveName.trim().length < 2) {
      setError('Please enter the customer full name.');
      return;
    }

    if (!VALID_PHONE_REGEX.test(effectivePhone.trim())) {
      setError('Please enter a valid phone number (e.g. 0917-123-4567).');
      return;
    }

    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError('Please enter a valid weight.');
      return;
    }

    if (potentialDuplicate && !duplicateAcknowledged) {
      setError(
        `Duplicate warning: ${potentialDuplicate.claimSlipNumber} was just logged for ${potentialDuplicate.customerName}. Check the box below if this is a separate order.`
      );
      return;
    }

    if (isPayingNow && effectiveTendered < pricing.total) {
      setError('Payment tendered must be at least equal to total amount.');
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
        payNow: isPayingNow,
        paymentMethod: isPayingNow ? (paymentChoice as PaidMethod) : 'Cash',
        amountTendered: effectiveTendered,
        actor,
      });

      // Reset
      setItemsSummary('');
      setSpecialInstructions('');
      setPromoCode('');
      setManualDiscount('0');
      setPaymentChoice('unpaid');
      setAmountTendered('');
      setDuplicateAcknowledged(false);
      if (customerMode === 'new') {
        setCustomerName('');
        setCustomerPhone('');
        setCustomerNotes('');
      }
      onOrderCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left Column: Customer & Service Selection */}
      <div className="lg:col-span-8 space-y-4">
        {/* Step 1: Customer Card */}
        <section className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#0B6E99] text-white text-[11px] font-bold">
                1
              </span>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Customer Details
              </h2>
            </div>

            {/* Quick Mode Toggle */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setCustomerMode('existing')}
                disabled={customers.length === 0}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  customerMode === 'existing'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-900 disabled:opacity-40'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-[#0B6E99]" />
                Returning ({customers.length})
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode('new')}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  customerMode === 'new'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                New Customer
              </button>
            </div>
          </div>

          {customerMode === 'existing' && customers.length > 0 ? (
            <div className="pt-3 space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Quick search name or mobile..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/20 focus:border-[#0B6E99]"
                />
                <select
                  aria-label="Select Customer"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/20 focus:border-[#0B6E99]"
                >
                  {filteredCustomers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} &bull; {c.contactNumber} ({c.totalOrders} orders)
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustomer?.notes && (
                <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200/80 rounded-lg px-3 py-1.5">
                  <span className="font-semibold text-slate-800">Customer Note:</span>{' '}
                  {selectedCustomer.notes}
                </p>
              )}
            </div>
          ) : (
            <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  maxLength={100}
                  placeholder="e.g. Maria Santos"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/20 focus:border-[#0B6E99]"
                  required={customerMode === 'new'}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  maxLength={20}
                  placeholder="e.g. 0917-123-4567"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/20 focus:border-[#0B6E99]"
                  required={customerMode === 'new'}
                />
              </div>

              <div className="sm:col-span-2">
                <input
                  type="text"
                  maxLength={250}
                  placeholder="Optional care note (e.g. delicate items, mild soap)"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/20 focus:border-[#0B6E99]"
                />
              </div>
            </div>
          )}
        </section>

        {/* Step 2: Laundry Service Selection */}
        <section className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#0B6E99] text-white text-[11px] font-bold">
                2
              </span>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Select Service
              </h2>
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              1-click selection
            </span>
          </div>

          {/* Service Cards (Visual Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {activeServices.map((svc) => {
              const isSelected = svc.id === selectedService?.id;
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
                  className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#0B6E99] bg-[#0B6E99]/5 ring-1 ring-[#0B6E99]'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">{svc.name}</span>
                    <span className="font-mono text-xs font-bold text-[#0B6E99] tabular-nums">
                      {formatPHP(svc.rate)}/{svc.pricingUnit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500">
                    <span>Min {svc.minQuantity} {svc.pricingUnit}</span>
                    <span className="flex items-center gap-1 font-medium text-slate-600">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {svc.turnaroundHours}h Ready
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Weight & Bags Input with 1-Click Fast Presets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Weight / Quantity */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  Weight ({selectedService?.pricingUnit || 'kg'})
                </label>
                <div className="flex items-center gap-1">
                  {WEIGHT_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setQuantity(String(preset))}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors ${
                        quantity === String(preset)
                          ? 'bg-[#0B6E99] text-white border-[#0B6E99]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset}k
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="number"
                step="0.1"
                min="0.1"
                max="1000"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-mono font-bold tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/20 focus:border-[#0B6E99]"
                required
              />
            </div>

            {/* Bag Count */}
            <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  Number of Bags
                </label>
                <div className="flex items-center gap-1">
                  {BAG_PRESETS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setBagCount(String(b))}
                      className={`px-2.5 py-0.5 text-[10px] font-bold rounded border transition-colors ${
                        bagCount === String(b)
                          ? 'bg-[#0B6E99] text-white border-[#0B6E99]'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="number"
                min="1"
                max="100"
                value={bagCount}
                onChange={(e) => setBagCount(e.target.value)}
                className="w-full px-3 py-1.5 text-sm font-mono font-bold tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/20 focus:border-[#0B6E99]"
                required
              />
            </div>
          </div>

          {/* Optional Garments Note (Collapsible/Clean) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <input
              type="text"
              maxLength={200}
              placeholder="Items summary (e.g. 5 shirts, 2 pants, 1 towel)"
              value={itemsSummary}
              onChange={(e) => setItemsSummary(e.target.value)}
              className="w-full px-3 py-1.5 text-xs text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/20 focus:border-[#0B6E99]"
            />
            <input
              type="text"
              maxLength={200}
              placeholder="Special instructions (e.g. separate whites, gentle dry)"
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              className="w-full px-3 py-1.5 text-xs text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/20 focus:border-[#0B6E99]"
            />
          </div>
        </section>
      </div>

      {/* Right Column: Automated Summary & 1-Click Payment */}
      <div className="lg:col-span-4 space-y-3">
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-slate-900 font-bold text-xs">
              <Receipt className="w-4 h-4 text-[#0B6E99]" />
              <span>Claim Slip Preview</span>
            </div>
            <span className="font-mono text-xs font-black text-[#0B6E99] bg-[#0B6E99]/10 px-2 py-0.5 rounded">
              {nextClaimSlip}
            </span>
          </div>

          {/* Big Computed Amount */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-center space-y-0.5">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Order Price
            </span>
            <div className="font-mono text-3xl font-black text-slate-900 tracking-tight">
              {formatPHP(pricing.total)}
            </div>
            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 pt-1">
              <span>{pricing.billableQty} {selectedService?.pricingUnit || 'kg'} &bull; {parsedBags} Bag{parsedBags > 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Estimated Pickup Time Banner */}
          <div className="flex items-center gap-2 text-xs text-slate-700 bg-sky-50/70 border border-sky-200/70 rounded-lg px-3 py-2">
            <Clock className="w-4 h-4 text-[#0B6E99] shrink-0" />
            <div className="min-w-0 flex-1 leading-tight">
              <span className="text-[10px] text-[#0B6E99] font-bold block">TARGET PICKUP TIME:</span>
              <span className="font-bold font-mono text-slate-900 text-xs">
                {formatDateTime(estimatedClaimPreview)}
              </span>
            </div>
          </div>

          {/* Step 3: 1-Click Fast Payment Choice */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-800">
              Payment Status at Drop-Off
            </label>

            {/* 3 Direct Choice Buttons (1 Click Only!) */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleSelectPayment('unpaid')}
                className={`py-2 px-1 text-center rounded-lg border transition-all text-xs font-bold ${
                  paymentChoice === 'unpaid'
                    ? 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-300'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Pay Later
                <span className="block text-[9px] font-normal text-rose-600">(Unpaid)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPayment('Cash')}
                className={`py-2 px-1 text-center rounded-lg border transition-all text-xs font-bold ${
                  paymentChoice === 'Cash'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-1 ring-emerald-400'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Paid Cash
                <span className="block text-[9px] font-normal text-emerald-600">(Exact/Now)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectPayment('GCash')}
                className={`py-2 px-1 text-center rounded-lg border transition-all text-xs font-bold ${
                  paymentChoice === 'GCash'
                    ? 'bg-sky-50 text-sky-800 border-sky-400 ring-1 ring-sky-400'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Paid GCash
                <span className="block text-[9px] font-normal text-sky-600">(Online)</span>
              </button>
            </div>

            {/* If Paid in Cash: Change Calculator */}
            {paymentChoice === 'Cash' && (
              <div className="grid grid-cols-2 gap-2 pt-1 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-200">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                    Cash Tendered
                  </label>
                  <input
                    type="number"
                    step="1"
                    min={pricing.total}
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                    className="w-full px-2 py-1 text-xs font-mono font-bold bg-white border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-700 mb-0.5">
                    Change Due
                  </span>
                  <div className="px-2 py-1 text-xs font-mono font-bold text-emerald-800 bg-white border border-emerald-300 rounded">
                    {formatPHP(changePreview)}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Duplicate Warning if detected */}
          {potentialDuplicate && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-2.5 text-xs text-amber-900 space-y-1.5">
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Order <strong>{potentialDuplicate.claimSlipNumber}</strong> was logged &lt;30m ago.
                </span>
              </div>
              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-amber-950 text-[11px]">
                <input
                  type="checkbox"
                  checked={duplicateAcknowledged}
                  onChange={(e) => setDuplicateAcknowledged(e.target.checked)}
                  className="rounded border-amber-400 text-amber-600"
                />
                Confirm separate order
              </label>
            </div>
          )}

          {error && (
            <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
              {error}
            </p>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-[#0B6E99] hover:bg-[#085A7E] active:scale-[0.99] disabled:opacity-50 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            {submitting ? (
              'Saving Order...'
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Save Order & Issue Claim Slip
              </>
            )}
          </button>

          <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Automatic claim code generation & instant tracking.
          </p>
        </div>
      </div>
    </form>
  );
}
