import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Database,
  ExternalLink,
  FileSpreadsheet,
  LogOut,
  PlusCircle,
  Printer,
  QrCode,
  Search,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  recordOrderPaymentAtomic,
  saveCustomer,
  seedInitialYouLabaData,
  updateOrderStatusAtomic,
} from '../lib/firestoreService';
import {
  formatDateTime,
  formatPHP,
  getStageIndex,
  isOrderOverdue,
  isOrderUnclaimedAlert,
  normalizeClaimSlip,
  ORDER_STAGES,
  VALID_PHONE_REGEX,
  type Customer,
  type DailyReconciliation,
  type FeedbackEntry,
  type LaundryOrder,
  type OrderStatus,
  type PaidMethod,
  type PaymentRecord,
  type ServiceRate,
  type ShopSettings,
  type StatusLog,
  type UserAccount,
} from '../types/youlaba';
import { ClaimSlipModal } from './ClaimSlipModal';
import { MisReportsView } from './MisReportsView';
import { OrderIntakeForm } from './OrderIntakeForm';
import {
  ServicesSettingsPanel,
  TeamAuditFeedbackPanel,
} from './OwnerAdminPanels';
import { PaymentModal } from './PaymentModal';
import { SpreadsheetLogView } from './SpreadsheetLogView';

type WorkspaceTab =
  | 'orders'
  | 'intake'
  | 'customers'
  | 'spreadsheet'
  | 'reports'
  | 'services'
  | 'team';

interface WorkspaceAppProps {
  currentUser: UserAccount;
  services: ServiceRate[];
  shopSettings: ShopSettings;
  onBackToWebsite: () => void;
  onSignOut: () => void;
}

