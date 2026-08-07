import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  addDoc,
  runTransaction
} from 'firebase/firestore';
import { db } from './config';
import type { InvoiceData, LedgerEntryData, InvoiceStatus } from '../../types/billing';

/**
 * Fetch client invoices
 */
export async function getInvoicesForClient(clientId: string): Promise<InvoiceData[]> {
  const colRef = collection(db, 'invoices');
  const q = query(colRef, where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as InvoiceData));
}

/**
 * Fetch client ledger history
 */
export async function getLedgerForClient(clientId: string): Promise<LedgerEntryData[]> {
  const colRef = collection(db, 'ledgerEntries');
  const q = query(colRef, where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LedgerEntryData));
}

/**
 * Create a new invoice
 */
export async function createInvoice(invoice: Omit<InvoiceData, 'id'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'invoices'), {
    ...invoice,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
}

/**
 * APPEND-ONLY LEDGER TRANSACTION RECORDING
 * Automatically recalculates invoice balance and updates invoice status (Paid, Partially Paid, Unpaid).
 */
export async function recordLedgerTransaction(entry: Omit<LedgerEntryData, 'id'>): Promise<string> {
  const entryRef = doc(collection(db, 'ledgerEntries'));

  await runTransaction(db, async (transaction) => {
    // 1. ALL READS FIRST
    let currentInv: InvoiceData | null = null;
    let invRef: any = null;

    if (entry.invoiceId) {
      invRef = doc(db, 'invoices', entry.invoiceId);
      const invDoc = await transaction.get(invRef);
      if (invDoc.exists()) {
        currentInv = invDoc.data() as InvoiceData;
      }
    }

    // 2. ALL WRITES AFTER READS
    transaction.set(entryRef, {
      ...entry,
      createdAt: serverTimestamp()
    });

    if (currentInv && invRef) {
      let newBalance = currentInv.balanceCents;

      if (entry.type === 'payment' || entry.type === 'partial_payment' || entry.type === 'credit') {
        newBalance -= entry.amountCents;
      } else if (entry.type === 'refund' || entry.type === 'cancellation_fee') {
        newBalance += entry.amountCents;
      } else if (entry.type === 'charge') {
        // If initial charge for invoice, cap/align at totalCents
        if (newBalance >= currentInv.totalCents) {
          newBalance = currentInv.totalCents;
        } else {
          newBalance = Math.min(currentInv.totalCents, newBalance + entry.amountCents);
        }
      }

      let newStatus: InvoiceStatus = currentInv.status;
      if (newBalance <= 0) {
        newStatus = 'paid';
        newBalance = 0;
      } else if (newBalance < currentInv.totalCents) {
        newStatus = 'partially_paid';
      } else {
        newStatus = 'unpaid';
      }

      transaction.update(invRef, {
        balanceCents: newBalance,
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    }
  });

  return entryRef.id;
}
