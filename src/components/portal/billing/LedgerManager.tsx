import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getInvoicesForClient, getLedgerForClient, createInvoice, recordLedgerTransaction } from '../../../lib/firebase/billing';
import { getClientsDirectory } from '../../../lib/firebase/clients';
import type { InvoiceData, LedgerEntryData, LedgerEntryType } from '../../../types/billing';
import type { ClientProfileData } from '../../../types/client';

export const LedgerManager: React.FC<{ targetClientId?: string }> = ({ targetClientId }) => {
  const { user, role } = useAuth();
  const isStaff = role === 'therapist' || role === 'admin';

  const [clientList, setClientList] = useState<ClientProfileData[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(targetClientId || '');

  const activeClientId = targetClientId || (isStaff ? selectedClientId : user?.uid);

  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntryData[]>([]);
  const [loading, setLoading] = useState(true);

  // New Invoice Form State
  const [showNewInv, setShowNewInv] = useState(false);
  const [invDesc, setInvDesc] = useState('');
  const [invAmount, setInvAmount] = useState('');
  const [invDueDate, setInvDueDate] = useState(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
  const [submittingInv, setSubmittingInv] = useState(false);
  const [invMessage, setInvMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Payment Form State
  const [selectedInvForPay, setSelectedInvForPay] = useState<InvoiceData | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'credit_card_token' | 'check' | 'cash' | 'hsa_fsa'>('credit_card_token');
  const [payRef, setPayRef] = useState('');

  useEffect(() => {
    if (isStaff) {
      getClientsDirectory().then((list) => {
        setClientList(list);
        if (!selectedClientId && list.length > 0) {
          setSelectedClientId(targetClientId || list[0].uid);
        }
      }).catch(err => console.error("Failed to fetch clients for billing", err));
    }
  }, [isStaff, targetClientId]);

  useEffect(() => {
    if (!activeClientId) {
      setLoading(false);
      return;
    }
    async function loadBilling() {
      setLoading(true);
      try {
        const [invs, ledger] = await Promise.all([
          getInvoicesForClient(activeClientId!),
          getLedgerForClient(activeClientId!)
        ]);
        setInvoices(invs);
        setLedgerEntries(ledger);
      } catch (err) {
        console.error("Failed to load billing ledger", err);
      } finally {
        setLoading(false);
      }
    }
    loadBilling();
  }, [activeClientId]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = targetClientId || selectedClientId || activeClientId;
    if (!targetId || !invAmount) {
      setInvMessage({ type: 'error', text: 'Please select a client and enter a valid dollar amount.' });
      return;
    }
    const amountCents = Math.round(parseFloat(invAmount) * 100);
    const invoiceNum = `INV-${Date.now().toString().slice(-6)}`;
    setSubmittingInv(true);
    setInvMessage(null);

    try {
      const invId = await createInvoice({
        clientId: targetId,
        invoiceNumber: invoiceNum,
        description: invDesc || 'Therapy Services Session',
        totalCents: amountCents,
        balanceCents: amountCents,
        status: 'unpaid',
        dueDate: invDueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
      });

      // Also record initial charge entry in ledger
      await recordLedgerTransaction({
        clientId: targetId,
        invoiceId: invId,
        type: 'charge',
        amountCents,
        notes: `Initial charge for invoice ${invoiceNum}`,
        createdById: user!.uid
      });

      // Refresh
      const [invs, ledger] = await Promise.all([
        getInvoicesForClient(targetId),
        getLedgerForClient(targetId)
      ]);
      setInvoices(invs);
      setLedgerEntries(ledger);
      setShowNewInv(false);
      setInvDesc('');
      setInvAmount('');
      setInvMessage({ type: 'success', text: `Invoice ${invoiceNum} created and assigned successfully!` });
    } catch (err: any) {
      console.error("Failed to create invoice", err);
      setInvMessage({ type: 'error', text: err.message || "Failed to create invoice. Please check network/permissions." });
    } finally {
      setSubmittingInv(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClientId || !selectedInvForPay || !payAmount || !user) return;
    const amountCents = Math.round(parseFloat(payAmount) * 100);

    try {
      await recordLedgerTransaction({
        clientId: activeClientId,
        invoiceId: selectedInvForPay.id,
        type: 'payment',
        amountCents,
        paymentMethod: payMethod,
        transactionRef: payRef || `REF-${Date.now().toString().slice(-6)}`,
        notes: `Payment received for ${selectedInvForPay.invoiceNumber}`,
        createdById: user.uid
      });

      // Refresh
      const [invs, ledger] = await Promise.all([
        getInvoicesForClient(activeClientId),
        getLedgerForClient(activeClientId)
      ]);
      setInvoices(invs);
      setLedgerEntries(ledger);
      setSelectedInvForPay(null);
      setPayAmount('');
    } catch (err) {
      console.error("Failed to record payment", err);
    }
  };

  const totalOutstandingBalance = invoices.reduce((sum, inv) => sum + inv.balanceCents, 0);

  if (loading) {
    return <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl">Loading account ledger & invoices...</div>;
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Header & Balance Card */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-serif text-[#2C2A2A] font-medium">Billing Ledger & Invoices</h2>
          <p className="text-xs text-[#2C2A2A]/70 mt-1">
            Financial statements, payment history, and append-only ledger transaction audit.
          </p>
        </div>

        <div className="bg-[#F7F2E9] border border-[#EAE1D2] p-4 rounded-xl text-right">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#4A5741]">Outstanding Balance</p>
          <p className="text-2xl font-serif font-bold text-[#BF5B33]">
            ${(totalOutstandingBalance / 100).toFixed(2)}
          </p>
        </div>
      </div>

      {invMessage && (
        <div className={`p-4 rounded-xl text-xs font-semibold border ${
          invMessage.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {invMessage.text}
        </div>
      )}

      {isStaff && !targetClientId && (
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <label htmlFor="staff-client-select" className="text-xs font-semibold uppercase text-[#2C2A2A]">
            Select Client to View/Issue Invoices:
          </label>
          <select
            id="staff-client-select"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="p-2.5 rounded-xl border border-[#EAE1D2] text-xs font-medium bg-white text-[#2C2A2A] max-w-sm w-full outline-none focus:ring-2 focus:ring-[#BF5B33]/20"
          >
            {clientList.length === 0 ? (
              <option value="">No clients found</option>
            ) : (
              clientList.map((c) => (
                <option key={c.uid} value={c.uid}>
                  {c.legalFirstName} {c.legalLastName} ({c.email || 'No Email'})
                </option>
              ))
            )}
          </select>
        </div>
      )}

      {isStaff && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowNewInv(true)}
            className="px-4 py-2 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl transition shadow-sm"
          >
            + Create New Invoice
          </button>
        </div>
      )}

      {/* New Invoice Form */}
      {isStaff && showNewInv && (
        <form onSubmit={handleCreateInvoice} className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-serif text-[#2C2A2A] font-medium border-b border-[#EAE1D2] pb-2">
            Create Client Invoice
          </h3>

          {!targetClientId && (
            <div>
              <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                Assign Invoice To Client
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs bg-white font-medium text-[#2C2A2A]"
              >
                {clientList.map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {c.legalFirstName} {c.legalLastName} ({c.email || 'No Email'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Description</label>
              <input
                type="text"
                required
                value={invDesc}
                onChange={(e) => setInvDesc(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                placeholder="50-Min Individual Therapy Session"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Amount ($ USD)</label>
              <input
                type="number"
                step="0.01"
                required
                value={invAmount}
                onChange={(e) => setInvAmount(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                placeholder="150.00"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Due Date</label>
              <input
                type="date"
                required
                value={invDueDate}
                onChange={(e) => setInvDueDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowNewInv(false)}
              className="px-4 py-2 bg-gray-100 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingInv}
              className="px-4 py-2 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl disabled:opacity-50 transition"
            >
              {submittingInv ? 'Issuing Invoice...' : 'Issue Invoice'}
            </button>
          </div>
        </form>
      )}

      {/* Record Payment Form */}
      {isStaff && selectedInvForPay && (
        <form onSubmit={handleRecordPayment} className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-serif text-[#2C2A2A] font-medium border-b border-[#EAE1D2] pb-2">
            Record Payment for {selectedInvForPay.invoiceNumber}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Payment Amount ($ USD)</label>
              <input
                type="number"
                step="0.01"
                required
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                placeholder={(selectedInvForPay.balanceCents / 100).toFixed(2)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Payment Method</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as any)}
                className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs bg-white"
              >
                <option value="credit_card_token">Credit Card / HSA (Tokenized)</option>
                <option value="check">Check</option>
                <option value="cash">Cash</option>
                <option value="hsa_fsa">HSA / FSA Card</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Reference #</label>
              <input
                type="text"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                placeholder="Transaction or Check #"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSelectedInvForPay(null)}
              className="px-4 py-2 bg-gray-100 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#4A5741] text-white text-xs font-semibold rounded-xl"
            >
              Record Payment Entry
            </button>
          </div>
        </form>
      )}

      {/* Invoices List */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xl font-serif font-medium text-[#2C2A2A] border-b border-[#EAE1D2] pb-3">Invoices</h3>
        {invoices.length === 0 ? (
          <p className="text-xs text-[#2C2A2A]/60 py-4 text-center">No invoices found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F2E9] uppercase tracking-wider font-semibold border-b border-[#EAE1D2]">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE1D2]">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#F7F2E9]/40 transition">
                    <td className="py-3.5 px-4 font-mono font-semibold">{inv.invoiceNumber}</td>
                    <td className="py-3.5 px-4">{inv.description}</td>
                    <td className="py-3.5 px-4">{inv.dueDate}</td>
                    <td className="py-3.5 px-4 font-semibold">${(inv.totalCents / 100).toFixed(2)}</td>
                    <td className="py-3.5 px-4 font-bold text-[#BF5B33]">${(inv.balanceCents / 100).toFixed(2)}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        inv.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {inv.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {isStaff && inv.status !== 'paid' && (
                        <button
                          onClick={() => setSelectedInvForPay(inv)}
                          className="px-3 py-1 bg-[#4A5741] text-white font-semibold rounded-lg text-xs"
                        >
                          Record Payment
                        </button>
                      )}
                      <button
                        onClick={() => window.print()}
                        className="ml-2 px-2.5 py-1 border border-[#EAE1D2] text-[#2C2A2A] font-semibold rounded-lg text-xs hover:bg-[#F7F2E9]"
                      >
                        🖨️ PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Append-Only Ledger History */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xl font-serif font-medium text-[#2C2A2A] border-b border-[#EAE1D2] pb-3">
          Append-Only Ledger Transaction Audit
        </h3>
        {ledgerEntries.length === 0 ? (
          <p className="text-xs text-[#2C2A2A]/60 py-4 text-center">No ledger transaction entries logged.</p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {ledgerEntries.map((e, idx) => (
              <div key={idx} className="p-3 bg-[#F7F2E9] rounded-xl border border-[#EAE1D2] flex justify-between text-xs text-[#2C2A2A]">
                <div>
                  <span className="font-semibold uppercase tracking-wider font-mono text-[#4A5741]">{e.type}</span>
                  <span className="ml-2 text-[#2C2A2A]/80">{e.notes}</span>
                </div>
                <div className="font-bold">
                  {['payment', 'credit'].includes(e.type) ? '-' : '+'}${(e.amountCents / 100).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