export function WorkspaceApp({
  currentUser,
  services,
  shopSettings,
  onBackToWebsite,
  onSignOut,
}: WorkspaceAppProps) {
  const isOwner = currentUser.role === 'owner';
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('orders');

  // Firestore real-time collections
  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([]);
  const [feedbackList, setFeedbackList] = useState<FeedbackEntry[]>([]);
  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [reconciliations, setReconciliations] = useState<DailyReconciliation[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Order Board Filters & Modals
  const [stageFilter, setStageFilter] = useState<'All' | OrderStatus>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [scanCode, setScanCode] = useState('');
  const [scanFeedback, setScanFeedback] = useState('');
  const [slipOrder, setSlipOrder] = useState<LaundryOrder | null>(null);
  const [paymentOrder, setPaymentOrder] = useState<LaundryOrder | null>(null);

  // Wrong-Status Guard confirmation dialog state
  const [statusGuard, setStatusGuard] = useState<{
    order: LaundryOrder;
    targetStatus: OrderStatus;
    reason: string;
  } | null>(null);

  // Customer Directory Quick Add
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custNotes, setCustNotes] = useState('');
  const [custError, setCustError] = useState('');
  const [custSaving, setCustSaving] = useState(false);

  // UAT Sample Data Seeding
  const [seeding, setSeeding] = useState(false);

  const actor = useMemo(
    () => ({
      uid: currentUser.uid,
      name: currentUser.displayName,
      role: (isOwner ? 'owner' : 'staff') as 'owner' | 'staff',
    }),
    [currentUser, isOwner]
  );

  // Attach real-time Firestore listeners once authenticated as active Staff/Owner
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(
        query(collection(db, 'orders'), orderBy('dropOffAt', 'desc'), limit(250)),
        (snap) => {
          setOrders(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LaundryOrder, 'id'>) }))
          );
          setLoadingData(false);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'customers'), orderBy('fullName', 'asc'), limit(300)),
        (snap) => {
          setCustomers(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Customer, 'id'>) }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'customers')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'payments'), orderBy('createdAt', 'desc'), limit(300)),
        (snap) => {
          setPayments(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentRecord, 'id'>) }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'payments')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'statusLogs'), orderBy('createdAt', 'desc'), limit(200)),
        (snap) => {
          setStatusLogs(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StatusLog, 'id'>) }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'statusLogs')
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(100)),
        (snap) => {
          setFeedbackList(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FeedbackEntry, 'id'>) }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'feedback')
      )
    );

    if (isOwner) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'users'), orderBy('email', 'asc')),
          (snap) => {
            setUsersList(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<UserAccount, 'id'>) }))
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'users')
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'dailyReconciliations'), orderBy('dateKey', 'desc'), limit(30)),
          (snap) => {
            setReconciliations(
              snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<DailyReconciliation, 'id'>),
              }))
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'dailyReconciliations')
        )
      );
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [isOwner]);

  const filteredOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return orders.filter((o) => {
      if (stageFilter !== 'All' && o.status !== stageFilter) return false;
      if (!q) return true;
      return (
        o.claimSlipNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        o.serviceName.toLowerCase().includes(q)
      );
    });
  }, [orders, stageFilter, searchTerm]);

  const alertCounts = useMemo(() => {
    let overdue = 0;
    let unclaimed = 0;
    let active = 0;
    for (const o of orders) {
      if (o.status !== 'Claimed') active++;
      if (isOrderOverdue(o)) overdue++;
      if (isOrderUnclaimedAlert(o, shopSettings.unclaimedAlertHours)) unclaimed++;
    }
    return { overdue, unclaimed, active };
  }, [orders, shopSettings.unclaimedAlertHours]);

  // Barcode / QR Claim Slip Quick Lookup
  const handleQuickScan = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = normalizeClaimSlip(scanCode);
    if (!cleaned) return;
    const match = orders.find((o) => o.claimSlipNumber.toUpperCase() === cleaned);
    if (!match) {
      setScanFeedback(`No order matching ${cleaned}`);
      return;
    }
    setScanFeedback('');
    setScanCode('');
    setSearchTerm(cleaned);
    setStageFilter('All');
    setSlipOrder(match);
  };

  // Wrong-Status Guard (Category 11 Feedback Mechanism)
  const requestStatusChange = (order: LaundryOrder, targetStatus: OrderStatus) => {
    if (order.status === targetStatus) return;

    if (order.status === 'Claimed' && !isOwner) {
      return;
    }

    const fromIdx = getStageIndex(order.status);
    const toIdx = getStageIndex(targetStatus);

    if (targetStatus === 'Claimed' && order.paymentStatus !== 'Paid') {
      // Prompt Payment Modal instead of blindly releasing unpaid laundry
      setPaymentOrder(order);
      return;
    }

    if (toIdx < fromIdx) {
      setStatusGuard({
        order,
        targetStatus,
        reason: `You are moving ${order.claimSlipNumber} backwards from "${order.status}" to "${targetStatus}". Confirm if this is a correction.`,
      });
      return;
    }

    if (toIdx - fromIdx > 1) {
      setStatusGuard({
        order,
        targetStatus,
        reason: `You are skipping intermediate stage(s) between "${order.status}" and "${targetStatus}". Confirm to proceed.`,
      });
      return;
    }

    void updateOrderStatusAtomic({
      order,
      nextStatus: targetStatus,
      note: `Advanced stage to ${targetStatus}`,
      actor,
    });
  };

  const confirmStatusGuard = async () => {
    if (!statusGuard) return;
    const { order, targetStatus } = statusGuard;
    setStatusGuard(null);
    await updateOrderStatusAtomic({
      order,
      nextStatus: targetStatus,
      note: `Confirmed non-sequential transition (${order.status} → ${targetStatus})`,
      actor,
    });
  };

  const handleRecordPayment = async (payload: {
    paymentAmount: number;
    amountTendered: number;
    method: PaidMethod;
    notes: string;
    alsoMarkClaimed: boolean;
  }) => {
    if (!paymentOrder) return;
    await recordOrderPaymentAtomic({
      order: paymentOrder,
      ...payload,
      actor,
    });
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustError('');
    if (custName.trim().length < 2) {
      setCustError('Customer name must be at least 2 characters.');
      return;
    }
    if (!VALID_PHONE_REGEX.test(custPhone.trim())) {
      setCustError('Enter a valid Philippine phone number (e.g. 0917-542-8810).');
      return;
    }
    setCustSaving(true);
    try {
      await saveCustomer(
        { fullName: custName, contactNumber: custPhone, notes: custNotes },
        currentUser.uid
      );
      setCustName('');
      setCustPhone('');
      setCustNotes('');
    } finally {
      setCustSaving(false);
    }
  };

  const handleSeedUatData = async () => {
    setSeeding(true);
    try {
      await seedInitialYouLabaData(actor);
    } finally {
      setSeeding(false);
    }
  };

  const navItems: Array<{
    id: WorkspaceTab;
    label: string;
    icon: typeof ClipboardList;
    ownerOnly?: boolean;
  }> = [
    { id: 'orders', label: 'Counter & Orders', icon: ClipboardList },
    { id: 'intake', label: 'New Order Intake', icon: PlusCircle },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'spreadsheet', label: 'Spreadsheet Log', icon: FileSpreadsheet },
    { id: 'reports', label: 'MIS Reports', icon: BarChart3, ownerOnly: true },
    { id: 'services', label: 'Services & Policies', icon: Settings, ownerOnly: true },
    { id: 'team', label: 'Team & Audit Trail', icon: ShieldCheck, ownerOnly: true },
  ];

  const currentTabTitle =
    navItems.find((n) => n.id === activeTab)?.label || 'Counter & Orders';

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Left Workspace Sidebar (248px) */}
      <aside className="w-62 shrink-0 bg-white border-r border-slate-200 hidden md:flex flex-col justify-between">
        <div>
          <div className="h-16 px-6 flex items-center justify-between border-b border-slate-200">
            <span className="font-display text-lg font-extrabold tracking-tight text-slate-900">
              {shopSettings.shopName}
            </span>
            <span className="text-[11px] font-mono text-slate-500 uppercase">
              {isOwner ? 'Owner' : 'Staff'}
            </span>
          </div>

          <nav className="p-3 space-y-1">
            {navItems
              .filter((item) => !item.ownerOnly || isOwner)
              .map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-sky-50 text-[#0B6E99]'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="px-2">
            <p className="text-xs font-bold text-slate-900 truncate">
              {currentUser.displayName}
            </p>
            <p className="text-[11px] text-slate-500 truncate font-mono">
              {currentUser.email}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={onBackToWebsite}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Public Customer Site
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Breadcrumb Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-slate-400 hidden sm:inline">YouLaba Nazareth</span>
            <span className="text-slate-300 hidden sm:inline">/</span>
            <h1 className="font-display font-bold text-slate-900 truncate">
              {currentTabTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onBackToWebsite}
              className="md:hidden px-3 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg whitespace-nowrap"
            >
              Public Site
            </button>
            {activeTab !== 'intake' && (
              <button
                type="button"
                onClick={() => setActiveTab('intake')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] rounded-lg transition-colors whitespace-nowrap"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                New Order
              </button>
            )}
          </div>
        </header>

        {/* Mobile Tab Strip */}
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-2 overflow-x-auto flex items-center gap-1.5">
          {navItems
            .filter((item) => !item.ownerOnly || isOwner)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 ${
                  activeTab === item.id
                    ? 'bg-sky-50 text-[#0B6E99]'
                    : 'text-slate-600'
                }`}
              >
                {item.label}
              </button>
            ))}
        </div>

        {/* Viewport Content */}
        <main className="p-6 max-w-[1400px] w-full mx-auto flex-1">
          {/* TAB 1: COUNTER & ORDERS TPS QUEUE */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              {/* Alert Summary & Quick QR/Barcode Scanner Strip */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-6 text-xs">
                    <div>
                      <span className="text-slate-500 block">Active Queue</span>
                      <span className="font-mono text-lg font-extrabold text-slate-900 tabular-nums">
                        {alertCounts.active}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Overdue</span>
                      <span
                        className={`font-mono text-lg font-extrabold tabular-nums ${
                          alertCounts.overdue > 0 ? 'text-red-700' : 'text-slate-900'
                        }`}
                      >
                        {alertCounts.overdue}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Unclaimed Alert</span>
                      <span
                        className={`font-mono text-lg font-extrabold tabular-nums ${
                          alertCounts.unclaimed > 0 ? 'text-amber-700' : 'text-slate-900'
                        }`}
                      >
                        {alertCounts.unclaimed}
                      </span>
                    </div>
                  </div>

                  {isOwner && orders.length === 0 && !loadingData && (
                    <button
                      type="button"
                      onClick={handleSeedUatData}
                      disabled={seeding}
                      className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#0B6E99] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Database className="w-3.5 h-3.5" />
                      {seeding ? 'Loading Sample Data...' : 'Load Sample Nazareth UAT Orders'}
                    </button>
                  )}
                </div>

                {/* Barcode / QR Claim Slip Quick Lookup */}
                <form
                  onSubmit={handleQuickScan}
                  className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-2.5"
                >
                  <QrCode className="w-4 h-4 text-[#0B6E99] shrink-0" />
                  <input
                    type="text"
                    placeholder="Scan or type Claim Slip # (e.g. YL-2026-0001)"
                    value={scanCode}
                    onChange={(e) => {
                      setScanCode(e.target.value.toUpperCase());
                      setScanFeedback('');
                    }}
                    className="flex-1 min-w-0 text-xs font-mono uppercase border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg whitespace-nowrap"
                  >
                    Lookup
                  </button>
                </form>
              </div>

              {scanFeedback && (
                <p className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
                  {scanFeedback}
                </p>
              )}

              {/* Stage Segmented Filter + Search */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
                  {(['All', ...ORDER_STAGES] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStageFilter(st)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        stageFilter === st
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div className="relative w-full xl:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search customer, phone, slip #..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                  />
                </div>
              </div>

              {/* Orders Operational Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                {loadingData ? (
                  <div className="p-8 space-y-3">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="p-12 text-center space-y-4">
                    <p className="text-sm font-bold text-slate-900">
                      {orders.length === 0
                        ? 'No laundry orders logged yet'
                        : 'No orders match your current filter'}
                    </p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      {orders.length === 0
                        ? 'Log your first customer drop-off to generate a unique QR claim slip, compute pricing automatically, and start real-time stage tracking.'
                        : 'Try clearing the search query or switching back to All stages.'}
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab('intake')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] rounded-lg"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Log First Laundry Order
                      </button>
                      {isOwner && orders.length === 0 && (
                        <button
                          type="button"
                          onClick={handleSeedUatData}
                          disabled={seeding}
                          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"
                        >
                          <Database className="w-4 h-4 text-[#0B6E99]" />
                          {seeding ? 'Seeding...' : 'Seed Nazareth UAT Sample Data'}
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                          <th className="py-3 px-4 font-semibold whitespace-nowrap">Claim Slip</th>
                          <th className="py-3 px-4 font-semibold whitespace-nowrap">Customer</th>
                          <th className="py-3 px-4 font-semibold whitespace-nowrap">Service & Load</th>
                          <th className="py-3 px-4 font-semibold whitespace-nowrap">Schedule</th>
                          <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Total / Payment</th>
                          <th className="py-3 px-4 font-semibold whitespace-nowrap">Stage Control</th>
                          <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Counter Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredOrders.map((o) => {
                          const stageIdx = getStageIndex(o.status);
                          const nextStage =
                            stageIdx >= 0 && stageIdx < ORDER_STAGES.length - 1
                              ? ORDER_STAGES[stageIdx + 1]
                              : null;
                          const overdue = isOrderOverdue(o);
                          const unclaimed = isOrderUnclaimedAlert(
                            o,
                            shopSettings.unclaimedAlertHours
                          );
                          const locked = o.status === 'Claimed' && !isOwner;

                          return (
                            <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-3 px-4 whitespace-nowrap align-top">
                                <button
                                  type="button"
                                  onClick={() => setSlipOrder(o)}
                                  className="font-mono font-bold text-[#0B6E99] hover:underline tabular-nums block"
                                >
                                  {o.claimSlipNumber}
                                </button>
                                {(overdue || unclaimed) && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 mt-1">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    {unclaimed ? 'Unclaimed' : 'Overdue'}
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4 align-top whitespace-nowrap">
                                <p className="font-semibold text-slate-900">{o.customerName}</p>
                                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                                  {o.customerPhone}
                                </p>
                              </td>

                              <td className="py-3 px-4 align-top">
                                <p className="font-medium text-slate-900 whitespace-nowrap">
                                  {o.serviceName}
                                </p>
                                <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                                  {o.quantity} {o.pricingUnit} · {o.bagCount} bag{o.bagCount > 1 ? 's' : ''}
                                </p>
                                {o.specialInstructions && (
                                  <p className="text-[11px] text-amber-800 mt-0.5 max-w-[220px] truncate">
                                    Note: {o.specialInstructions}
                                  </p>
                                )}
                              </td>

                              <td className="py-3 px-4 align-top whitespace-nowrap font-mono tabular-nums text-[11px]">
                                <p className="text-slate-600">In: {formatDateTime(o.dropOffAt)}</p>
                                <p className="text-slate-900 font-semibold">
                                  {o.claimedAt
                                    ? `Claimed: ${formatDateTime(o.claimedAt)}`
                                    : `Est: ${formatDateTime(o.estimatedClaimAt)}`}
                                </p>
                              </td>

                              <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                                <p className="font-mono font-bold text-slate-900 tabular-nums">
                                  {formatPHP(o.totalPrice)}
                                </p>
                                <p
                                  className={`text-[11px] font-semibold ${
                                    o.paymentStatus === 'Paid'
                                      ? 'text-emerald-700'
                                      : o.paymentStatus === 'Partial'
                                      ? 'text-amber-700'
                                      : 'text-red-700'
                                  }`}
                                >
                                  {o.paymentStatus}
                                  {o.paymentMethod !== 'None' ? ` · ${o.paymentMethod}` : ''}
                                </p>
                              </td>

                              <td className="py-3 px-4 align-top whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <select
                                    aria-label={`Order status for ${o.claimSlipNumber}`}
                                    value={o.status}
                                    disabled={locked}
                                    onChange={(e) =>
                                      requestStatusChange(o, e.target.value as OrderStatus)
                                    }
                                    className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-md disabled:bg-slate-100 disabled:text-slate-500"
                                  >
                                    {ORDER_STAGES.map((st) => (
                                      <option key={st} value={st}>
                                        {st}
                                      </option>
                                    ))}
                                  </select>
                                  {nextStage && !locked && (
                                    <button
                                      type="button"
                                      onClick={() => requestStatusChange(o, nextStage)}
                                      title={`Move to ${nextStage}`}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-[#0B6E99] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-md transition-colors whitespace-nowrap"
                                    >
                                      {nextStage === 'Claimed' ? (
                                        <>
                                          <CheckCircle2 className="w-3 h-3" />
                                          Release
                                        </>
                                      ) : (
                                        <>
                                          Next
                                          <ArrowRight className="w-3 h-3" />
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-4 align-top text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1.5">
                                  {o.paymentStatus !== 'Paid' && !locked && (
                                    <button
                                      type="button"
                                      onClick={() => setPaymentOrder(o)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] rounded-md transition-colors"
                                    >
                                      <CreditCard className="w-3 h-3" />
                                      Pay
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setSlipOrder(o)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors"
                                  >
                                    <Printer className="w-3 h-3" />
                                    Slip / Tag
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: NEW ORDER INTAKE */}
          {activeTab === 'intake' && (
            <OrderIntakeForm
              customers={customers}
              services={services}
              orders={orders}
              shopSettings={shopSettings}
              actor={actor}
              onOrderCreated={(created) => {
                setActiveTab('orders');
                setSlipOrder(created);
              }}
            />
          )}

          {/* TAB 3: PROTECTED CUSTOMER DIRECTORY */}
          {activeTab === 'customers' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="text-sm font-bold text-slate-900">
                    Registered Customers ({customers.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Accessible only to verified YouLaba staff and owner under the Data Privacy Act of 2012.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="py-3 px-5 font-semibold">Full Name</th>
                        <th className="py-3 px-5 font-semibold">Contact Number</th>
                        <th className="py-3 px-5 font-semibold">Care Notes</th>
                        <th className="py-3 px-5 font-semibold text-right">Orders</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-slate-500">
                            No customers registered yet. Add a customer on the right or during New Order Intake.
                          </td>
                        </tr>
                      ) : (
                        customers.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-5 font-semibold text-slate-900 whitespace-nowrap">
                              {c.fullName}
                            </td>
                            <td className="py-3 px-5 font-mono text-slate-700 whitespace-nowrap tabular-nums">
                              {c.contactNumber}
                            </td>
                            <td className="py-3 px-5 text-slate-600">{c.notes || '—'}</td>
                            <td className="py-3 px-5 text-right font-mono font-semibold text-slate-900 tabular-nums">
                              {c.totalOrders}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <form
                onSubmit={handleAddCustomer}
                className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
                  Register Customer
                </h3>
                <div>
                  <label htmlFor="dir-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    id="dir-name"
                    type="text"
                    maxLength={100}
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    placeholder="e.g. Carlo Mendoza"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="dir-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Number *
                  </label>
                  <input
                    id="dir-phone"
                    type="tel"
                    maxLength={20}
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    placeholder="0917-542-8810"
                    className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="dir-notes" className="block text-xs font-semibold text-slate-700 mb-1">
                    Garment Care Preferences
                  </label>
                  <textarea
                    id="dir-notes"
                    rows={2}
                    maxLength={250}
                    value={custNotes}
                    onChange={(e) => setCustNotes(e.target.value)}
                    placeholder="Optional detergent or folding preference"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                {custError && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {custError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={custSaving}
                  className="w-full py-2.5 text-xs font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] disabled:opacity-60 rounded-lg transition-colors"
                >
                  {custSaving ? 'Saving...' : 'Save Customer'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 4: SPREADSHEET ORDER LOG & MISMATCH CHECKER */}
          {activeTab === 'spreadsheet' && (
            <SpreadsheetLogView
              orders={orders}
              onSelectSlip={(order) => setSlipOrder(order)}
            />
          )}

          {/* TAB 5: OWNER MIS REPORTS & DAILY RECONCILIATION */}
          {activeTab === 'reports' && isOwner && (
            <MisReportsView
              orders={orders}
              payments={payments}
              reconciliations={reconciliations}
              shopSettings={shopSettings}
              actor={{ uid: currentUser.uid, name: currentUser.displayName }}
            />
          )}

          {/* TAB 6: OWNER SERVICES & SHOP POLICIES */}
          {activeTab === 'services' && isOwner && (
            <ServicesSettingsPanel
              services={services}
              shopSettings={shopSettings}
            />
          )}

          {/* TAB 7: OWNER TEAM RBAC, AUDIT TRAIL & FEEDBACK */}
          {activeTab === 'team' && isOwner && (
            <TeamAuditFeedbackPanel
              users={usersList}
              currentUserId={currentUser.uid}
              statusLogs={statusLogs}
              feedbackList={feedbackList}
            />
          )}
        </main>
      </div>

      {/* Wrong-Status / Non-Sequential Transition Guard Dialog */}
      {statusGuard && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Confirm Non-Sequential Status Change
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {statusGuard.reason}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setStatusGuard(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmStatusGuard()}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
              >
                Confirm Transition
              </button>
            </div>
          </div>
        </div>
      )}

      {slipOrder && (
        <ClaimSlipModal
          order={slipOrder}
          shopSettings={shopSettings}
          onClose={() => setSlipOrder(null)}
        />
      )}

      {paymentOrder && (
        <PaymentModal
          order={paymentOrder}
          onClose={() => setPaymentOrder(null)}
          onSubmit={handleRecordPayment}
        />
      )}
    </div>
  );
}
