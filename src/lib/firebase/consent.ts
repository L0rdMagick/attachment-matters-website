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

import { deleteDoc } from 'firebase/firestore';

const STORAGE_KEY = 'practice_form_templates_v1';
const DELETED_KEY = 'deleted_practice_form_templates_v1';

// Pre-configured practice consent templates with structured sections
export const DEFAULT_CONSENT_TEMPLATES: ConsentTemplateData[] = [
  {
    id: 'intake-v1',
    title: 'Initial Client Clinical Intake Questionnaire',
    category: 'Intake',
    formType: 'questionnaire',
    version: 'v1.4 (2026)',
    isActive: true,
    requiredForIntake: true,
    description: 'Comprehensive initial questionnaire capturing reason for therapy, medical history, social history, and safety screening.',
    lastUpdated: '2026-08-01',
    sections: [
      {
        id: 'sec-1',
        title: '1.1 Primary Reason for Seeking Therapy & Symptoms',
        content: 'Please describe your primary presenting concerns, emotional symptoms, and why you are seeking therapy at this time.'
      },
      {
        id: 'sec-2',
        title: '1.2 Primary Treatment Goals & Desired Outcomes',
        content: 'What are your main goals for counseling? What changes or improvements would you like to see?'
      },
      {
        id: 'sec-3',
        title: '2.1 Prior Psychotherapy & Psychiatric Treatment History',
        content: 'Please list any previous counseling, mental health diagnosis, or psychiatric hospitalizations.'
      },
      {
        id: 'sec-4',
        title: '2.2 Current Prescription & OTC Medications',
        content: 'List all current prescription medications, dosages, and prescribing clinicians.'
      },
      {
        id: 'sec-5',
        title: '2.3 Relevant Medical Conditions & Healthcare Providers',
        content: 'List any relevant physical medical conditions, surgeries, or primary care providers.'
      },
      {
        id: 'sec-6',
        title: '3.1 Social History, Relationship Status & Employment',
        content: 'Describe your current relationship status, living arrangement, support system, and employment/schooling.'
      },
      {
        id: 'sec-7',
        title: '3.2 Safety Screening & Additional Clinical Disclosures',
        content: 'Include any relevant safety history (self-harm, suicidal thoughts, substance use) or additional notes for your clinician.'
      }
    ],
    textContent: `FAMILY TRUST THERAPY - INITIAL CLIENT CLINICAL INTAKE QUESTIONNAIRE`
  },
  {
    id: 'informed_consent',
    title: 'Informed Consent for Psychotherapy',
    category: 'Clinical Treatment',
    formType: 'consent',
    version: 'v1.0',
    isActive: true,
    requiredForIntake: true,
    description: 'Legal agreement covering therapeutic process, confidentiality parameters, mandatory reporting, and client rights.',
    lastUpdated: '2026-08-01',
    sections: [
      {
        id: 'sec-1',
        title: '1. Nature of Psychotherapy Services',
        content: 'Psychotherapy is a collaborative process between client and clinician designed to assist you in addressing personal, emotional, or relational goals.'
      },
      {
        id: 'sec-2',
        title: '2. Confidentiality & Legal Exceptions',
        content: 'Information disclosed during therapy sessions is protected by law and professional ethics. Exceptions to confidentiality include: (a) suspicion of child, elder, or vulnerable adult abuse/neglect, (b) serious threat of imminent harm to self or others, or (c) court order.'
      },
      {
        id: 'sec-3',
        title: '3. Cancellation & Attendance Policy',
        content: 'Scheduled appointments require 24 hours cancellation notice. Late cancellations or no-shows may incur a standard cancellation fee.'
      },
      {
        id: 'sec-4',
        title: '4. Client Rights & Voluntary Participation',
        content: 'You have the right to request changes to treatment plans, seek a second opinion, or discontinue treatment at any time.'
      }
    ],
    textContent: `FAMILY TRUST THERAPY - INFORMED CONSENT FOR PSYCHOTHERAPY`
  },
  {
    id: 'telehealth_consent',
    title: 'Telehealth Services Informed Consent',
    category: 'Service Delivery',
    formType: 'consent',
    version: 'v1.0',
    isActive: true,
    requiredForIntake: true,
    description: 'Specialized consent for HIPAA-compliant audio/video sessions, emergency protocols, and technical requirements.',
    lastUpdated: '2026-08-01',
    sections: [
      {
        id: 'sec-1',
        title: '1. Nature of Telehealth Services',
        content: 'Telehealth involves the delivery of mental healthcare services using interactive audio/video technologies.'
      },
      {
        id: 'sec-2',
        title: '2. Confidentiality & Security',
        content: 'Sessions are conducted via encrypted, HIPAA-aligned video platforms. You are responsible for ensuring a private, quiet space on your end.'
      },
      {
        id: 'sec-3',
        title: '3. Emergency Protocol & Physical Location',
        content: 'In the event of a technological disruption during a crisis, staff will contact your emergency phone number or emergency services (911/988). You must verify your physical address at the beginning of each session.'
      }
    ],
    textContent: `TELEHEALTH SERVICES CONSENT ACKNOWLEDGMENT`
  },
  {
    id: 'financial_policy',
    title: 'Financial Responsibility & Cancellation Agreement',
    category: 'Billing Policy',
    formType: 'consent',
    version: 'v1.0',
    isActive: true,
    requiredForIntake: true,
    description: 'Fee schedule, payment terms, insurance claim policies, and financial authorization.',
    lastUpdated: '2026-08-01',
    sections: [
      {
        id: 'sec-1',
        title: '1. Practice Fee Schedule & Payment Terms',
        content: 'Payment or copays are due at the time of service unless alternative arrangements are established.'
      },
      {
        id: 'sec-2',
        title: '2. Outstanding Balances & Billing',
        content: 'Statements are generated monthly. Balances unpaid past 30 days are subject to administrative review.'
      },
      {
        id: 'sec-3',
        title: '3. Late Cancellation Policy',
        content: 'Sessions canceled with less than 24 hours notice will be charged a standard cancellation fee.'
      }
    ],
    textContent: `FINANCIAL RESPONSIBILITY & PAYMENT AGREEMENT`
  }
];

