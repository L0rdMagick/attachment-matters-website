import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { db } from './config';
import type { ConsentTemplateData, SignedDocumentData } from '../../types/consent';

// Pre-configured practice consent templates
export const DEFAULT_CONSENT_TEMPLATES: ConsentTemplateData[] = [
  {
    id: 'informed_consent',
    title: 'Informed Consent for Psychotherapy',
    category: 'Clinical Treatment',
    version: 'v1.0',
    isActive: true,
    requiredForIntake: true,
    textContent: `FAMILY TRUST THERAPY - INFORMED CONSENT FOR PSYCHOTHERAPY

1. Services Offered: Psychotherapy is a collaborative process between client and clinician designed to assist you in addressing personal, emotional, or relational goals.
2. Confidentiality: Information disclosed during therapy sessions is protected by law and professional ethics. Exceptions to confidentiality include: (a) suspicion of child, elder, or vulnerable adult abuse/neglect, (b) serious threat of imminent harm to self or others, or (c) court order.
3. Appointments & Cancellations: Scheduled appointments require 24 hours cancellation notice. Late cancellations or no-shows may incur a cancellation fee.
4. Client Rights: You have the right to request changes to treatment plans, seek a second opinion, or discontinue treatment at any time.`
  },
  {
    id: 'telehealth_consent',
    title: 'Telehealth Services Informed Consent',
    category: 'Service Delivery',
    version: 'v1.0',
    isActive: true,
    requiredForIntake: true,
    textContent: `TELEHEALTH SERVICES CONSENT ACKNOWLEDGMENT

1. Nature of Telehealth: Telehealth involves the delivery of mental healthcare services using interactive audio/video technologies.
2. Confidentiality & Security: Sessions are conducted via encrypted, HIPAA-aligned video platforms. You are responsible for ensuring a private, quiet space on your end.
3. Emergency Protocol: In the event of a technological disruption during a crisis, staff will contact your emergency phone number or emergency services (911/988).`
  },
  {
    id: 'financial_policy',
    title: 'Financial Responsibility & Cancellation Agreement',
    category: 'Billing Policy',
    version: 'v1.0',
    isActive: true,
    requiredForIntake: true,
    textContent: `FINANCIAL RESPONSIBILITY & PAYMENT AGREEMENT

1. Payment Terms: Payment or copays are due at the time of service unless alternative arrangements are established.
2. Outstanding Balances: Statements are generated monthly. Balances unpaid past 30 days are subject to administrative review.
3. Cancellation Fee: Sessions canceled with less than 24 hours notice will be charged a standard cancellation fee.`
  }
];

/**
 * Fetch all active consent templates
 */
export async function getConsentTemplates(): Promise<ConsentTemplateData[]> {
  const colRef = collection(db, 'consentTemplates');
  const snap = await getDocs(colRef);

  if (snap.empty) {
    // Return default templates if empty in Firestore
    return DEFAULT_CONSENT_TEMPLATES;
  }

  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ConsentTemplateData));
}

/**
 * Fetch signed documents for a client
 */
export async function getSignedDocuments(clientId: string): Promise<SignedDocumentData[]> {
  const colRef = collection(db, 'signedDocuments');
  const q = query(colRef, where('clientId', '==', clientId));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SignedDocumentData));
}

import { createPracticeNotification } from './notifications';

/**
 * Sign & Freeze Consent Document
 */
export async function signConsentDocument(
  clientId: string,
  template: ConsentTemplateData,
  clientTypedName: string,
  signatureDataUrl?: string
): Promise<string> {
  const documentHash = `DOC_${template.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  const signedDoc: SignedDocumentData = {
    clientId,
    templateId: template.id,
    templateVersion: template.version,
    documentTitle: template.title,
    exactTextSnapshot: template.textContent, // Freezes exact document text at signing time!
    clientTypedName,
    signatureDataUrl: signatureDataUrl || null,
    signedAtISO: new Date().toISOString(),
    documentHash,
    status: 'signed'
  };

  // Check if previously signed to determine if this is an update
  let isUpdate = false;
  try {
    const existingDocs = await getSignedDocuments(clientId);
    isUpdate = existingDocs.some((d) => d.templateId === template.id);
  } catch (checkErr) {
    console.warn("Could not check existing signed documents:", checkErr);
  }

  await addDoc(collection(db, 'signedDocuments'), {
    ...signedDoc,
    createdAt: serverTimestamp()
  });

  // Update consent status in client document
  const clientRef = doc(db, 'clients', clientId);
  await setDoc(
    clientRef,
    {
      consentStatus: 'completed',
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  try {
    const formattedTimestamp = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const detailsStr = [
      `Document: ${template.title}`,
      `Category: ${template.category} (${template.version})`,
      `Signer Legal Name: ${clientTypedName}`,
      `Action: ${isUpdate ? 'Re-signed & Updated Agreement' : 'New Signature Executed'}`,
      `Audit Hash: ${documentHash}`,
      `Signed At: ${formattedTimestamp}`
    ].join('\n');

    await createPracticeNotification({
      type: 'document_signed',
      title: isUpdate ? '📄 Consent Agreement Updated' : '📄 Consent Agreement Signed',
      message: `${clientTypedName} ${isUpdate ? 'updated and re-signed' : 'electronically signed'} ${template.title}.`,
      clientId,
      clientName: clientTypedName,
      details: detailsStr
    });
  } catch (notifErr) {
    console.warn("Failed to dispatch practice notification for document sign:", notifErr);
  }

  return documentHash;
}
