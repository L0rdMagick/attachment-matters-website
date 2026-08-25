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

import { createPracticeNotification } from './notifications';
import { sendPortalEmail } from '../email';
import { getAvailabilityRules } from './scheduling';

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

  // Check if intake was previously submitted to determine if this is an update
  let isUpdate = false;
  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists() && existingSnap.data()?.status === 'submitted') {
      isUpdate = true;
    }
  } catch (checkErr) {
    console.warn("Could not check existing intake submission:", checkErr);
  }

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

  if (isFinalSubmit) {
    const clientProfSnap = await getDoc(doc(db, 'clients', clientId));
    const cData = clientProfSnap.exists() ? clientProfSnap.data() : {};
    const clientName = (cData.legalFirstName ? `${cData.legalFirstName} ${cData.legalLastName || ''}` : 'Client').trim();

    const formattedTimestamp = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const keyDetails: string[] = [];
    keyDetails.push(`Action: ${isUpdate ? 'Intake Form Re-submitted & Updated' : 'Initial Clinical Intake Submitted'}`);
    
    if (formData.reasonForTherapy?.trim()) {
      const truncatedReason = formData.reasonForTherapy.trim().substring(0, 120);
      keyDetails.push(`Primary Presentation: "${truncatedReason}${formData.reasonForTherapy.length > 120 ? '...' : ''}"`);
    }

    if (formData.therapyGoals?.trim()) {
      const truncatedGoals = formData.therapyGoals.trim().substring(0, 120);
      keyDetails.push(`Treatment Goals: "${truncatedGoals}${formData.therapyGoals.length > 120 ? '...' : ''}"`);
    }

    if (formData.currentSymptoms && formData.currentSymptoms.length > 0) {
      keyDetails.push(`Reported Symptoms (${formData.currentSymptoms.length}): ${formData.currentSymptoms.slice(0, 6).join(', ')}${formData.currentSymptoms.length > 6 ? '...' : ''}`);
    }

    if (formData.safetyScreeningAnswers) {
      const safetyFlags: string[] = [];
      if (formData.safetyScreeningAnswers.suicidalIdeationPastMonth) safetyFlags.push('⚠️ Suicidal Ideation (Past Month)');
      if (formData.safetyScreeningAnswers.selfHarmHistory) safetyFlags.push('⚠️ Self-Harm History');
      if (safetyFlags.length > 0) {
        keyDetails.push(`Safety Screening Alerts: ${safetyFlags.join(' | ')}`);
      } else {
        keyDetails.push(`Safety Screening: No immediate suicidal ideation or self-harm reported.`);
      }
    }

    keyDetails.push(`Submitted At: ${formattedTimestamp}`);

    await createPracticeNotification({
      type: 'intake_submitted',
      title: isUpdate ? '📝 Intake Form Updated' : '📝 Intake Form Submitted',
      message: `${clientName} ${isUpdate ? 'updated and re-submitted' : 'submitted'} their initial clinical intake questionnaire.`,
      clientId,
      clientName,
      details: keyDetails.join('\n')
    });

    const rules = await getAvailabilityRules('default');
    if (rules.emailNotifications?.intakeSubmitted !== false) {
      const recipients: string[] = ['info@familytrusttherapy.com'];
      if (cData.email) recipients.push(cData.email);

      sendPortalEmail({
        to: recipients,
        subject: `Clinical Intake Submitted: ${clientName}`,
        headline: 'Intake Questionnaire Received',
        bodyHtml: `<p>Clinical intake questionnaire has been submitted for <strong>${clientName}</strong>.</p><p>${keyDetails.join('<br/>')}</p>`,
        actionUrl: 'https://familytrusttherapy.com/portal',
        actionText: 'Review Intake Submission'
      });
    }
  }
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
