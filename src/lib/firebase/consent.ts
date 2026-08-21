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
    version: 'v1.4 (2026)',
    isActive: true,
    requiredForIntake: true,
    description: 'Comprehensive initial questionnaire capturing reason for therapy, medical history, social history, and safety screening.',
    lastUpdated: '2026-08-01',
    sections: [
      {
        id: 'sec-1',
        title: 'SECTION 1: REASON FOR SEEKING CLINICAL TREATMENT & GOALS',
        content: `1.1 Primary Reason for Therapy Presentation & Symptoms
Comprehensive presentation details, primary concerns, and emotional/relational status.

1.2 Reported Symptoms & Presenting Concerns
Trauma / PTSD Symptoms • Sleep Disturbance • Grief / Loss • Anxiety • Mood Regulation

1.3 Primary Treatment Goals & Desired Outcomes
Client-centered goals and clinical milestones for therapeutic outcomes.`
      },
      {
        id: 'sec-2',
        title: 'SECTION 2: TREATMENT & MEDICAL HISTORY',
        content: `2.1 Prior Psychotherapy / Counseling History
Previous counseling experience, inpatient/outpatient treatment, and prior clinical outcomes.

2.2 Current Prescription & OTC Medications
List of current medications, dosages, and prescribing clinicians.

2.3 Relevant Medical Conditions & History
Chronic medical conditions, injuries, physical health factors impacting clinical care.

2.4 Current Healthcare & Medical Providers
Primary care physician and psychiatric/specialist provider disclosures.`
      },
      {
        id: 'sec-3',
        title: 'SECTION 3: SOCIAL HISTORY, SAFETY ASSESSMENT & ADDITIONAL NOTES',
        content: `3.1 Social History & Relationship Background
Relationship status, employment/educational history, living situation, and support systems.

3.2 Safety Screening Assessment Record
Standard Columbia-SSRS Safety Assessment screening for self-harm and suicidal ideation.

3.3 Additional Client Disclosures & Notes
Additional context, preferences, or confidential notes provided by client.`
      }
    ],
    textContent: `FAMILY TRUST THERAPY - INITIAL CLIENT CLINICAL INTAKE QUESTIONNAIRE

SECTION 1: REASON FOR SEEKING CLINICAL TREATMENT & GOALS
1.1 Primary Reason for Therapy Presentation & Symptoms
1.2 Reported Symptoms & Presenting Concerns
1.3 Primary Treatment Goals & Desired Outcomes

SECTION 2: TREATMENT & MEDICAL HISTORY
2.1 Prior Psychotherapy / Counseling History
2.2 Current Prescription & OTC Medications
2.3 Relevant Medical Conditions & History
2.4 Current Healthcare & Medical Providers

SECTION 3: SOCIAL HISTORY, SAFETY ASSESSMENT & ADDITIONAL NOTES
3.1 Social History & Relationship Background
3.2 Safety Screening Assessment Record
3.3 Additional Client Disclosures & Notes`
  },
  {
    id: 'informed_consent',
    title: 'Informed Consent for Psychotherapy',
    category: 'Clinical Treatment',
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
    textContent: `FAMILY TRUST THERAPY - INFORMED CONSENT FOR PSYCHOTHERAPY

1. Nature of Psychotherapy Services
Psychotherapy is a collaborative process between client and clinician designed to assist you in addressing personal, emotional, or relational goals.

2. Confidentiality & Legal Exceptions
Information disclosed during therapy sessions is protected by law and professional ethics. Exceptions to confidentiality include: (a) suspicion of child, elder, or vulnerable adult abuse/neglect, (b) serious threat of imminent harm to self or others, or (c) court order.

3. Cancellation & Attendance Policy
Scheduled appointments require 24 hours cancellation notice. Late cancellations or no-shows may incur a standard cancellation fee.

4. Client Rights & Voluntary Participation
You have the right to request changes to treatment plans, seek a second opinion, or discontinue treatment at any time.`
  },
  {
    id: 'telehealth_consent',
    title: 'Telehealth Services Informed Consent',
    category: 'Service Delivery',
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
    textContent: `TELEHEALTH SERVICES CONSENT ACKNOWLEDGMENT

1. Nature of Telehealth Services
Telehealth involves the delivery of mental healthcare services using interactive audio/video technologies.

2. Confidentiality & Security
Sessions are conducted via encrypted, HIPAA-aligned video platforms. You are responsible for ensuring a private, quiet space on your end.

3. Emergency Protocol & Physical Location
In the event of a technological disruption during a crisis, staff will contact your emergency phone number or emergency services (911/988). You must verify your physical address at the beginning of each session.`
  },
  {
    id: 'financial_policy',
    title: 'Financial Responsibility & Cancellation Agreement',
    category: 'Billing Policy',
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
    textContent: `FINANCIAL RESPONSIBILITY & PAYMENT AGREEMENT

1. Practice Fee Schedule & Payment Terms
Payment or copays are due at the time of service unless alternative arrangements are established.

2. Outstanding Balances & Billing
Statements are generated monthly. Balances unpaid past 30 days are subject to administrative review.

3. Late Cancellation Policy
Sessions canceled with less than 24 hours notice will be charged a standard cancellation fee.`
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
      lastConsentSignedAt: serverTimestamp(),
      lastConsentTitle: template.title,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  try {
    let clientDisplayName = clientTypedName;
    try {
      const cSnap = await getDoc(clientRef);
      if (cSnap.exists()) {
        const cData = cSnap.data();
        if (cData.legalFirstName) {
          clientDisplayName = `${cData.legalFirstName} ${cData.legalLastName || ''}`.trim();
        }
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
  } catch (notifErr) {
    console.warn("Failed to dispatch practice notification for document sign:", notifErr);
  }

  return documentHash;
}
