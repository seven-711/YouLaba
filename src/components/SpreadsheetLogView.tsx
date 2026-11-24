import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Search,
  Upload,
} from 'lucide-react';
import {
  compareSpreadsheetCsvToOrders,
  formatDateTime,
  formatPHP,
  ordersToCsv,
  type LaundryOrder,
  type SpreadsheetMismatch,
} from '../types/youlaba';

interface SpreadsheetLogViewProps {
  orders: LaundryOrder[];
  onSelectSlip: (order: LaundryOrder) => void;
}

export function SpreadsheetLogView({
  orders,
  onSelectSlip,
}: SpreadsheetLogViewProps) {
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showComparator, setShowComparator] = useState(false);
  const [csvInput, setCsvInput] = useState('');
  const [comparison, setComparison] = useState<{
    checkedRows: number;
    matchedRows: number;
    mismatches: SpreadsheetMismatch[];
  } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (dateFilter && !o.dropOffAt.startsWith(dateFilter)) return false;
      if (!q) return true;
      return (
        o.claimSlipNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.serviceName.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q)
      );
    });
  }, [orders, search, dateFilter]);

  const handleExportCsv = () => {
    const csv = ordersToCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `YouLaba_Order_Log_${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      setCsvInput(text);
      setComparison(compareSpreadsheetCsvToOrders(text, orders));
    };
    reader.readAsText(file);
  };

  const handleCompareText = () => {
    setComparison(compareSpreadsheetCsvToOrders(csvInput, orders));
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter slip #, customer, service..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
            />
          </div>
          <input
            aria-label="Filter by drop-off date"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Clear date
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowComparator((v) => !v)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            {showComparator ? 'Hide Mismatch Checker' : 'Compare Spreadsheet Log'}
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0B6E99] hover:bg-[#085A7E] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel / Google Sheets CSV ({filtered.length})
          </button>
        </div>
      </div>

      {/* Parallel Deployment / Spreadsheet Mismatch Checker */}
      {showComparator && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Spreadsheet Log Reconciliation (Parallel Deployment Checker)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Upload or paste an exported Google Sheets / Excel CSV log to detect discrepancies against live Firestore order records.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer whitespace-nowrap">
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#0B6E99]" />
              Upload CSV File
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFileUpload}
                className="sr-only"
              />
            </label>
          </div>

          <textarea
            rows={4}
            placeholder="Paste CSV rows here (must include Claim Slip Number header)..."
            value={csvInput}
            onChange={(e) => setCsvInput(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/25 focus:border-[#0B6E99]"
          />

          <div className="flex items-center justify-between gap-4">
            <p className="text-[11px] text-slate-500">
              Checks Claim Slip Number existence, Order Status, Payment Status, and Total Price (PHP).
            </p>
            <button
              type="button"
              onClick={handleCompareText}
              disabled={!csvInput.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              Run Mismatch Audit
            </button>
          </div>

          {comparison && (
            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center gap-6 text-xs">
                <span>
                  Rows Checked:{' '}
                  <strong className="font-mono tabular-nums text-slate-900">
                    {comparison.checkedRows}
                  </strong>
                </span>
                <span>
                  Exact Matches:{' '}
                  <strong className="font-mono tabular-nums text-emerald-700">
                    {comparison.matchedRows}
                  </strong>
                </span>
                <span>
                  Mismatches Found:{' '}
                  <strong
                    className={`font-mono tabular-nums ${
                      comparison.mismatches.length > 0 ? 'text-red-700' : 'text-emerald-700'
                    }`}
                  >
                    {comparison.mismatches.length}
                  </strong>
                </span>
              </div>

              {comparison.mismatches.length === 0 ? (
                <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  All {comparison.checkedRows} spreadsheet rows match the live YouLaba database with zero discrepancies.
                </p>
              ) : (
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-red-50 text-red-900 border-b border-red-200">
                      <tr>
                        <th className="py-2.5 px-3 font-semibold">Claim Slip #</th>
                        <th className="py-2.5 px-3 font-semibold">Discrepancy</th>
                        <th className="py-2.5 px-3 font-semibold">Spreadsheet Value</th>
                        <th className="py-2.5 px-3 font-semibold">Live System Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100 bg-white">
                      {comparison.mismatches.map((m, idx) => (
                        <tr key={`${m.claimSlipNumber}-${idx}`}>
                          <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                            {m.claimSlipNumber}
                          </td>
                          <td className="py-2 px-3 text-red-700 font-medium flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            {m.type}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-700">{m.sheetValue}</td>
                          <td className="py-2 px-3 font-mono font-semibold text-slate-900">
                            {m.systemValue}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Spreadsheet Grid Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              YouLaba Order Log (Drop-Off & Claim Timestamps)
            </h3>
            <p className="text-xs text-slate-500">
              Ready for Google Sheets or Microsoft Excel import · Showing {filtered.length} records
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Claim Slip #</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Customer</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Service</th>
                <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Qty / Bags</th>
                <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Total (₱)</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Payment</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Drop-Off Time</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Est. Claim Time</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Actual Claimed</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    No order records match the current filter.
                  </td>
                </tr>
              ) : (
                filtered.map((o) => (
                  <tr
                    key={o.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono font-semibold text-[#0B6E99] whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectSlip(o)}
                        className="hover:underline"
                      >
                        {o.claimSlipNumber}
                      </button>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className="font-medium text-slate-900">{o.customerName}</span>
                      <span className="text-slate-400 font-mono block text-[11px]">
                        {o.customerPhone}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                      {o.serviceName}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                      {o.quantity} {o.pricingUnit} · {o.bagCount}b
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold tabular-nums text-slate-900 whitespace-nowrap">
                      {formatPHP(o.totalPrice)}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`font-semibold ${
                          o.paymentStatus === 'Paid'
                            ? 'text-emerald-700'
                            : o.paymentStatus === 'Partial'
                            ? 'text-amber-700'
                            : 'text-red-700'
                        }`}
                      >
                        {o.paymentStatus}
                      </span>
                      {o.paymentMethod !== 'None' && (
                        <span className="text-slate-400"> · {o.paymentMethod}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {formatDateTime(o.dropOffAt)}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {formatDateTime(o.estimatedClaimAt)}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {o.claimedAt ? formatDateTime(o.claimedAt) : '—'}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                      {o.status}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
