export type LedgerEntryType =
  | 'charge'
  | 'payment'
  | 'partial_payment'
  | 'refund'
  | 'credit'
  | 'adjustment'
  | 'write_off'
  | 'cancellation_fee'
  | 'no_show_fee';

export interface LedgerEntryData {
  id?: string;
  clientId: string;
  invoiceId?: string;
  type: LedgerEntryType;
  amountCents: number;
  paymentMethod?: 'credit_card_token' | 'check' | 'cash' | 'hsa_fsa' | 'other';
  transactionRef?: string;
  notes?: string;
  createdById: string;
  createdAt?: any;
}

export type InvoiceStatus = 'draft' | 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'void';

export interface InvoiceData {
  id?: string;
  clientId: string;
  appointmentId?: string;
  invoiceNumber: string;
  description: string;
  totalCents: number;
  balanceCents: number;
  status: InvoiceStatus;
  dueDate: string;
  createdAt?: any;
  updatedAt?: any;
}
