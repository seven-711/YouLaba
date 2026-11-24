import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, CheckCircle2, ClipboardCheck } from 'lucide-react';
import {
  formatDateTime,
  formatPHP,
  getLocalDateKey,
  isOrderOverdue,
  isOrderUnclaimedAlert,
  type DailyReconciliation,
  type LaundryOrder,
  type PaymentRecord,
  type ShopSettings,
} from '../types/youlaba';
import { saveDailyReconciliation } from '../lib/firestoreService';

interface MisReportsViewProps {
  orders: LaundryOrder[];
  payments: PaymentRecord[];
  reconciliations: DailyReconciliation[];
  shopSettings: ShopSettings;
  actor: { uid: string; name: string };
}

type PeriodFilter = 'daily' | 'weekly' | 'monthly';

export function MisReportsView({
  orders,
  payments,
  reconciliations,
  shopSettings,
  actor,
}: MisReportsViewProps) {
  const [period, setPeriod] = useState<PeriodFilter>('weekly');

  const todayKey = getLocalDateKey();

  // Period-filtered orders
  const periodOrders = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const cutoff =
      period === 'daily'
        ? startOfToday
        : period === 'weekly'
        ? startOfToday - 6 * 24 * 60 * 60 * 1000
        : startOfToday - 29 * 24 * 60 * 60 * 1000;

    return orders.filter((o) => {
      const ms = new Date(o.dropOffAt).getTime();
      return !Number.isNaN(ms) && ms >= cutoff;
    });
  }, [orders, period]);

  const kpis = useMemo(() => {
    const totalSales = periodOrders.reduce((sum, o) => sum + o.totalPrice, 0);
    const collected = periodOrders.reduce((sum, o) => sum + o.amountPaid, 0);
    const pendingCount = orders.filter(
      (o) => o.status !== 'Claimed' && o.status !== 'Ready for Pickup'
    ).length;
    const readyCount = orders.filter((o) => o.status === 'Ready for Pickup').length;
    const unclaimedCount = orders.filter((o) =>
      isOrderUnclaimedAlert(o, shopSettings.unclaimedAlertHours)
    ).length;
    const overdueCount = orders.filter((o) => isOrderOverdue(o)).length;
    return {
      totalSales,
      collected,
      orderCount: periodOrders.length,
      pendingCount,
      readyCount,
      unclaimedCount,
      overdueCount,
    };
  }, [periodOrders, orders, shopSettings.unclaimedAlertHours]);

  // Daily chart trend for selected window
  const chartData = useMemo(() => {
    const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 14;
    const buckets: { dateKey: string; label: string; revenue: number; orders: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = getLocalDateKey(d);
      const label = d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
      buckets.push({ dateKey: key, label, revenue: 0, orders: 0 });
    }
    const map = new Map(buckets.map((b) => [b.dateKey, b]));
    for (const o of orders) {
      const d = new Date(o.dropOffAt);
      if (Number.isNaN(d.getTime())) continue;
      const key = getLocalDateKey(d);
      const bucket = map.get(key);
      if (bucket) {
        bucket.revenue = Math.round((bucket.revenue + o.totalPrice) * 100) / 100;
        bucket.orders += 1;
      }
    }
    return buckets;
  }, [orders, period]);

  // Service Mix Breakdown
  const serviceMix = useMemo(() => {
    const counts = new Map<string, { name: string; count: number; revenue: number }>();
    for (const o of periodOrders) {
      const prev = counts.get(o.serviceName) || { name: o.serviceName, count: 0, revenue: 0 };
      prev.count += 1;
      prev.revenue += o.totalPrice;
      counts.set(o.serviceName, prev);
    }
    return Array.from(counts.values()).sort((a, b) => b.revenue - a.revenue);
  }, [periodOrders]);

  // Payment Method Breakdown
  const paymentBreakdown = useMemo(() => {
    const totals: Record<string, number> = { Cash: 0, GCash: 0, 'Bank Transfer': 0 };
    for (const p of payments) {
      totals[p.method] = (totals[p.method] || 0) + p.amount;
    }
    return totals;
  }, [payments]);

  // Today's System Figures for Cash & Bag Reconciliation (Category 11)
  const todayStats = useMemo(() => {
    const todayOrders = orders.filter((o) => {
      const d = new Date(o.dropOffAt);
      return !Number.isNaN(d.getTime()) && getLocalDateKey(d) === todayKey;
    });
    const systemBagCount = todayOrders.reduce((s, o) => s + o.bagCount, 0);
    const systemCashTotal = todayOrders
      .filter((o) => o.paymentMethod === 'Cash')
      .reduce((s, o) => s + o.amountPaid, 0);
    return { systemBagCount, systemCashTotal, todayOrdersCount: todayOrders.length };
  }, [orders, todayKey]);

  const [actualCash, setActualCash] = useState<string>('');
  const [actualBags, setActualBags] = useState<string>('');
  const [recNotes, setRecNotes] = useState('');
  const [recSaving, setRecSaving] = useState(false);
  const [recMessage, setRecMessage] = useState('');

  const parsedActualCash = parseFloat(actualCash);
  const parsedActualBags = parseInt(actualBags, 10);
  const hasCashInput = !Number.isNaN(parsedActualCash);
  const hasBagInput = !Number.isNaN(parsedActualBags);
  const cashVariance = hasCashInput
    ? Math.round((parsedActualCash - todayStats.systemCashTotal) * 100) / 100
    : 0;
  const bagVariance = hasBagInput ? parsedActualBags - todayStats.systemBagCount : 0;

  const handleSaveReconciliation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasCashInput || !hasBagInput) return;
    setRecSaving(true);
    setRecMessage('');
    try {
      await saveDailyReconciliation({
        dateKey: todayKey,
        systemCashTotal: todayStats.systemCashTotal,
        actualCashCounted: parsedActualCash,
        cashVariance,
        systemBagCount: todayStats.systemBagCount,
        actualBagCount: parsedActualBags,
        bagVariance,
        notes: recNotes,
        checkedByUid: actor.uid,
        checkedByName: actor.name,
      });
      setRecMessage(`Reconciliation saved for ${todayKey}.`);
      setRecNotes('');
    } finally {
      setRecSaving(false);
    }
  };

  const attentionOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === 'Ready for Pickup' ||
          isOrderOverdue(o) ||
          isOrderUnclaimedAlert(o, shopSettings.unclaimedAlertHours)
      ),
    [orders, shopSettings.unclaimedAlertHours]
  );

  return (
    <div className="space-y-6">
      {/* Period Switcher Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Management Information System (MIS) Reports
          </h2>
          <p className="text-xs text-slate-500">
            Summarized sales, order volumes, service performance, and daily cash/bag reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          {(['daily', 'weekly', 'monthly'] as PeriodFilter[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors whitespace-nowrap ${
                period === p
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Top KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Billed Sales ({period})</p>
          <p className="font-mono text-2xl font-extrabold text-slate-900 tabular-nums mt-1.5">
            {formatPHP(kpis.totalSales)}
          </p>
          <p className="text-xs text-emerald-700 font-mono tabular-nums mt-1">
            Collected: {formatPHP(kpis.collected)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Orders Received ({period})</p>
          <p className="font-mono text-2xl font-extrabold text-slate-900 tabular-nums mt-1.5">
            {kpis.orderCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Across all Nazareth counter services
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">In-Progress / Pending</p>
          <p className="font-mono text-2xl font-extrabold text-[#0B6E99] tabular-nums mt-1.5">
            {kpis.pendingCount}
          </p>
          <p className="text-xs text-amber-700 mt-1">
            {kpis.overdueCount} past estimated claim time
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Ready / Unclaimed</p>
          <p className="font-mono text-2xl font-extrabold text-slate-900 tabular-nums mt-1.5">
            {kpis.readyCount}
          </p>
          <p className="text-xs text-red-700 mt-1">
            {kpis.unclaimedCount} waiting over {shopSettings.unclaimedAlertHours}h
          </p>
        </div>
      </div>

      {/* Revenue Chart + Service Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">
              Revenue Trend (PHP)
            </h3>
            <p className="text-xs text-slate-500">
              Daily order billing across recent operating days
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₱${v}`}
                />
                <Tooltip
                  formatter={(value) => [formatPHP(Number(value ?? 0)), 'Revenue']}
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="revenue" fill="#0B6E99" radius={[4, 4, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Service Breakdown</h3>
            <p className="text-xs text-slate-500">Orders and billed total by service</p>
          </div>

          <div className="space-y-3">
            {serviceMix.length === 0 ? (
              <p className="text-xs text-slate-500">No orders in this period.</p>
            ) : (
              serviceMix.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-xs pb-2.5 border-b border-slate-100 last:border-0">
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-slate-500 font-mono tabular-nums">{item.count} orders</p>
                  </div>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {formatPHP(item.revenue)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-slate-200 space-y-2">
            <p className="text-xs font-bold text-slate-900">Recorded Payments by Method</p>
            {Object.entries(paymentBreakdown).map(([method, amt]) => (
              <div key={method} className="flex justify-between text-xs">
                <span className="text-slate-600">{method}</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {formatPHP(amt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Cash & Bag Reconciliation Tool (Category 11 Feedback Mechanism) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSaveReconciliation}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <ClipboardCheck className="w-5 h-5 text-[#0B6E99]" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Daily Cash & Laundry Bag Reconciliation ({todayKey})
                </h3>
                <p className="text-xs text-slate-500">
                  Verify system records against physical cash in the drawer and bags received today.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs">
            <div>
              <span className="text-slate-500 block">System Cash Recorded Today</span>
              <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                {formatPHP(todayStats.systemCashTotal)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">System Bags Received Today</span>
              <span className="font-mono text-lg font-bold text-slate-900 tabular-nums">
                {todayStats.systemBagCount} bags ({todayStats.todayOrdersCount} orders)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rec-cash" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Actual Cash Counted in Drawer (₱) *
              </label>
              <input
                id="rec-cash"
                type="number"
                step="0.01"
                min="0"
                placeholder={todayStats.systemCashTotal.toFixed(2)}
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
                required
              />
              {hasCashInput && (
                <p
                  className={`text-xs font-mono mt-1 tabular-nums ${
                    Math.abs(cashVariance) < 0.01 ? 'text-emerald-700' : 'text-red-700 font-semibold'
                  }`}
                >
                  Variance: {cashVariance >= 0 ? '+' : ''}
                  {formatPHP(cashVariance)}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="rec-bags" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Actual Physical Bags Counted *
              </label>
              <input
                id="rec-bags"
                type="number"
                min="0"
                placeholder={String(todayStats.systemBagCount)}
                value={actualBags}
                onChange={(e) => setActualBags(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
                required
              />
              {hasBagInput && (
                <p
                  className={`text-xs font-mono mt-1 tabular-nums ${
                    bagVariance === 0 ? 'text-emerald-700' : 'text-red-700 font-semibold'
                  }`}
                >
                  Variance: {bagVariance >= 0 ? `+${bagVariance}` : bagVariance} bag(s)
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="rec-notes" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Owner Verification Notes
            </label>
            <input
              id="rec-notes"
              type="text"
              maxLength={300}
              placeholder="e.g. Verified closing cash and shelf bag tags at 8:00 PM"
              value={recNotes}
              onChange={(e) => setRecNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          {recMessage && (
            <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {recMessage}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={recSaving || !hasCashInput || !hasBagInput}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              {recSaving ? 'Saving...' : 'Save Daily Reconciliation'}
            </button>
          </div>
        </form>

        {/* Past Reconciliation History & Attention List */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Ready, Overdue & Unclaimed Watchlist
            </h3>
            {attentionOrders.length === 0 ? (
              <p className="text-xs text-slate-500">No overdue or unclaimed alerts right now.</p>
            ) : (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {attentionOrders.map((o) => {
                  const overdue = isOrderOverdue(o);
                  const unclaimed = isOrderUnclaimedAlert(o, shopSettings.unclaimedAlertHours);
                  return (
                    <div
                      key={o.id}
                      className="text-xs pb-3 border-b border-slate-100 last:border-0 flex items-start justify-between gap-3"
                    >
                      <div>
                        <p className="font-mono font-bold text-slate-900">
                          {o.claimSlipNumber} · <span className="font-sans font-semibold">{o.customerName}</span>
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          {o.status} · Est. {formatDateTime(o.estimatedClaimAt)}
                        </p>
                      </div>
                      {(overdue || unclaimed) && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {unclaimed ? 'Unclaimed' : 'Overdue'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-3">
              Recent Daily Reconciliations
            </h3>
            {reconciliations.length === 0 ? (
              <p className="text-xs text-slate-500">No closing reconciliations saved yet.</p>
            ) : (
              <div className="space-y-3">
                {reconciliations.slice(0, 5).map((r) => (
                  <div key={r.id} className="text-xs pb-2.5 border-b border-slate-100 last:border-0">
                    <div className="flex justify-between font-mono">
                      <span className="font-bold text-slate-900">{r.dateKey}</span>
                      <span
                        className={
                          Math.abs(r.cashVariance) < 0.01 && r.bagVariance === 0
                            ? 'text-emerald-700 font-semibold'
                            : 'text-amber-700 font-semibold'
                        }
                      >
                        Cash {r.cashVariance >= 0 ? '+' : ''}
                        {formatPHP(r.cashVariance)} · Bags {r.bagVariance >= 0 ? `+${r.bagVariance}` : r.bagVariance}
                      </span>
                    </div>
                    <p className="text-slate-500 mt-0.5">
                      Checked by {r.checkedByName}
                      {r.notes ? ` · ${r.notes}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
