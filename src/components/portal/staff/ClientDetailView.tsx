import React, { useState, useEffect } from 'react';
import { getClientProfile } from '../../../lib/firebase/clients';
import { getSignedDocuments } from '../../../lib/firebase/consent';
import { getIntakeSubmission, reviewIntakeSubmission } from '../../../lib/firebase/intake';
import type { ClientProfileData } from '../../../types/client';
import type { SignedDocumentData } from '../../../types/consent';
import type { IntakeSubmissionData } from '../../../types/intake';

interface ClientDetailViewProps {
  clientId: string;
  onBack: () => void;
}

type ChartTab =
  | 'overview'
  | 'contact'
  | 'appointments'
  | 'intake'
  | 'documents'
  | 'shared-notes'
  | 'private-clinical-notes'
  | 'billing'
  | 'files'
  | 'audit';

export const ClientDetailView: React.FC<ClientDetailViewProps> = ({ clientId, onBack }) => {
  const [client, setClient] = useState<ClientProfileData | null>(null);
  const [signedDocs, setSignedDocs] = useState<SignedDocumentData[]>([]);
  const [intakeData, setIntakeData] = useState<IntakeSubmissionData | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<SignedDocumentData | null>(null);
  const [activeTab, setActiveTab] = useState<ChartTab>('overview');
  const [loading, setLoading] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Review states
  const [reviewingIntake, setReviewingIntake] = useState(false);
  const [revisionNotesInput, setRevisionNotesInput] = useState('');
  const [showRevisionForm, setShowRevisionForm] = useState(false);

  useEffect(() => {
    async function loadClient() {
      try {
        const [data, docs, intake] = await Promise.all([
          getClientProfile(clientId),
          getSignedDocuments(clientId),
          getIntakeSubmission(clientId)
        ]);
        setClient(data);
        setSignedDocs(docs);
        setIntakeData(intake);
        if (docs.length > 0) {
          setSelectedDoc(docs[0]);
        }
      } catch (err) {
        console.error("Failed to load client chart", err);
      } finally {
        setLoading(false);
      }
    }
    loadClient();
  }, [clientId]);

  const refreshSignedDocs = async () => {
    setLoadingDocs(true);
    try {
      const docs = await getSignedDocuments(clientId);
      setSignedDocs(docs);
      if (docs.length > 0 && !selectedDoc) {
        setSelectedDoc(docs[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDocs(false);
    }
  };

  const refreshIntake = async () => {
    try {
      const intake = await getIntakeSubmission(clientId);
      setIntakeData(intake);
    } catch (err) {
      console.error(err);
    }
  };

  const handleReviewStatus = async (status: 'approved' | 'revision_requested') => {
    setReviewingIntake(true);
    try {
      await reviewIntakeSubmission(clientId, status, status === 'revision_requested' ? revisionNotesInput : undefined);
      await refreshIntake();
      setShowRevisionForm(false);
      alert(`Intake submission marked as ${status.replace('_', ' ')}.`);
    } catch (err: any) {
      console.error(err);
      alert("Failed to update intake review status.");
    } finally {
      setReviewingIntake(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'documents') {
      refreshSignedDocs();
    }
    if (activeTab === 'intake') {
      refreshIntake();
    }
  }, [activeTab]);

  if (loading) {
    return <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl font-sans text-sm">Loading client chart...</div>;
  }

  if (!client) {
    return (
      <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl font-sans">
        <p className="text-red-600 mb-4 text-sm">Client chart not found.</p>
        <button onClick={onBack} className="px-4 py-2 bg-[#4A5741] text-white text-xs rounded-xl font-medium">
          ← Back to Directory
        </button>
      </div>
    );
  }

  const tabs: { id: ChartTab; label: string; badge?: string }[] = [
    { id: 'overview', label: 'Overview & Profile' },
    { id: 'contact', label: 'Contact Info' },
    { id: 'appointments', label: 'Appointments' },
    { id: 'intake', label: 'Intake Packet', badge: intakeData?.status || client.intakeStatus },
    { id: 'documents', label: 'Signed Docs', badge: signedDocs.length > 0 ? `${signedDocs.length} Signed` : client.consentStatus },
    { id: 'shared-notes', label: 'Shared Summaries' },
    { id: 'private-clinical-notes', label: '🔒 Private Notes (DAP/SOAP)' },
    { id: 'billing', label: 'Billing & Ledger' },
    { id: 'files', label: 'Insurance Cards & Files' },
    { id: 'audit', label: 'Audit History' }
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner & Client Summary */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <button onClick={onBack} className="text-xs text-[#BF5B33] hover:underline font-semibold mb-2 block">
            ← Back to Directory
          </button>
          <h2 className="text-3xl font-serif text-[#2C2A2A] font-medium">
            {client.legalLastName}, {client.legalFirstName}{' '}
            {client.legalMiddleName ? `${client.legalMiddleName} ` : ''}
            {client.preferredName ? <span className="text-[#4A5741] font-normal">("{client.preferredName}")</span> : ''}
          </h2>
          <p className="text-xs text-[#2C2A2A]/70 mt-1">
            DOB: <span className="font-semibold text-[#2C2A2A]">{client.dob || 'Not provided'}</span> | Pronouns:{' '}
            <span className="font-semibold text-[#2C2A2A]">{client.pronouns || 'Not specified'}</span> | Format:{' '}
            <span className="font-semibold text-[#2C2A2A] capitalize">{client.preferredFormat || 'Telehealth'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1.5 rounded-full font-semibold bg-[#4A5741]/10 text-[#4A5741] border border-[#4A5741]/20">
            Account Status: {client.accountStatus || 'Active'}
          </span>
          <button className="px-4 py-2 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl shadow-sm transition">
            + Schedule Appointment
          </button>
        </div>
      </div>

      {/* Chart Navigation Tabs */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-2 shadow-sm overflow-x-auto flex space-x-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isPrivate = tab.id === 'private-clinical-notes';
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition flex items-center gap-1.5 ${
                isActive
                  ? isPrivate
                    ? 'bg-red-700 text-white shadow-sm'
                    : 'bg-[#4A5741] text-white shadow-sm'
                  : isPrivate
                  ? 'text-red-700 hover:bg-red-50'
                  : 'text-[#2C2A2A]/80 hover:bg-[#EAE1D2]/50'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[#BF5B33]/10 text-[#BF5B33]'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content Display Area */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm">
        {activeTab === 'overview' && (
          <div className="space-y-6 text-sm text-[#2C2A2A]">
            <h3 className="text-xl font-serif font-medium border-b border-[#EAE1D2] pb-2">Comprehensive Client Chart Overview</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 1. Identification & Demographics */}
              <div className="bg-[#F7F2E9] p-5 rounded-xl border border-[#EAE1D2] space-y-2">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741] mb-3">1. Legal Demographics</h4>
                <p><strong>Legal Name:</strong> {client.legalLastName}, {client.legalFirstName} {client.legalMiddleName || ''}</p>
                <p><strong>Preferred Name:</strong> {client.preferredName || 'Same as legal name'}</p>
                <p><strong>Pronouns:</strong> {client.pronouns || 'Not specified'}</p>
                <p><strong>Date of Birth:</strong> {client.dob || 'Not provided'}</p>
                <p><strong>System UID:</strong> <code className="text-xs bg-white px-2 py-0.5 rounded border border-[#EAE1D2]">{client.uid}</code></p>
              </div>

              {/* 2. Contact & Address */}
              <div className="bg-[#F7F2E9] p-5 rounded-xl border border-[#EAE1D2] space-y-2">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741] mb-3">2. Contact Information</h4>
                <p><strong>Email Address:</strong> {client.email}</p>
                <p><strong>Primary Phone:</strong> {client.primaryPhone || 'N/A'}</p>
                <p><strong>Alternate Phone:</strong> {client.alternatePhone || 'N/A'}</p>
                <p><strong>Preferred Contact Method:</strong> <span className="capitalize">{client.preferredContactMethod || 'Email'}</span></p>
                <p><strong>Address:</strong> {client.address ? `${client.address.street} ${client.address.unit ? `#${client.address.unit}` : ''}, ${client.address.city}, ${client.address.state} ${client.address.zip}` : 'No address on file'}</p>
              </div>

              {/* 3. Emergency Contact & Primary Care */}
              <div className="bg-[#F7F2E9] p-5 rounded-xl border border-[#EAE1D2] space-y-2">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741] mb-3">3. Emergency Contact & PCP</h4>
                <p><strong>Emergency Contact Name:</strong> {client.emergencyContact?.name || 'None provided'}</p>
                <p><strong>Relationship:</strong> {client.emergencyContact?.relationship || 'N/A'}</p>
                <p><strong>Emergency Phone:</strong> {client.emergencyContact?.phone || 'N/A'}</p>
                <p className="pt-1"><strong>Primary Care Physician (PCP):</strong> {client.primaryCareProvider || 'None listed'}</p>
                <p><strong>Preferred Pharmacy:</strong> {client.preferredPharmacy || 'None listed'}</p>
                <p><strong>Referral Source:</strong> {client.referralSource || 'Not specified'}</p>
              </div>

              {/* 4. Service Preferences & Insurance */}
              <div className="bg-[#F7F2E9] p-5 rounded-xl border border-[#EAE1D2] space-y-2">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741] mb-3">4. Insurance & Format Preferences</h4>
                <p><strong>Preferred Service Format:</strong> <span className="capitalize font-semibold text-[#BF5B33]">{client.preferredFormat || 'telehealth'}</span></p>
                <p><strong>Insurance Provider:</strong> {client.insuranceInfo?.provider || 'Self-Pay / Cash'}</p>
                <p><strong>Policy Number:</strong> {client.insuranceInfo?.policyNumber || 'N/A'}</p>
                <p><strong>Group Number:</strong> {client.insuranceInfo?.groupNumber || 'N/A'}</p>
                <p><strong>Subscriber Name:</strong> {client.insuranceInfo?.subscriberName || 'Self'}</p>
                <p><strong>Subscriber Relationship:</strong> {client.insuranceInfo?.subscriberRelationship || 'Self'}</p>
              </div>
            </div>

            {/* 5. ACCESSIBILITY & ACCOMMODATION REQUESTS */}
            <div className="bg-amber-50/80 border border-amber-200 p-5 rounded-xl space-y-2">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-amber-900 flex items-center gap-2">
                ♿ Accessibility & Accommodation Requests
              </h4>
              {client.accessibilityRequests ? (
                <p className="text-sm text-amber-950 whitespace-pre-wrap bg-white p-3 rounded-lg border border-amber-200 font-medium">
                  {client.accessibilityRequests}
                </p>
              ) : (
                <p className="text-xs text-amber-800/80 italic">
                  No special accessibility or accommodation requests submitted by client.
                </p>
              )}
            </div>

            {/* 6. Communication Consents & Signed Documents Summary */}
            <div className="bg-[#F7F2E9]/70 p-5 rounded-xl border border-[#EAE1D2] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741]">Client Communication & Signed Consent Summary</h4>
                <span className="text-xs font-semibold px-3 py-1 bg-white rounded-full border border-[#EAE1D2] text-[#4A5741]">
                  {signedDocs.length} E-Signed Agreements On File
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-white p-3 rounded-lg border border-[#EAE1D2] flex flex-col justify-between">
                  <span className="font-medium text-[#2C2A2A]/80">Email Notifications</span>
                  <span className={`mt-2 inline-block px-2.5 py-1 text-[11px] font-semibold rounded-full w-fit ${
                    client.communicationConsent?.emailConsent !== false ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-50 text-amber-800 border border-amber-300'
                  }`}>
                    {client.communicationConsent?.emailConsent !== false ? '✓ Approved' : '✗ Not Approved'}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-[#EAE1D2] flex flex-col justify-between">
                  <span className="font-medium text-[#2C2A2A]/80">SMS Reminders</span>
                  <span className={`mt-2 inline-block px-2.5 py-1 text-[11px] font-semibold rounded-full w-fit ${
                    client.communicationConsent?.smsConsent ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-50 text-amber-800 border border-amber-300'
                  }`}>
                    {client.communicationConsent?.smsConsent ? '✓ Approved' : '✗ Not Approved'}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-[#EAE1D2] flex flex-col justify-between">
                  <span className="font-medium text-[#2C2A2A]/80">Confidential Voicemail</span>
                  <span className={`mt-2 inline-block px-2.5 py-1 text-[11px] font-semibold rounded-full w-fit ${
                    client.communicationConsent?.voicemailConsent !== false ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-50 text-amber-800 border border-amber-300'
                  }`}>
                    {client.communicationConsent?.voicemailConsent !== false ? '✓ Approved' : '✗ Not Approved'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* INTAKE PACKET TAB (FULL ADMIN VIEWER & REVIEWER) */}
        {activeTab === 'intake' && (
          <div className="space-y-6 text-sm text-[#2C2A2A]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EAE1D2] pb-4 gap-2">
              <div>
                <h3 className="text-xl font-serif font-medium">Initial Client Intake Questionnaire Packet</h3>
                <p className="text-xs text-[#2C2A2A]/70 mt-0.5">
                  Review submitted clinical background, symptoms, treatment history, and safety screening.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase border ${
                  intakeData?.status === 'submitted' || intakeData?.status === 'approved'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : intakeData?.status === 'revision_requested'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-gray-100 text-gray-700 border-gray-300'
                }`}>
                  Status: {intakeData?.status ? intakeData.status.replace('_', ' ') : client.intakeStatus}
                </span>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-[#4A5741] text-white text-xs font-semibold rounded-xl shadow-sm hover:bg-[#384232] transition"
                >
                  🖨️ Print Intake Packet
                </button>
              </div>
            </div>

            {!intakeData || (!intakeData.reasonForTherapy && client.intakeStatus === 'not_started') ? (
              <div className="bg-[#F7F2E9] border border-[#EAE1D2] rounded-xl p-8 text-center">
                <p className="text-xs font-semibold text-[#2C2A2A]/70">No submitted intake questionnaire packet found for this client yet.</p>
                <p className="text-[11px] text-[#2C2A2A]/50 mt-1">Client intake status: Not Started.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Therapist Review Controls Banner */}
                <div className="bg-[#F7F2E9] p-5 rounded-2xl border border-[#EAE1D2] space-y-4 no-print print:hidden">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741]">Therapist Intake Packet Review Actions</h4>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => handleReviewStatus('approved')}
                      disabled={reviewingIntake}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
                    >
                      ✓ Approve Intake Packet
                    </button>
                    <button
                      onClick={() => setShowRevisionForm(!showRevisionForm)}
                      disabled={reviewingIntake}
                      className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
                    >
                      ✏️ Request Corrections / Revisions
                    </button>
                  </div>

                  {showRevisionForm && (
                    <div className="space-y-3 pt-3 border-t border-[#EAE1D2]">
                      <label className="block text-xs font-semibold text-[#2C2A2A]">Enter Correction Notes for Client:</label>
                      <textarea
                        rows={3}
                        value={revisionNotesInput}
                        onChange={(e) => setRevisionNotesInput(e.target.value)}
                        className="w-full p-3 rounded-xl border border-[#EAE1D2] bg-white text-xs focus:ring-2 focus:ring-[#BF5B33] outline-none"
                        placeholder="Specify which section needs clarification or additional details..."
                      />
                      <button
                        onClick={() => handleReviewStatus('revision_requested')}
                        disabled={reviewingIntake || !revisionNotesInput.trim()}
                        className="px-4 py-2 bg-amber-800 text-white text-xs font-semibold rounded-xl disabled:opacity-50"
                      >
                        Send Revision Request to Client
                      </button>
                    </div>
                  )}
                </div>

                {/* Section 1: Reasons & Goals */}
                <div className="bg-white border border-[#EAE1D2] rounded-xl p-5 space-y-4">
                  <h4 className="font-serif text-lg font-medium border-b border-[#EAE1D2] pb-2">Section 1: Reason for Therapy & Goals</h4>
                  <div>
                    <p className="text-xs font-semibold text-[#4A5741] uppercase">What brings client to therapy:</p>
                    <p className="mt-1 bg-[#F7F2E9] p-3 rounded-lg border border-[#EAE1D2] whitespace-pre-wrap">{intakeData.reasonForTherapy || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#4A5741] uppercase">Current Symptoms & Concerns:</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {intakeData.currentSymptoms && intakeData.currentSymptoms.length > 0 ? (
                        intakeData.currentSymptoms.map((sym) => (
                          <span key={sym} className="px-3 py-1 bg-[#4A5741]/10 text-[#4A5741] rounded-full text-xs font-semibold border border-[#4A5741]/20">
                            {sym}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs italic text-[#2C2A2A]/60">None selected</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#4A5741] uppercase">Primary Therapy Goals:</p>
                    <p className="mt-1 bg-[#F7F2E9] p-3 rounded-lg border border-[#EAE1D2] whitespace-pre-wrap">{intakeData.therapyGoals || 'N/A'}</p>
                  </div>
                </div>

                {/* Section 2: Medical & Counseling History */}
                <div className="bg-white border border-[#EAE1D2] rounded-xl p-5 space-y-4">
                  <h4 className="font-serif text-lg font-medium border-b border-[#EAE1D2] pb-2">Section 2: Treatment & Medical History</h4>
                  <p><strong>Previous Counseling:</strong> {intakeData.previousCounseling ? 'Yes' : 'No'}</p>
                  {intakeData.previousCounselingDetails && (
                    <p className="bg-[#F7F2E9] p-3 rounded-lg border border-[#EAE1D2]"><strong>Details:</strong> {intakeData.previousCounselingDetails}</p>
                  )}
                  <p><strong>Current Medications:</strong> {intakeData.currentMedications || 'None listed'}</p>
                  <p><strong>Relevant Medical Conditions:</strong> {intakeData.medicalHistoryNotes || 'None listed'}</p>
                </div>

                {/* Section 3: Social History & Safety Screening */}
                <div className="bg-white border border-[#EAE1D2] rounded-xl p-5 space-y-4">
                  <h4 className="font-serif text-lg font-medium border-b border-[#EAE1D2] pb-2">Section 3: Social History & Safety Screening</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <p><strong>Relationship Status:</strong> {intakeData.relationshipStatus || 'N/A'}</p>
                    <p><strong>Employment / School:</strong> {intakeData.employmentOrSchool || 'N/A'}</p>
                  </div>
                  {intakeData.safetyScreeningAnswers && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs text-amber-950">
                      <p className="font-semibold uppercase tracking-wider text-amber-900">Safety Screening Answers:</p>
                      <p>• Suicidal Ideation in Past Month: <strong>{intakeData.safetyScreeningAnswers.suicidalIdeationPastMonth ? 'YES (High Priority Risk Flag)' : 'No'}</strong></p>
                      <p>• History of Self-Harm: <strong>{intakeData.safetyScreeningAnswers.selfHarmHistory ? 'YES' : 'No'}</strong></p>
                      {intakeData.safetyScreeningAnswers.safetyDetails && (
                        <p className="pt-1"><strong>Details:</strong> {intakeData.safetyScreeningAnswers.safetyDetails}</p>
                      )}
                    </div>
                  )}
                  {intakeData.additionalNotes && (
                    <div>
                      <p className="text-xs font-semibold text-[#4A5741] uppercase">Additional Notes from Client:</p>
                      <p className="mt-1 bg-[#F7F2E9] p-3 rounded-lg border border-[#EAE1D2] whitespace-pre-wrap">{intakeData.additionalNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* SIGNED CONSENT DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div className="space-y-6 text-sm text-[#2C2A2A]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EAE1D2] pb-4 gap-2">
              <div>
                <h3 className="text-xl font-serif font-medium">Practice Consent Forms & Signed Agreements</h3>
                <p className="text-xs text-[#2C2A2A]/70 mt-0.5">
                  Immutably archived legal agreements e-signed by {client.legalFirstName} {client.legalLastName}.
                </p>
              </div>
              <button
                onClick={refreshSignedDocs}
                disabled={loadingDocs}
                className="px-3 py-1.5 bg-[#F7F2E9] hover:bg-[#EAE1D2] text-[#4A5741] text-xs font-semibold rounded-xl border border-[#EAE1D2] transition w-fit"
              >
                {loadingDocs ? 'Refreshing...' : '🔄 Refresh Signed Docs'}
              </button>
            </div>

            {signedDocs.length === 0 ? (
              <div className="bg-[#F7F2E9] border border-[#EAE1D2] rounded-xl p-8 text-center">
                <p className="text-xs font-semibold text-[#2C2A2A]/70">No e-signed consent agreements found for this client yet.</p>
                <p className="text-[11px] text-[#2C2A2A]/50 mt-1">
                  Required documents: Informed Consent for Psychotherapy, Telehealth Consent, Financial Responsibility Agreement.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* List of Signed Documents */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-[#4A5741]">Submitted Agreements</h4>
                  {signedDocs.map((doc) => {
                    const isSelected = selectedDoc?.id === doc.id;
                    return (
                      <button
                        key={doc.id || doc.documentHash}
                        onClick={() => setSelectedDoc(doc)}
                        className={`w-full text-left p-4 rounded-xl border text-xs transition flex flex-col gap-1 ${
                          isSelected
                            ? 'bg-[#4A5741] text-white border-[#4A5741] shadow-sm'
                            : 'bg-[#F7F2E9] text-[#2C2A2A] border-[#EAE1D2] hover:bg-[#EAE1D2]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{doc.documentTitle}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                            ✓ Signed
                          </span>
                        </div>
                        <p className={`text-[11px] ${isSelected ? 'text-white/80' : 'text-[#2C2A2A]/60'}`}>
                          Version: {doc.templateVersion} | Signed by: {doc.clientTypedName}
                        </p>
                        <p className={`text-[10px] font-mono ${isSelected ? 'text-white/70' : 'text-[#2C2A2A]/50'}`}>
                          Hash: {doc.documentHash.substring(0, 20)}...
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Detailed Signed Document Viewer */}
                <div className="md:col-span-2">
                  {selectedDoc ? (
                    <div className="bg-[#F7F2E9]/60 border border-[#EAE1D2] rounded-2xl p-6 space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EAE1D2] pb-3 gap-2">
                        <div>
                          <h4 className="text-lg font-serif font-medium text-[#2C2A2A]">{selectedDoc.documentTitle}</h4>
                          <p className="text-xs text-[#4A5741]">Version {selectedDoc.templateVersion} • Legal Agreement</p>
                        </div>
                        <button
                          onClick={() => window.print()}
                          className="px-3.5 py-1.5 bg-[#4A5741] hover:bg-[#384232] text-white text-xs font-semibold rounded-xl shadow-sm transition w-fit"
                        >
                          🖨️ Print / Save Legal PDF Copy
                        </button>
                      </div>

                      {/* Metadata Box */}
                      <div className="bg-white p-4 rounded-xl border border-[#EAE1D2] space-y-1.5 text-xs">
                        <p><strong>Signer Legal Name:</strong> {selectedDoc.clientTypedName}</p>
                        <p><strong>Signed Timestamp (ISO):</strong> {selectedDoc.signedAtISO}</p>
                        <p><strong>Unique Immutable Audit Hash:</strong> <code className="bg-[#F7F2E9] px-2 py-0.5 rounded border border-[#EAE1D2] font-mono text-[11px]">{selectedDoc.documentHash}</code></p>
                      </div>

                      {/* Drawn Signature Canvas Image (If available) */}
                      {selectedDoc.signatureDataUrl && (
                        <div className="bg-white p-4 rounded-xl border border-[#EAE1D2] space-y-2">
                          <p className="text-xs font-semibold text-[#4A5741] uppercase tracking-wider">Client Drawn Signature Image:</p>
                          <img
                            src={selectedDoc.signatureDataUrl}
                            alt="Drawn Signature"
                            className="h-20 bg-[#F7F2E9] rounded-lg border border-[#EAE1D2] p-2 object-contain"
                          />
                        </div>
                      )}

                      {/* Exact Text Snapshot Frozen at Signing Time */}
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-[#4A5741] uppercase tracking-wider">Frozen Legal Text Snapshot:</p>
                        <div className="bg-white border border-[#EAE1D2] rounded-xl p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto text-[#2C2A2A]">
                          {selectedDoc.exactTextSnapshot}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-[#2C2A2A]/60">Select a signed document from the list to view its complete audit snapshot.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="text-sm text-[#2C2A2A] space-y-6">
            <h3 className="text-xl font-serif font-medium border-b border-[#EAE1D2] pb-2">Contact Details & Communication Preferences</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#F7F2E9] p-5 rounded-xl border border-[#EAE1D2] space-y-2">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741] mb-2">Phone & Email</h4>
                <p><strong>Primary Phone:</strong> {client.primaryPhone || 'N/A'}</p>
                <p><strong>Alternate Phone:</strong> {client.alternatePhone || 'N/A'}</p>
                <p><strong>Email Address:</strong> {client.email}</p>
                <p><strong>Preferred Contact Method:</strong> <span className="capitalize">{client.preferredContactMethod || 'Email'}</span></p>
              </div>

              <div className="bg-[#F7F2E9] p-5 rounded-xl border border-[#EAE1D2] space-y-2">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741] mb-2">Physical Address</h4>
                <p><strong>Street:</strong> {client.address?.street || 'Not provided'}</p>
                <p><strong>Unit/Apt:</strong> {client.address?.unit || 'N/A'}</p>
                <p><strong>City, State Zip:</strong> {client.address ? `${client.address.city}, ${client.address.state} ${client.address.zip}` : 'N/A'}</p>
              </div>
            </div>

            <div className="bg-amber-50/80 border border-amber-200 p-5 rounded-xl space-y-2">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-amber-900">
                ♿ Accessibility & Accommodation Requests
              </h4>
              <p className="text-sm text-amber-950 font-medium">
                {client.accessibilityRequests || 'No special accommodations requested.'}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div className="space-y-6 text-sm text-[#2C2A2A]">
            <h3 className="text-xl font-serif font-medium border-b border-[#EAE1D2] pb-2">Uploaded Insurance Cards & Client Documents</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Front Card */}
              <div className="bg-[#F7F2E9] p-5 rounded-xl border border-[#EAE1D2] text-center">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741] mb-3">Insurance Card (Front)</h4>
                {client.insuranceCardFrontPath ? (
                  <div className="space-y-3">
                    <img src={client.insuranceCardFrontPath} alt="Insurance Card Front" className="max-h-56 mx-auto rounded-lg border border-[#EAE1D2] object-cover shadow-sm bg-white" />
                    <div className="flex items-center justify-center gap-3">
                      <a href={client.insuranceCardFrontPath} target="_blank" rel="noopener noreferrer" className="inline-block px-3.5 py-1.5 bg-[#4A5741] hover:bg-[#384232] text-white text-xs rounded-lg font-medium shadow-sm transition">
                        📥 Download / View File ↗
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#2C2A2A]/60 italic py-8">No front insurance card uploaded by client yet.</p>
                )}
              </div>

              {/* Back Card */}
              <div className="bg-[#F7F2E9] p-5 rounded-xl border border-[#EAE1D2] text-center">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-[#4A5741] mb-3">Insurance Card (Back)</h4>
                {client.insuranceCardBackPath ? (
                  <div className="space-y-3">
                    <img src={client.insuranceCardBackPath} alt="Insurance Card Back" className="max-h-56 mx-auto rounded-lg border border-[#EAE1D2] object-cover shadow-sm bg-white" />
                    <div className="flex items-center justify-center gap-3">
                      <a href={client.insuranceCardBackPath} target="_blank" rel="noopener noreferrer" className="inline-block px-3.5 py-1.5 bg-[#4A5741] hover:bg-[#384232] text-white text-xs rounded-lg font-medium shadow-sm transition">
                        📥 Download / View File ↗
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#2C2A2A]/60 italic py-8">No back insurance card uploaded by client yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'private-clinical-notes' && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold">
              🔒 <strong>PRIVATE CLINICAL NOTES SECTION:</strong> Protected health information in this tab is strictly prohibited from client access.
            </div>
            <p className="text-xs text-[#2C2A2A]/70">DAP / SOAP Clinical Notes Editor initialized for staff documentation.</p>
          </div>
        )}

        {activeTab !== 'overview' && activeTab !== 'contact' && activeTab !== 'files' && activeTab !== 'documents' && activeTab !== 'intake' && activeTab !== 'private-clinical-notes' && (
          <div className="text-xs text-[#2C2A2A]/70">
            Active chart tab: <strong className="capitalize">{activeTab.replace('-', ' ')}</strong>. Functional module binder active.
          </div>
        )}
      </div>
    </div>
  );
};