/**
 * Helpers for local storage & deletion tracking
 */
function getDeletedTemplateIds(): string[] {
  try {
    const raw = localStorage.getItem(DELETED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function addDeletedTemplateId(id: string): void {
  try {
    const current = getDeletedTemplateIds();
    if (!current.includes(id)) {
      localStorage.setItem(DELETED_KEY, JSON.stringify([...current, id]));
    }
  } catch (err) {
    console.warn("Could not save deleted template ID:", err);
  }
}

function getLocalTemplates(): ConsentTemplateData[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn("Could not read local templates:", err);
  }
  return null;
}

function saveLocalTemplates(templates: ConsentTemplateData[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (err) {
    console.warn("Could not save local templates:", err);
  }
}

/**
 * Fetch all active consent templates (Firestore + LocalStorage + Default Merging)
 */
export async function getConsentTemplates(): Promise<ConsentTemplateData[]> {
  const deletedIds = getDeletedTemplateIds();
  let saved: ConsentTemplateData[] = [];

  try {
    const colRef = collection(db, 'consentTemplates');
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      saved = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ConsentTemplateData));
    }
  } catch (err) {
    console.warn("Could not fetch templates from Firestore:", err);
  }

  if (saved.length === 0) {
    const local = getLocalTemplates();
    if (local && local.length > 0) {
      saved = local;
    }
  }

  // Merge default templates with saved Firestore/LocalStorage templates
  const templateMap = new Map<string, ConsentTemplateData>();

  // 1. Seed defaults (if not deleted)
  DEFAULT_CONSENT_TEMPLATES.forEach((t) => {
    if (!deletedIds.includes(t.id)) {
      templateMap.set(t.id, t);
    }
  });

  // 2. Override/add saved templates
  saved.forEach((t) => {
    if (!deletedIds.includes(t.id) && t.isActive !== false) {
      templateMap.set(t.id, t);
    }
  });

  const merged = Array.from(templateMap.values());
  saveLocalTemplates(merged);
  return merged;
}

