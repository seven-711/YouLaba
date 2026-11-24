import { useState } from 'react';
import { CheckCircle2, CreditCard, X } from 'lucide-react';
import {
  formatPHP,
  PAID_METHODS,
  type LaundryOrder,
  type PaidMethod,
} from '../types/youlaba';

interface PaymentModalProps {
  order: LaundryOrder;
  onClose: () => void;
  onSubmit: (payload: {
    paymentAmount: number;
    amountTendered: number;
    method: PaidMethod;
    notes: string;
    alsoMarkClaimed: boolean;
  }) => Promise<void>;
}

export function PaymentModal({ order, onClose, onSubmit }: PaymentModalProps) {
  const remainingBalance = Math.max(
    0,
    Math.round((order.totalPrice - order.amountPaid) * 100) / 100
  );

  const [paymentAmount, setPaymentAmount] = useState<string>(
    remainingBalance > 0 ? remainingBalance.toFixed(2) : order.totalPrice.toFixed(2)
  );
  const [amountTendered, setAmountTendered] = useState<string>(
    remainingBalance > 0 ? remainingBalance.toFixed(2) : order.totalPrice.toFixed(2)
  );
  const [method, setMethod] = useState<PaidMethod>('Cash');
  const [notes, setNotes] = useState('');
  const [alsoMarkClaimed, setAlsoMarkClaimed] = useState(
    order.status === 'Ready for Pickup'
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const parsedAmount = parseFloat(paymentAmount) || 0;
  const parsedTendered = parseFloat(amountTendered) || 0;
  const changeGiven = Math.max(0, Math.round((parsedTendered - parsedAmount) * 100) / 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (parsedAmount <= 0) {
      setError('Enter a valid payment amount greater than zero.');
      return;
    }
    if (remainingBalance > 0 && parsedAmount > remainingBalance + 0.01) {
      setError(`Payment exceeds remaining balance of ${formatPHP(remainingBalance)}.`);
      return;
    }
    if (parsedTendered < parsedAmount) {
      setError('Amount tendered must be equal to or greater than the payment amount.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        paymentAmount: parsedAmount,
        amountTendered: parsedTendered,
        method,
        notes,
        alsoMarkClaimed,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record payment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Record laundry order payment"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Record Payment
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="font-mono font-semibold text-slate-700">{order.claimSlipNumber}</span>
              {' · '}
              {order.customerName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Close payment modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Balance Breakdown */}
          <div className="grid grid-cols-3 gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs">
            <div>
              <span className="text-slate-500 block">Order Total</span>
              <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
                {formatPHP(order.totalPrice)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Already Paid</span>
              <span className="font-mono font-semibold text-emerald-700 text-sm tabular-nums">
                {formatPHP(order.amountPaid)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Balance Due</span>
              <span className="font-mono font-bold text-[#0B6E99] text-sm tabular-nums">
                {formatPHP(remainingBalance)}
              </span>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PAID_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMethod(m);
                    if (m !== 'Cash') {
                      setAmountTendered(paymentAmount);
                    }
                  }}
                  className={`py-2.5 px-3 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                    method === m
                      ? 'bg-[#0B6E99] text-white border-[#0B6E99]'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="pay-amount"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Payment Applied (₱)
              </label>
              <input
                id="pay-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={remainingBalance > 0 ? remainingBalance : order.totalPrice}
                value={paymentAmount}
                onChange={(e) => {
                  setPaymentAmount(e.target.value);
                  if (method !== 'Cash') {
                    setAmountTendered(e.target.value);
                  }
                }}
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                required
              />
            </div>

            <div>
              <label
                htmlFor="pay-tendered"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Amount Tendered (₱)
              </label>
              <input
                id="pay-tendered"
                type="number"
                step="0.01"
                min="0.01"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
                required
              />
            </div>
          </div>

          {/* Computed Change */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-xs font-medium text-slate-600">Change to Return</span>
            <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
              {formatPHP(changeGiven)}
            </span>
          </div>

          <div>
            <label
              htmlFor="pay-notes"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Reference / Receipt Notes (Optional)
            </label>
            <input
              id="pay-notes"
              type="text"
              maxLength={200}
              placeholder={method === 'GCash' ? 'e.g. GCash Ref # 809124' : 'Counter cash receipt'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
            />
          </div>

          {order.status !== 'Claimed' && (
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={alsoMarkClaimed}
                onChange={(e) => setAlsoMarkClaimed(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-[#0B6E99] focus:ring-[#0B6E99]"
              />
              <span className="text-xs text-slate-700 leading-relaxed">
                <strong className="font-semibold text-slate-900">
                  Also release laundry & mark as Claimed
                </strong>
                {' '}— records the exact claim timestamp and completes the order.
              </span>
            </label>
          )}

          {error && (
            <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
            >
              {alsoMarkClaimed ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <CreditCard className="w-4 h-4" />
              )}
              {submitting
                ? 'Saving...'
                : alsoMarkClaimed
                ? 'Confirm Payment & Release'
                : 'Save Payment Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
