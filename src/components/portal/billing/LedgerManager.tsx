import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getInvoicesForClient, getLedgerForClient, createInvoice, recordLedgerTransaction } from '../../../lib/firebase/billing';
import { getClientsDirectory } from '../../../lib/firebase/clients';
import { getAppointments } from '../../../lib/firebase/scheduling';
import type { InvoiceData, LedgerEntryData, LedgerEntryType } from '../../../types/billing';
import type { ClientProfileData } from '../../../types/client';
import type { AppointmentData } from '../../../types/scheduling';
import { PortalClientSelector } from '../common/PortalClientSelector';

export const LedgerManager: React.FC<{ targetClientId?: string }> = ({ targetClientId }) => {
  const { user, role } = useAuth();
  const isStaff = role === 'therapist' || role === 'admin';

  const [clientList, setClientList] = useState<ClientProfileData[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(targetClientId || '');

  const activeClientId = targetClientId || (isStaff ? selectedClientId : user?.uid);

  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntryData[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);

  // New Invoice Form State
  const [showNewInv, setShowNewInv] = useState(false);
  const defaultDueDate = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  const defaultServiceDate = new Date().toISOString().split('T')[0];

  const createDefaultLineItem = () => ({
    id: Math.random().toString(36).substring(2, 9),
    serviceDate: defaultServiceDate,
    hours: '1.0',
    title: 'Individual Psychotherapy Session',
    description: '',
    dueDate: defaultDueDate,
    amount: '150.00'
  });

  const [lineItems, setLineItems] = useState([createDefaultLineItem()]);
  const [invDueDate, setInvDueDate] = useState(defaultDueDate);
  const [submittingInv, setSubmittingInv] = useState(false);
  const [invMessage, setInvMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const addLineItem = () => {
    setLineItems((prev) => [...prev, createDefaultLineItem()]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    setLineItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const calculateTotalCents = () => {
    return lineItems.reduce((sum, item) => {
      const amt = parseFloat(item.amount) || 0;
      return sum + Math.round(amt * 100);
    }, 0);
  };

  // Payment Form State
  const [selectedInvForPay, setSelectedInvForPay] = useState<InvoiceData | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'credit_card_token' | 'check' | 'cash' | 'hsa_fsa'>('credit_card_token');
  const [payRef, setPayRef] = useState('');

  // Single Invoice PDF Modal View
  const [viewSingleInvoice, setViewSingleInvoice] = useState<InvoiceData | null>(null);

  const getClientName = (cid: string) => {
    const found = clientList.find((c) => c.uid === cid);
    return found ? `${found.legalFirstName} ${found.legalLastName}` : 'Assigned Client';
  };

  const getClientEmail = (cid: string) => {
    const found = clientList.find((c) => c.uid === cid);
    return found?.email || '';
  };

  useEffect(() => {
    getClientsDirectory().then((list) => {
      setClientList(list);
      if (isStaff && !selectedClientId && list.length > 0) {
        setSelectedClientId(targetClientId || list[0].uid);
      }
    }).catch(err => console.error("Failed to fetch clients for billing", err));
  }, [isStaff, targetClientId]);

  useEffect(() => {
    if (!activeClientId && !user?.uid) {
      setLoading(false);
      return;
    }
    const targetId = activeClientId || user?.uid;
    if (!targetId) return;

    async function loadBilling() {
      setLoading(true);
      try {
        let [invs, ledger, appts] = await Promise.all([
          getInvoicesForClient(targetId),
          getLedgerForClient(targetId),
          getAppointments({ clientId: targetId })
        ]);

        // Fallback for clients: if 0 invoices found by uid, match by email in clientList
        if (invs.length === 0 && !isStaff && user?.email && clientList.length > 0) {
          const matched = clientList.find((c) => c.email?.toLowerCase() === user.email?.toLowerCase());
          if (matched && matched.uid !== targetId) {
            const [altInvs, altLedger, altAppts] = await Promise.all([
              getInvoicesForClient(matched.uid),
              getLedgerForClient(matched.uid),
              getAppointments({ clientId: matched.uid })
            ]);
            if (altInvs.length > 0 || altAppts.length > 0) {
              invs = altInvs;
              ledger = altLedger;
              appts = altAppts;
            }
          }
        }

        setInvoices(invs);
        setLedgerEntries(ledger);
        setUpcomingAppointments(appts.filter((a) => a.status === 'confirmed' || a.status === 'requested' || a.status === 'rescheduled'));
      } catch (err) {
        console.error("Failed to load billing ledger", err);
      } finally {
        setLoading(false);
      }
    }
    loadBilling();
  }, [activeClientId, user?.uid, user?.email, clientList, isStaff]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = targetClientId || selectedClientId || activeClientId;
    if (!targetId) {
      setInvMessage({ type: 'error', text: 'Please select a client.' });
      return;
    }

    const validItems = lineItems.filter((i) => i.title.trim() && parseFloat(i.amount) >= 0);
    if (validItems.length === 0) {
      setInvMessage({ type: 'error', text: 'Please provide at least one valid line item with a title and amount.' });
      return;
    }

    const formattedItems = validItems.map((item) => ({
      id: item.id,
      serviceDate: item.serviceDate,
      hours: parseFloat(item.hours) || 1,
      title: item.title,
      description: item.description,
      dueDate: item.dueDate || invDueDate,
      amountCents: Math.round((parseFloat(item.amount) || 0) * 100)
    }));

    const totalCents = formattedItems.reduce((sum, item) => sum + item.amountCents, 0);
    const invoiceNum = `INV-${Date.now().toString().slice(-6)}`;
    const primaryDesc = formattedItems.length === 1
      ? (formattedItems[0].description ? `${formattedItems[0].title} - ${formattedItems[0].description}` : formattedItems[0].title)
      : `${formattedItems.length} Itemized Clinical Services (${formattedItems.map(i => i.title).join(', ')})`;

    setSubmittingInv(true);
    setInvMessage(null);

    try {
      const invId = await createInvoice({
        clientId: targetId,
        invoiceNumber: invoiceNum,
        description: primaryDesc,
        items: formattedItems,
        totalCents,
        balanceCents: totalCents,
        status: 'unpaid',
        dueDate: invDueDate || defaultDueDate
      });

      // Also record initial charge entry in ledger
      await recordLedgerTransaction({
        clientId: targetId,
        invoiceId: invId,
        type: 'charge',
        amountCents: totalCents,
        notes: `Initial charge for invoice ${invoiceNum} (${formattedItems.length} line items)`,
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
      setLineItems([createDefaultLineItem()]);
      setInvMessage({ type: 'success', text: `Invoice ${invoiceNum} created and assigned successfully to ${getClientName(targetId)}!` });
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

  const totalOutstandingBalance = invoices.reduce((sum, inv) => sum + Math.max(0, inv.balanceCents), 0);
  const totalPendingCharges = upcomingAppointments.reduce((sum, appt) => sum + (appt.priceInCents || 15000), 0);
  const totalProjectedBalance = totalOutstandingBalance + totalPendingCharges;

  if (loading) {
    return <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl">Loading account ledger & invoices...</div>;
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Header & Balance Summary Cards */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#EAE1D2] pb-6">
          <div>
            <h2 className="text-3xl font-serif text-[#2C2A2A] font-medium">Billing Ledger & Financial Account</h2>
            <p className="text-xs text-[#2C2A2A]/70 mt-1">
              Track upcoming session charges, official invoiced balances, payment receipts, and transaction audit trails.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#F7F2E9] border border-[#EAE1D2] p-4 rounded-xl text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#4A5741]">Invoiced Balance Due</p>
            <p className="text-2xl font-serif font-bold text-[#BF5B33]">
              ${(totalOutstandingBalance / 100).toFixed(2)}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">Currently issued unpaid invoices</p>
          </div>

          <div className="bg-[#F7F2E9] border border-[#EAE1D2] p-4 rounded-xl text-left">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Pending Session Charges</p>
            <p className="text-2xl font-serif font-bold text-amber-700">
              ${(totalPendingCharges / 100).toFixed(2)}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">{upcomingAppointments.length} upcoming scheduled session{upcomingAppointments.length === 1 ? '' : 's'}</p>
          </div>

          <div className="bg-[#4A5741] p-4 rounded-xl text-left text-white shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Total Projected Balance</p>
            <p className="text-2xl font-serif font-bold text-white">
              ${(totalProjectedBalance / 100).toFixed(2)}
            </p>
            <p className="text-[10px] text-emerald-100 mt-0.5">Invoiced + pending upcoming charges</p>
          </div>
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
          <span className="text-xs font-semibold uppercase text-[#2C2A2A]">
            Active Client Financial Ledger:
          </span>
          <PortalClientSelector
            clients={clientList}
            selectedClientId={selectedClientId}
            onSelectClient={(id) => setSelectedClientId(id)}
          />
        </div>
      )}

      {isStaff && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowNewInv(true)}
            className="w-full sm:w-auto px-4 py-3 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl transition shadow-sm min-h-[44px] flex items-center justify-center gap-1.5"
          >
            + Create New Invoice
          </button>
        </div>
      )}

      {/* New Invoice Overlay Modal */}
      {isStaff && showNewInv && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-fade-in overflow-y-auto">
          <div className="bg-[#F7F2E9] border border-[#EAE1D2] rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto my-auto">
            <div className="flex items-center justify-between border-b border-[#EAE1D2] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">💳</span>
                <div>
                  <h3 className="text-lg font-serif text-[#2C2A2A] font-semibold">
                    Create Client Invoice
                  </h3>
                  <p className="text-xs text-gray-500">Generate an official itemized invoice for professional services</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowNewInv(false)} className="text-gray-400 hover:text-gray-600 font-bold text-sm">✕</button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-5 bg-white p-6 rounded-xl border border-[#EAE1D2]">
              {!targetClientId && (
                <PortalClientSelector
                  clients={clientList}
                  selectedClientId={selectedClientId}
                  onSelectClient={(id) => setSelectedClientId(id)}
                  label="Assign Invoice To Client *"
                  className="w-full"
                />
              )}

              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-[#F7F2E9]/60 p-4 rounded-xl border border-[#EAE1D2]">
                <div className="w-full sm:w-auto flex-1">
                  <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Invoice Payment Due Date *</label>
                  <input
                    type="date"
                    required
                    value={invDueDate}
                    onChange={(e) => setInvDueDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none bg-white focus:ring-2 focus:ring-[#BF5B33]/20"
                  />
                </div>
                <div className="w-full sm:w-auto text-right bg-white px-4 py-2 rounded-xl border border-[#EAE1D2]">
                  <span className="block text-[10px] font-bold uppercase text-gray-500">Total Invoice Amount</span>
                  <span className="text-xl font-mono font-bold text-[#BF5B33]">
                    ${(calculateTotalCents() / 100).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Line Items Builder Section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-[#EAE1D2] pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#4A5741]">
                    Invoice Line Items & Clinical Services ({lineItems.length})
                  </h4>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="px-3 py-1.5 bg-[#4A5741] hover:bg-[#3b4634] text-white text-xs font-semibold rounded-lg transition flex items-center gap-1"
                  >
                    + Add Line Item
                  </button>
                </div>

                <div className="space-y-4">
                  {lineItems.map((item, index) => (
                    <div key={item.id} className="p-4 bg-[#F7F2E9]/40 border border-[#EAE1D2] rounded-xl space-y-3 relative group">
                      <div className="flex items-center justify-between pb-1 border-b border-[#EAE1D2]/60">
                        <span className="text-xs font-bold text-[#BF5B33]">Line Item #{index + 1}</span>
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLineItem(index)}
                            className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-0.5 rounded hover:bg-red-50 transition"
                          >
                            Remove Item
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-1">Service Date *</label>
                          <input
                            type="date"
                            required
                            value={item.serviceDate}
                            onChange={(e) => updateLineItem(index, 'serviceDate', e.target.value)}
                            className="w-full p-2 rounded-lg border border-[#EAE1D2] text-xs outline-none bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-1">Hours / Units *</label>
                          <input
                            type="number"
                            step="0.25"
                            min="0.1"
                            required
                            value={item.hours}
                            onChange={(e) => updateLineItem(index, 'hours', e.target.value)}
                            className="w-full p-2 rounded-lg border border-[#EAE1D2] text-xs outline-none bg-white"
                            placeholder="1.0"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-1">Amount Due ($ USD) *</label>
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={item.amount}
                            onChange={(e) => updateLineItem(index, 'amount', e.target.value)}
                            className="w-full p-2 rounded-lg border border-[#EAE1D2] text-xs outline-none bg-white font-mono font-semibold"
                            placeholder="150.00"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-1">Item Due Date</label>
                          <input
                            type="date"
                            value={item.dueDate}
                            onChange={(e) => updateLineItem(index, 'dueDate', e.target.value)}
                            className="w-full p-2 rounded-lg border border-[#EAE1D2] text-xs outline-none bg-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-1">Clinical Service Title *</label>
                          <input
                            type="text"
                            required
                            value={item.title}
                            onChange={(e) => updateLineItem(index, 'title', e.target.value)}
                            className="w-full p-2 rounded-lg border border-[#EAE1D2] text-xs outline-none bg-white"
                            placeholder="e.g. 50-Min Individual Psychotherapy Session (CPT 90837)"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                            Description / Clinical Service Notes <span className="text-gray-400 font-normal">(Expandable for detailed notes)</span>
                          </label>
                          <textarea
                            rows={3}
                            value={item.description}
                            onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                            className="w-full p-2.5 rounded-lg border border-[#EAE1D2] text-xs outline-none bg-white focus:ring-2 focus:ring-[#BF5B33]/20 resize-y"
                            placeholder="Detailed session breakdown, treatment notes, CPT codes, diagnosis details, or custom notes..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#EAE1D2]">
                <button
                  type="button"
                  onClick={addLineItem}
                  className="px-3 py-2 border border-[#4A5741] text-[#4A5741] hover:bg-[#4A5741]/10 text-xs font-semibold rounded-xl transition"
                >
                  + Add Itemized Service
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNewInv(false)}
                    className="px-4 py-2 bg-[#EAE1D2] hover:bg-[#e0d4c1] text-[#2C2A2A] font-semibold text-xs rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingInv}
                    className="px-5 py-2 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl disabled:opacity-50 transition shadow-sm"
                  >
                    {submittingInv ? 'Issuing Invoice...' : 'Generate & Issue Invoice'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
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

      {/* Upcoming Scheduled Sessions & Pending Charges */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EAE1D2] pb-3 gap-2">
          <div>
            <h3 className="text-xl font-serif font-medium text-[#2C2A2A]">
              Upcoming Scheduled Sessions & Pending Charges
            </h3>
            <p className="text-xs text-[#2C2A2A]/70 mt-0.5">
              Unbilled estimated fees for reserved future appointments. Charges automatically convert into official invoices upon session completion.
            </p>
          </div>
          <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold rounded-full w-fit">
            Pending: ${(totalPendingCharges / 100).toFixed(2)}
          </span>
        </div>

        {upcomingAppointments.length === 0 ? (
          <p className="text-xs text-[#2C2A2A]/60 py-4 text-center">No upcoming scheduled appointments with pending charges.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F2E9] uppercase tracking-wider font-semibold border-b border-[#EAE1D2]">
                <tr>
                  <th className="py-3 px-4">Scheduled Session Date</th>
                  {isStaff && <th className="py-3 px-4">Client</th>}
                  <th className="py-3 px-4">Service Type</th>
                  <th className="py-3 px-4">Format</th>
                  <th className="py-3 px-4 text-right">Estimated Fee</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE1D2]">
                {upcomingAppointments.map((appt) => (
                  <tr key={appt.id} className="hover:bg-[#F7F2E9]/40 transition">
                    <td className="py-3.5 px-4 font-semibold text-[#2C2A2A]">
                      {new Date(appt.startISO).toLocaleString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    {isStaff && (
                      <td className="py-3.5 px-4 font-medium text-[#2C2A2A]">
                        {appt.clientName || getClientName(appt.clientId)}
                      </td>
                    )}
                    <td className="py-3.5 px-4 font-medium">{appt.appointmentTypeName}</td>
                    <td className="py-3.5 px-4 capitalize">{appt.format}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-amber-700">
                      ${((appt.priceInCents || 15000) / 100).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        appt.status === 'confirmed' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {appt.status} (Unbilled)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoices List */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-xl font-serif font-medium text-[#2C2A2A] border-b border-[#EAE1D2] pb-3">Issued Invoices</h3>
        {invoices.length === 0 ? (
          <p className="text-xs text-[#2C2A2A]/60 py-4 text-center">No invoices found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F2E9] uppercase tracking-wider font-semibold border-b border-[#EAE1D2]">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  {isStaff && <th className="py-3 px-4">Assigned Client</th>}
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE1D2]">
                {invoices.map((inv) => {
                  const effectiveBalance = Math.min(inv.totalCents, inv.balanceCents);
                  return (
                    <tr key={inv.id} className="hover:bg-[#F7F2E9]/40 transition">
                      <td className="py-3.5 px-4 font-mono font-semibold text-[#BF5B33] cursor-pointer hover:underline" onClick={() => setViewSingleInvoice(inv)}>
                        {inv.invoiceNumber}
                      </td>
                      {isStaff && (
                        <td className="py-3.5 px-4 font-medium text-[#2C2A2A]">
                          {getClientName(inv.clientId)}
                        </td>
                      )}
                      <td className="py-3.5 px-4">{inv.description}</td>
                      <td className="py-3.5 px-4">{inv.dueDate}</td>
                      <td className="py-3.5 px-4 font-semibold">${(inv.totalCents / 100).toFixed(2)}</td>
                      <td className="py-3.5 px-4 font-bold text-[#BF5B33]">${(effectiveBalance / 100).toFixed(2)}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          inv.status === 'paid' || effectiveBalance <= 0 ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {effectiveBalance <= 0 ? 'paid' : inv.status.replace('_', ' ')}
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
                          onClick={() => setViewSingleInvoice(inv)}
                          className="ml-2 px-2.5 py-1 border border-[#EAE1D2] text-[#2C2A2A] font-semibold rounded-lg text-xs hover:bg-[#F7F2E9]"
                        >
                          🖨️ PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Single Invoice PDF Modal View */}
      {viewSingleInvoice && (() => {
        const effectiveBalance = Math.min(viewSingleInvoice.totalCents, viewSingleInvoice.balanceCents);
        const effectivePaid = Math.max(0, viewSingleInvoice.totalCents - effectiveBalance);
        const itemsList = viewSingleInvoice.items && viewSingleInvoice.items.length > 0
          ? viewSingleInvoice.items
          : [{
              id: '1',
              title: viewSingleInvoice.description,
              serviceDate: viewSingleInvoice.createdAt ? new Date(viewSingleInvoice.createdAt.seconds ? viewSingleInvoice.createdAt.seconds * 1000 : Date.now()).toISOString().split('T')[0] : '',
              hours: 1,
              dueDate: viewSingleInvoice.dueDate,
              amountCents: viewSingleInvoice.totalCents
            }];

        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto font-sans">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-8 shadow-2xl space-y-6 relative border border-[#EAE1D2] my-auto">
              {/* Modal Actions */}
              <div className="flex justify-between items-center border-b border-[#EAE1D2] pb-4 no-print">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#BF5B33]">Official Clinical Statement & Invoice</span>
                  <p className="text-[11px] text-gray-500">Ready for print, email, or official financial record keeping</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-[#BF5B33] text-white text-xs font-semibold rounded-xl hover:bg-[#a64e2b] transition flex items-center gap-1.5 shadow-sm"
                  >
                    🖨️ Print / Save as PDF
                  </button>
                  <button
                    onClick={() => setViewSingleInvoice(null)}
                    className="px-4 py-2 border border-[#EAE1D2] text-xs font-semibold rounded-xl hover:bg-gray-50 text-gray-700"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Printable Document Sheet Container */}
              <div className="space-y-6 text-[#2C2A2A] bg-white p-2">
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-[#BF5B33] pb-5">
                  <div>
                    <h1 className="text-2xl font-serif font-bold text-[#2C2A2A]">Family Trust Therapy</h1>
                    <p className="text-xs font-semibold text-[#4A5741] mt-0.5">Attachment Matters, LLC</p>
                    <p className="text-xs text-gray-600 mt-1">Durango, CO 81301 • Tel: (505) 920-6351</p>
                    <p className="text-xs text-gray-600">Email: info@familytrusttherapy.com</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold uppercase tracking-widest text-[#4A5741]">Official Client Invoice</span>
                    <h2 className="text-2xl font-mono font-bold text-[#BF5B33] mt-1">{viewSingleInvoice.invoiceNumber}</h2>
                    <div className="text-xs text-gray-600 mt-2 space-y-0.5">
                      <p><span className="font-semibold">Invoice Due Date:</span> {viewSingleInvoice.dueDate}</p>
                    </div>
                  </div>
                </div>

                {/* Client & Billing Info */}
                <div className="bg-[#F7F2E9] p-5 rounded-xl border border-[#EAE1D2] flex flex-col sm:flex-row justify-between text-xs gap-4">
                  <div>
                    <span className="font-bold uppercase tracking-wider text-[#4A5741] block mb-1.5">Billed To (Client):</span>
                    <p className="font-bold text-base text-[#2C2A2A]">{getClientName(viewSingleInvoice.clientId)}</p>
                    {getClientEmail(viewSingleInvoice.clientId) && (
                      <p className="text-gray-600 font-medium mt-0.5">{getClientEmail(viewSingleInvoice.clientId)}</p>
                    )}
                  </div>
                  <div className="sm:text-right border-t sm:border-t-0 border-[#EAE1D2] pt-3 sm:pt-0">
                    <span className="font-bold uppercase tracking-wider text-[#4A5741] block mb-1.5">Invoice Payment Status:</span>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      effectiveBalance <= 0 || viewSingleInvoice.status === 'paid'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {effectiveBalance <= 0 ? 'paid in full' : viewSingleInvoice.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Itemized Line Items Table */}
                <div className="border border-[#EAE1D2] rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-[#F7F2E9] border-b border-[#EAE1D2] uppercase font-bold text-[#4A5741] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Service Description & Clinical Notes</th>
                        <th className="py-3 px-4 text-center">Hours</th>
                        <th className="py-3 px-4 text-center">Due Date</th>
                        <th className="py-3 px-4 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EAE1D2]">
                      {itemsList.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[#F7F2E9]/20">
                          <td className="py-3.5 px-4 font-mono font-medium text-gray-700 whitespace-nowrap align-top">
                            {item.serviceDate || '—'}
                          </td>
                          <td className="py-3.5 px-4 align-top">
                            <div className="font-bold text-[#2C2A2A] text-xs">{item.title}</div>
                            {item.description && (
                              <div className="text-gray-600 mt-1 whitespace-pre-wrap text-[11px] leading-relaxed">
                                {item.description}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono align-top">
                            {item.hours ?? 1}
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono text-gray-600 align-top whitespace-nowrap">
                            {item.dueDate || viewSingleInvoice.dueDate}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-[#2C2A2A] align-top whitespace-nowrap">
                            ${(item.amountCents / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary Totals */}
                <div className="flex justify-end pt-2 text-xs">
                  <div className="w-72 space-y-2 bg-[#F7F2E9] p-4 rounded-xl border border-[#EAE1D2]">
                    <div className="flex justify-between text-gray-700">
                      <span className="font-medium">Total Itemized Amount:</span>
                      <span className="font-mono font-bold text-gray-900">${(viewSingleInvoice.totalCents / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-700">
                      <span className="font-medium">Payments / Credits Received:</span>
                      <span className="font-mono font-bold text-emerald-700">-${(effectivePaid / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t-2 border-[#EAE1D2] pt-2.5 font-bold text-sm text-[#BF5B33]">
                      <span>Total Balance Due:</span>
                      <span className="font-mono text-base">${(effectiveBalance / 100).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[11px] text-gray-500 border-t border-[#EAE1D2] pt-4 space-y-1">
                  <p className="font-medium text-[#4A5741]">Thank you for trusting Family Trust Therapy with your care.</p>
                  <p className="text-[10px]">Official Financial & Clinical Statement • Attachment Matters, LLC • Confidential</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