/**
 * Save / Update a consent template (Firestore + LocalStorage Sync)
 */
export async function saveConsentTemplate(template: ConsentTemplateData): Promise<void> {
  // Update Firestore
  try {
    const docRef = doc(db, 'consentTemplates', template.id);
    await setDoc(docRef, {
      ...template,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn("Could not save template to Firestore, saved locally:", err);
  }

  // Update Local Storage
  const current = (await getConsentTemplates()) || [];
  const idx = current.findIndex(t => t.id === template.id);
  let updatedList: ConsentTemplateData[];
  if (idx >= 0) {
    updatedList = [...current];
    updatedList[idx] = template;
  } else {
    updatedList = [...current, template];
  }
  saveLocalTemplates(updatedList);
}

/**
 * Delete a consent template (Firestore + LocalStorage Sync)
 */
export async function deleteConsentTemplate(templateId: string): Promise<void> {
  addDeletedTemplateId(templateId);

  // Update Firestore
  try {
    const docRef = doc(db, 'consentTemplates', templateId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn("Could not delete template from Firestore, deleted locally:", err);
  }

  // Update Local Storage
  const current = (await getConsentTemplates()) || [];
  const updatedList = current.filter(t => t.id !== templateId);
  saveLocalTemplates(updatedList);
}

const STORAGE_SIGNED_DOCS_KEY = 'practice_signed_documents_v1';

function getLocalSignedDocuments(clientId?: string): SignedDocumentData[] {
  try {
    const raw = localStorage.getItem(STORAGE_SIGNED_DOCS_KEY);
    if (raw) {
      const all: SignedDocumentData[] = JSON.parse(raw);
      if (clientId) {
        return all.filter((d) => d.clientId === clientId);
      }
      return all;
    }
  } catch (err) {
    console.warn("Could not read local signed documents:", err);
  }
  return [];
}

function saveLocalSignedDocument(docToSave: SignedDocumentData): void {
  try {
    const all = getLocalSignedDocuments();
    const idx = all.findIndex((d) => d.documentHash === docToSave.documentHash || (d.clientId === docToSave.clientId && d.templateId === docToSave.templateId));
    let updated: SignedDocumentData[];
    if (idx >= 0) {
      updated = [...all];
      updated[idx] = docToSave;
    } else {
      updated = [docToSave, ...all];
    }
    localStorage.setItem(STORAGE_SIGNED_DOCS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("Could not save local signed document:", err);
  }
}

/**
 * Fetch signed documents for a client (Firestore + LocalStorage Sync)
 */
export async function getSignedDocuments(clientId: string): Promise<SignedDocumentData[]> {
  let fsDocs: SignedDocumentData[] = [];
  try {
    const colRef = collection(db, 'signedDocuments');
    const q = query(colRef, where('clientId', '==', clientId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      fsDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SignedDocumentData));
    }
  } catch (err) {
    console.warn("Could not fetch signed documents from Firestore, using local fallback:", err);
  }

  const localDocs = getLocalSignedDocuments(clientId);

  // Merge Firestore docs with LocalStorage docs (by documentHash or templateId)
  const docMap = new Map<string, SignedDocumentData>();
  localDocs.forEach((d) => docMap.set(d.documentHash || `${d.clientId}_${d.templateId}`, d));
  fsDocs.forEach((d) => docMap.set(d.documentHash || `${d.clientId}_${d.templateId}`, d));

  const merged = Array.from(docMap.values());
  // Update local cache
  merged.forEach((d) => saveLocalSignedDocument(d));
  return merged;
}

import { createPracticeNotification } from './notifications';
import { sendPortalEmail } from '../email';
import { getAvailabilityRules } from './scheduling';

/**
 * Sign & Freeze Consent Document (Firestore + LocalStorage Sync)
 */
export async function signConsentDocument(
  clientId: string,
  template: ConsentTemplateData,
  clientTypedName: string,
  signatureDataUrl?: string,
  answers?: Record<string, string>,
  exactTextSnapshotOverride?: string
): Promise<string> {
  const documentHash = `DOC_${template.id}_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  const signedDoc: SignedDocumentData = {
    clientId,
    templateId: template.id,
    templateVersion: template.version,
    documentTitle: template.title,
    exactTextSnapshot: exactTextSnapshotOverride || template.textContent, // Freezes exact document text at signing time!
    answers: answers || {},
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

  // 1. Immediately save to LocalStorage cache
  saveLocalSignedDocument(signedDoc);

  // 2. Save to Firestore
  try {
    await addDoc(collection(db, 'signedDocuments'), {
      ...signedDoc,
      createdAt: serverTimestamp()
    });
  } catch (fsErr) {
    console.warn("Could not save signed document to Firestore, saved locally:", fsErr);
  }

  // 3. Update consent status in client document
  try {
    const clientRef = doc(db, 'clients', clientId);
    await setDoc(
      clientRef,
      {
        consentStatus: 'completed',
        lastConsentSignedAt: serverTimestamp(),
        lastConsentTitle: template.title,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  } catch (cErr) {
    console.warn("Could not update client consent status in Firestore:", cErr);
  }

  try {
    let clientDisplayName = clientTypedName;
    let clientEmail: string | undefined = undefined;
    try {
      const clientRef = doc(db, 'clients', clientId);
      const cSnap = await getDoc(clientRef);
      if (cSnap.exists()) {
        const cData = cSnap.data();
        if (cData.legalFirstName) {
          clientDisplayName = `${cData.legalFirstName} ${cData.legalLastName || ''}`.trim();
        }
        clientEmail = cData.email;
      }
    } catch (nameErr) {
      console.warn("Could not fetch client profile name:", nameErr);
    }

    const formattedTimestamp = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const detailsStr = [
      `Document: ${template.title}`,
      `Category: ${template.category} (${template.version})`,
      `Signer Legal Name: ${clientTypedName}`,
      `Account Client: ${clientDisplayName}`,
      `Action: ${isUpdate ? 'Re-signed & Updated Agreement' : 'New Signature Executed'}`,
      `Audit Hash: ${documentHash}`,
      `Signed At: ${formattedTimestamp}`
    ].join('\n');

    await createPracticeNotification({
      type: 'document_signed',
      title: isUpdate ? '📄 Consent Agreement Updated' : '📄 Consent Agreement Signed',
      message: `${clientDisplayName} ${isUpdate ? 'updated and re-signed' : 'electronically signed'} ${template.title}.`,
      clientId,
      clientName: clientDisplayName,
      details: detailsStr
    });

    const rules = await getAvailabilityRules('default');
    if (rules.emailNotifications?.consentSigned !== false) {
      const recipients: string[] = ['info@familytrusttherapy.com'];
      if (clientEmail) recipients.push(clientEmail);

      sendPortalEmail({
        to: recipients,
        subject: `Signed Document Executed: ${clientDisplayName} - ${template.title}`,
        headline: 'Consent Document Signed & Recorded',
        bodyHtml: `<p><strong>${clientDisplayName}</strong> has signed <strong>${template.title}</strong> (${template.version}).</p><p>Audit Record Hash: <code>${documentHash}</code></p>`,
        actionUrl: 'https://familytrusttherapy.com/portal',
        actionText: 'View Document Audit Trail'
      });
    }
  } catch (notifErr) {
    console.warn("Failed to dispatch practice notification for document sign:", notifErr);
  }

  return documentHash;
}
