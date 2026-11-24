import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  MessageSquare,
  Plus,
  Save,
  Shield,
  Star,
  Trash2,
} from 'lucide-react';
import {
  formatPHP,
  type FeedbackEntry,
  type FeedbackStatus,
  type PricingUnit,
  type ServiceCategory,
  type ServiceRate,
  type ShopSettings,
  type StatusLog,
  type UserAccount,
  type UserRole,
} from '../types/youlaba';
import {
  deleteServiceRate,
  saveServiceRate,
  saveShopSettings,
  updateFeedbackStatus,
  updateUserRoleAndStatus,
} from '../lib/firestoreService';

interface ServicesSettingsPanelProps {
  services: ServiceRate[];
  shopSettings: ShopSettings;
}

export function ServicesSettingsPanel({
  services,
  shopSettings,
}: ServicesSettingsPanelProps) {
  // New / Edit Service Form
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pricingUnit, setPricingUnit] = useState<PricingUnit>('kg');
  const [rate, setRate] = useState('40');
  const [minQuantity, setMinQuantity] = useState('3');
  const [turnaroundHours, setTurnaroundHours] = useState('24');
  const [category, setCategory] = useState<ServiceCategory>('Regular');
  const [active, setActive] = useState(true);
  const [svcSaving, setSvcSaving] = useState(false);

  // Shop Policies Form
  const [policyForm, setPolicyForm] = useState<ShopSettings>(shopSettings);
  const [policySaved, setPolicySaved] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);

  useEffect(() => {
    setPolicyForm(shopSettings);
  }, [shopSettings]);

  const startEdit = (svc: ServiceRate) => {
    setEditingId(svc.id);
    setName(svc.name);
    setDescription(svc.description);
    setPricingUnit(svc.pricingUnit);
    setRate(String(svc.rate));
    setMinQuantity(String(svc.minQuantity));
    setTurnaroundHours(String(svc.turnaroundHours));
    setCategory(svc.category);
    setActive(svc.active);
  };

  const resetForm = () => {
    setEditingId(undefined);
    setName('');
    setDescription('');
    setPricingUnit('kg');
    setRate('40');
    setMinQuantity('3');
    setTurnaroundHours('24');
    setCategory('Regular');
    setActive(true);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    setSvcSaving(true);
    try {
      await saveServiceRate({
        id: editingId,
        name,
        description,
        pricingUnit,
        rate: Math.max(1, parseFloat(rate) || 1),
        minQuantity: Math.max(0.5, parseFloat(minQuantity) || 1),
        turnaroundHours: Math.max(1, parseFloat(turnaroundHours) || 24),
        category,
        active,
      });
      resetForm();
    } finally {
      setSvcSaving(false);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setPolicySaving(true);
    setPolicySaved(false);
    try {
      await saveShopSettings(policyForm);
      setPolicySaved(true);
      setTimeout(() => setPolicySaved(false), 3000);
    } finally {
      setPolicySaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Service Catalog Table */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">
              Active Services & Pricing Table
            </h3>
            <p className="text-xs text-slate-500">
              Changes reflect immediately on the public customer website and counter intake.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {services.map((svc) => (
              <div
                key={svc.id}
                className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/70"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {svc.name}{' '}
                    {!svc.active && (
                      <span className="text-xs font-normal text-slate-400">(Inactive)</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {svc.category} · Min {svc.minQuantity} {svc.pricingUnit} · {svc.turnaroundHours}h turnaround
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-sm font-bold text-[#0B6E99] tabular-nums">
                    {formatPHP(svc.rate)}/{svc.pricingUnit}
                  </span>
                  <button
                    type="button"
                    onClick={() => startEdit(svc)}
                    className="px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-100 rounded-md"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteServiceRate(svc.id)}
                    aria-label={`Delete ${svc.name}`}
                    className="p-1.5 text-slate-400 hover:text-red-700 rounded-md"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Add / Edit Service Rate Form */}
        <form
          onSubmit={handleSaveService}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">
              {editingId ? 'Edit Service Rate' : 'Add New Service'}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-500 hover:text-slate-900"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div>
            <label htmlFor="svc-name" className="block text-xs font-semibold text-slate-700 mb-1">
              Service Name *
            </label>
            <input
              id="svc-name"
              type="text"
              maxLength={80}
              placeholder="e.g. Wash, Dry & Fold (Regular)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              required
            />
          </div>

          <div>
            <label htmlFor="svc-desc" className="block text-xs font-semibold text-slate-700 mb-1">
              Short Description
            </label>
            <textarea
              id="svc-desc"
              rows={2}
              maxLength={260}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="svc-rate" className="block text-xs font-semibold text-slate-700 mb-1">
                Rate (₱) *
              </label>
              <input
                id="svc-rate"
                type="number"
                step="1"
                min="1"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label htmlFor="svc-unit" className="block text-xs font-semibold text-slate-700 mb-1">
                Pricing Unit
              </label>
              <select
                id="svc-unit"
                value={pricingUnit}
                onChange={(e) => setPricingUnit(e.target.value as PricingUnit)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              >
                <option value="kg">per kg</option>
                <option value="load">per load</option>
                <option value="piece">per piece</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="svc-min" className="block text-xs font-semibold text-slate-700 mb-1">
                Min Qty
              </label>
              <input
                id="svc-min"
                type="number"
                step="0.5"
                min="0.5"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="svc-hrs" className="block text-xs font-semibold text-slate-700 mb-1">
                Turnaround (h)
              </label>
              <input
                id="svc-hrs"
                type="number"
                min="1"
                value={turnaroundHours}
                onChange={(e) => setTurnaroundHours(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="svc-cat" className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                id="svc-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as ServiceCategory)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg"
              >
                <option value="Regular">Regular</option>
                <option value="Express">Express</option>
                <option value="Specialty">Specialty</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="rounded border-slate-300 text-[#0B6E99]"
            />
            Show on public website & allow at counter intake
          </label>

          <button
            type="submit"
            disabled={svcSaving}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] disabled:opacity-60 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            {svcSaving ? 'Saving...' : editingId ? 'Update Service Rate' : 'Add Service Rate'}
          </button>
        </form>
      </div>

      {/* Shop Policies, Turnaround & Active Promo */}
      <form
        onSubmit={handleSavePolicy}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      >
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">
            Shop Policies, Branch Contact & Active Promotions
          </h3>
          <p className="text-xs text-slate-500">
            Updates claim slips, unclaimed alert thresholds, and the public Nazareth website.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label htmlFor="pol-addr" className="block text-xs font-semibold text-slate-700 mb-1">
              Branch Address
            </label>
            <input
              id="pol-addr"
              type="text"
              maxLength={200}
              value={policyForm.branchAddress}
              onChange={(e) => setPolicyForm({ ...policyForm, branchAddress: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="pol-phone" className="block text-xs font-semibold text-slate-700 mb-1">
              Contact Phone
            </label>
            <input
              id="pol-phone"
              type="text"
              maxLength={40}
              value={policyForm.contactPhone}
              onChange={(e) => setPolicyForm({ ...policyForm, contactPhone: e.target.value })}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="pol-hours" className="block text-xs font-semibold text-slate-700 mb-1">
              Operating Hours
            </label>
            <input
              id="pol-hours"
              type="text"
              maxLength={120}
              value={policyForm.operatingHours}
              onChange={(e) => setPolicyForm({ ...policyForm, operatingHours: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="pol-unclaimed" className="block text-xs font-semibold text-slate-700 mb-1">
              Unclaimed Alert After (Hours)
            </label>
            <input
              id="pol-unclaimed"
              type="number"
              min="1"
              max="720"
              value={policyForm.unclaimedAlertHours}
              onChange={(e) =>
                setPolicyForm({
                  ...policyForm,
                  unclaimedAlertHours: parseInt(e.target.value, 10) || 48,
                })
              }
              className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="pol-promo" className="block text-xs font-semibold text-slate-700 mb-1">
              Active Promo Code & % Off
            </label>
            <div className="flex gap-2">
              <input
                id="pol-promo"
                type="text"
                maxLength={32}
                value={policyForm.activePromoCode}
                onChange={(e) =>
                  setPolicyForm({ ...policyForm, activePromoCode: e.target.value.toUpperCase() })
                }
                className="flex-1 px-3 py-2 text-sm font-mono uppercase border border-slate-300 rounded-lg"
              />
              <input
                aria-label="Promo percent off"
                type="number"
                min="0"
                max="100"
                value={policyForm.activePromoPercent}
                onChange={(e) =>
                  setPolicyForm({
                    ...policyForm,
                    activePromoPercent: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-20 px-2.5 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div>
            <label htmlFor="pol-label" className="block text-xs font-semibold text-slate-700 mb-1">
              Promo Display Description
            </label>
            <input
              id="pol-label"
              type="text"
              maxLength={120}
              value={policyForm.activePromoLabel}
              onChange={(e) => setPolicyForm({ ...policyForm, activePromoLabel: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {policySaved ? (
            <span className="text-xs font-medium text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Shop policies updated.
            </span>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={policySaving}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {policySaving ? 'Saving...' : 'Save Shop Policies'}
          </button>
        </div>
      </form>
    </div>
  );
}

interface TeamAuditFeedbackPanelProps {
  users: UserAccount[];
  currentUserId: string;
  statusLogs: StatusLog[];
  feedbackList: FeedbackEntry[];
}

export function TeamAuditFeedbackPanel({
  users,
  currentUserId,
  statusLogs,
  feedbackList,
}: TeamAuditFeedbackPanelProps) {
  const [subTab, setSubTab] = useState<'team' | 'audit' | 'feedback'>('team');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setSubTab('team')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
            subTab === 'team' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Team Accounts ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('audit')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
            subTab === 'audit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Audit Trail ({statusLogs.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('feedback')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
            subTab === 'feedback' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Customer Feedback ({feedbackList.length})
        </button>
      </div>

      {subTab === 'team' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-[#0B6E99]" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Staff & Owner Access Control
              </h3>
              <p className="text-xs text-slate-500">
                New staff members sign in with Google at the Staff Portal and appear here as Pending until you approve them.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-5 font-semibold">Team Member</th>
                  <th className="py-3 px-5 font-semibold">Email</th>
                  <th className="py-3 px-5 font-semibold">Role</th>
                  <th className="py-3 px-5 font-semibold">Access Status</th>
                  <th className="py-3 px-5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isSelf = u.uid === currentUserId;
                  return (
                    <tr key={u.id}>
                      <td className="py-3 px-5 font-semibold text-slate-900">
                        {u.displayName} {isSelf && <span className="text-slate-400 font-normal">(You)</span>}
                      </td>
                      <td className="py-3 px-5 font-mono text-slate-600">{u.email}</td>
                      <td className="py-3 px-5 capitalize font-medium text-slate-800">{u.role}</td>
                      <td className="py-3 px-5">
                        <span className={u.active ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                          {u.active ? 'Active' : 'Pending / Disabled'}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-right space-x-2 whitespace-nowrap">
                        {!isSelf && (
                          <>
                            <select
                              aria-label={`Set role for ${u.displayName}`}
                              value={u.role}
                              onChange={(e) =>
                                void updateUserRoleAndStatus(u.id, {
                                  role: e.target.value as UserRole,
                                  active: e.target.value !== 'pending' ? true : false,
                                })
                              }
                              className="px-2 py-1 text-xs bg-white border border-slate-300 rounded-md"
                            >
                              <option value="pending">Pending</option>
                              <option value="staff">Staff Attendant</option>
                              <option value="owner">Shop Owner</option>
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                void updateUserRoleAndStatus(u.id, {
                                  role: u.role === 'pending' ? 'staff' : u.role,
                                  active: !u.active,
                                })
                              }
                              className="px-2.5 py-1 text-xs font-semibold border border-slate-200 rounded-md hover:bg-slate-50"
                            >
                              {u.active ? 'Revoke' : 'Approve'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">
              Immutable Order Audit Trail
            </h3>
            <p className="text-xs text-slate-500">
              Tamper-proof history recording who created or updated every order, payment, and claim release.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-5 font-semibold">Timestamp</th>
                  <th className="py-3 px-5 font-semibold">Claim Slip #</th>
                  <th className="py-3 px-5 font-semibold">Action</th>
                  <th className="py-3 px-5 font-semibold">Transition</th>
                  <th className="py-3 px-5 font-semibold">Performed By</th>
                  <th className="py-3 px-5 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statusLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No audit trail entries recorded yet.
                    </td>
                  </tr>
                ) : (
                  statusLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-5 font-mono text-slate-600 whitespace-nowrap tabular-nums">
                        {log.createdAt
                          ? log.createdAt.toDate().toLocaleString('en-PH', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : 'Just now'}
                      </td>
                      <td className="py-2.5 px-5 font-mono font-semibold text-slate-900 whitespace-nowrap">
                        {log.claimSlipNumber}
                      </td>
                      <td className="py-2.5 px-5 font-medium text-slate-700 whitespace-nowrap">
                        {log.action.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2.5 px-5 whitespace-nowrap">
                        {log.fromStatus ? `${log.fromStatus} → ` : ''}
                        <strong className="text-[#0B6E99]">{log.toStatus}</strong>
                      </td>
                      <td className="py-2.5 px-5 whitespace-nowrap">
                        {log.actorName}{' '}
                        <span className="text-slate-400">({log.actorRole})</span>
                      </td>
                      <td className="py-2.5 px-5 text-slate-600">{log.note}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {subTab === 'feedback' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2.5">
            <MessageSquare className="w-4 h-4 text-[#0B6E99]" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Customer & Staff Feedback Inbox
              </h3>
              <p className="text-xs text-slate-500">
                Review service comments and mark reported issues as Resolved.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {feedbackList.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">
                No feedback submissions yet.
              </p>
            ) : (
              feedbackList.map((fb) => (
                <div key={fb.id} className="p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-bold text-slate-900">{fb.authorName}</span>
                      <span>·</span>
                      <span>{fb.category}</span>
                      {fb.claimSlipNumber && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-[#0B6E99]">{fb.claimSlipNumber}</span>
                        </>
                      )}
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5 text-amber-600 font-mono">
                        <Star className="w-3 h-3 fill-amber-400" />
                        {fb.rating}/5
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{fb.message}</p>
                  </div>

                  <div className="shrink-0">
                    <select
                      aria-label={`Status for feedback by ${fb.authorName}`}
                      value={fb.status}
                      onChange={(e) =>
                        void updateFeedbackStatus(fb.id, e.target.value as FeedbackStatus)
                      }
                      className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="Open">Open</option>
                      <option value="Reviewed">Reviewed</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
