import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';
import type { IntakeSubmissionData } from '../../types/intake';

/**
 * Fetch intake submission for a client
 */
export async function getIntakeSubmission(clientId: string): Promise<IntakeSubmissionData | null> {
  const docRef = doc(db, 'intakeSubmissions', clientId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data() as IntakeSubmissionData;
  }
  return null;
}

/**
 * Save draft or final submission of Intake Form
 */
export async function saveIntakeSubmission(
  clientId: string,
  formData: Partial<IntakeSubmissionData>,
  isFinalSubmit: boolean = false
) {
  const docRef = doc(db, 'intakeSubmissions', clientId);
  const status = isFinalSubmit ? 'submitted' : 'draft';

  const payload: Partial<IntakeSubmissionData> = {
    ...formData,
    clientId,
    templateVersion: 'v1.0',
    status,
    ...(isFinalSubmit ? { submittedAt: serverTimestamp() } : {})
  };

  await setDoc(docRef, payload, { merge: true });

  // Update intake status in client document
  const clientRef = doc(db, 'clients', clientId);
  await setDoc(
    clientRef,
    {
      uid: clientId,
      intakeStatus: status,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

/**
 * Therapist: Review Intake Submission (Approve or Request Revision)
 */
export async function reviewIntakeSubmission(
  clientId: string,
  status: 'approved' | 'revision_requested',
  revisionNotes?: string
) {
  const docRef = doc(db, 'intakeSubmissions', clientId);

  await setDoc(
    docRef,
    {
      status,
      reviewedAt: serverTimestamp(),
      ...(revisionNotes ? { revisionNotes } : {})
    },
    { merge: true }
  );

  const clientRef = doc(db, 'clients', clientId);
  await setDoc(
    clientRef,
    {
      intakeStatus: status,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}
