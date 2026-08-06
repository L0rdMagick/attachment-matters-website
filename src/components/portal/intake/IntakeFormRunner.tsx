import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getIntakeSubmission, saveIntakeSubmission } from '../../../lib/firebase/intake';
import type { IntakeSubmissionData } from '../../../types/intake';

export const IntakeFormRunner: React.FC = () => {
  const { user, profile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [revisionNotes, setRevisionNotes] = useState<string | null>(null);

  // Form states
  const [reasonForTherapy, setReasonForTherapy] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [therapyGoals, setTherapyGoals] = useState('');

  const [previousCounseling, setPreviousCounseling] = useState(false);
  const [previousCounselingDetails, setPreviousCounselingDetails] = useState('');
  const [medicalHistoryNotes, setMedicalHistoryNotes] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');
  const [currentProviders, setCurrentProviders] = useState('');

  const [familySocialHistory, setFamilySocialHistory] = useState('');
  const [relationshipStatus, setRelationshipStatus] = useState('');
  const [employmentOrSchool, setEmploymentOrSchool] = useState('');
  const [substanceUseQuestions, setSubstanceUseQuestions] = useState('');

  const [suicidalIdeation, setSuicidalIdeation] = useState(false);
  const [selfHarm, setSelfHarm] = useState(false);
  const [safetyDetails, setSafetyDetails] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');

  const clientName = profile?.legalFirstName ? `${profile.legalFirstName} ${profile.legalLastName || ''}`.trim() : user?.email || 'Client';
  const clientEmail = user?.email || 'N/A';

  const symptomOptions = [
    'Anxiety / Panic',
    'Depression / Sadness',
    'Trauma / PTSD Symptoms',
    'Relationship Difficulties',
    'Stress / Burnout',
    'Grief / Loss',
    'Sleep Disturbance',
    'Self-Esteem Concerns'
  ];

  useEffect(() => {
    if (!user) return;
    async function loadIntake() {
      try {
        const data = await getIntakeSubmission(user!.uid);
        if (data) {
          if (data.status === 'submitted' || data.status === 'approved') {
            setSubmitted(true);
          }
          if (data.status === 'revision_requested') {
            setRevisionNotes(data.revisionNotes || 'Your therapist has requested corrections to your intake form.');
          }

          setReasonForTherapy(data.reasonForTherapy || '');
          setSelectedSymptoms(data.currentSymptoms || []);
          setTherapyGoals(data.therapyGoals || '');

          setPreviousCounseling(data.previousCounseling || false);
          setPreviousCounselingDetails(data.previousCounselingDetails || '');
          setMedicalHistoryNotes(data.medicalHistoryNotes || '');
          setCurrentMedications(data.currentMedications || '');
          setCurrentProviders(data.currentProviders || '');

          setFamilySocialHistory(data.familySocialHistory || '');
          setRelationshipStatus(data.relationshipStatus || '');
          setEmploymentOrSchool(data.employmentOrSchool || '');
          setSubstanceUseQuestions(data.substanceUseQuestions || '');

          if (data.safetyScreeningAnswers) {
            setSuicidalIdeation(data.safetyScreeningAnswers.suicidalIdeationPastMonth);
            setSelfHarm(data.safetyScreeningAnswers.selfHarmHistory);
            setSafetyDetails(data.safetyScreeningAnswers.safetyDetails || '');
          }

          setAdditionalNotes(data.additionalNotes || '');
        }
      } catch (err) {
        console.error("Failed to load intake submission", err);
      } finally {
        setLoading(false);
      }
    }
    loadIntake();
  }, [user]);

  const toggleSymptom = (sym: string) => {
    if (selectedSymptoms.includes(sym)) {
      setSelectedSymptoms(selectedSymptoms.filter((s) => s !== sym));
    } else {
      setSelectedSymptoms([...selectedSymptoms, sym]);
    }
  };

  const getFormData = (): Partial<IntakeSubmissionData> => ({
    reasonForTherapy,
    currentSymptoms: selectedSymptoms,
    therapyGoals,
    previousCounseling,
    previousCounselingDetails,
    medicalHistoryNotes,
    currentMedications,
    currentProviders,
    familySocialHistory,
    relationshipStatus,
    employmentOrSchool,
    substanceUseQuestions,
    safetyScreeningAnswers: {
      suicidalIdeationPastMonth: suicidalIdeation,
      selfHarmHistory: selfHarm,
      safetyDetails
    },
    additionalNotes
  });

  const handleSaveDraft = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await saveIntakeSubmission(user.uid, getFormData(), false);
      alert("Draft saved successfully! You can return to complete this form at any time.");
    } catch (err) {
      console.error("Failed to save draft", err);
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitFinal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!reasonForTherapy.trim()) {
      alert("Please fill out what brings you to therapy in Step 1.");
      setStep(1);
      return;
    }

    if (!therapyGoals.trim()) {
      alert("Please fill out your therapy goals in Step 1.");
      setStep(1);
      return;
    }

    setSaving(true);
    try {
      await saveIntakeSubmission(user.uid, getFormData(), true);
      setSubmitted(true);
    } catch (err: any) {
      console.error("Failed to submit intake", err);
      alert(`Failed to submit intake form: ${err.message || 'Please check your information and try again.'}`);
    } finally {
      setSaving(false);
    }
  };

  const renderPrintableDocument = () => (
    <div className="bg-white border-2 border-gray-900 rounded-none p-8 sm:p-12 shadow-none space-y-6 font-sans text-gray-900 print:border-none print:shadow-none print:p-0 print:m-0 print-card">
      {/* Official Practice Letterhead & Document Header */}
      <div className="border-b-2 border-gray-900 pb-4 space-y-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-gray-900 uppercase">
              FAMILY TRUST THERAPY & CLINICAL SERVICES
            </h1>
            <p className="text-xs text-gray-700 font-medium">
              Attachment Matters, LLC • Durango, CO 81301 • Tel: (505) 920-6351 • Email: info@familytrusttherapy.com
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="inline-block px-3 py-1 bg-gray-100 border border-gray-900 text-[11px] font-bold tracking-widest uppercase">
              OFFICIAL CLINICAL & LEGAL RECORD
            </span>
          </div>
        </div>
        <div className="pt-2 text-center border-t border-gray-300">
          <h2 className="text-lg font-serif font-bold tracking-wide uppercase text-gray-900">
            CLIENT INITIAL CLINICAL INTAKE QUESTIONNAIRE
          </h2>
        </div>
      </div>

      {/* Official Document Metadata Control Box */}
      <div className="border border-gray-900 p-4 bg-gray-50/50 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-sans">
        <div>
          <span className="block font-bold uppercase tracking-wider text-gray-600 text-[10px]">Client Legal Name</span>
          <span className="font-semibold text-sm text-gray-900">{clientName}</span>
        </div>
        <div>
          <span className="block font-bold uppercase tracking-wider text-gray-600 text-[10px]">Client Account Email</span>
          <span className="font-semibold text-gray-900">{clientEmail}</span>
        </div>
        <div>
          <span className="block font-bold uppercase tracking-wider text-gray-600 text-[10px]">Document Record Date</span>
          <span className="font-semibold text-gray-900">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        <div>
          <span className="block font-bold uppercase tracking-wider text-gray-600 text-[10px]">Submission Status</span>
          <span className="font-bold text-gray-900 uppercase">{submitted ? 'VERIFIED SUBMISSION' : 'CLIENT DRAFT RECORD'}</span>
        </div>
      </div>

      {/* Section 1 */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest bg-gray-100 p-2 border-l-4 border-gray-900">
          SECTION 1: REASON FOR SEEKING CLINICAL TREATMENT & GOALS
        </h3>
        
        <div className="space-y-1">
          <p className="text-xs font-bold text-gray-800 uppercase">1.1 Primary Reason for Therapy Presentation:</p>
          <div className="p-3 border border-gray-400 text-xs leading-relaxed min-h-[60px] whitespace-pre-wrap">
            {reasonForTherapy.trim() || <span className="italic text-gray-500">[No clinical response recorded]</span>}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-bold text-gray-800 uppercase">1.2 Reported Symptoms & Presenting Concerns:</p>
          <div className="p-3 border border-gray-400 text-xs">
            {selectedSymptoms.length > 0 ? (
              <p className="font-medium text-gray-900">{selectedSymptoms.join(' • ')}</p>
            ) : (
              <span className="italic text-gray-500">[No specific symptom categories checked]</span>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-bold text-gray-800 uppercase">1.3 Primary Treatment Goals & Desired Outcomes:</p>
          <div className="p-3 border border-gray-400 text-xs leading-relaxed min-h-[50px] whitespace-pre-wrap">
            {therapyGoals.trim() || <span className="italic text-gray-500">[No treatment goals recorded]</span>}
          </div>
        </div>
      </div>

      {/* Section 2 */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest bg-gray-100 p-2 border-l-4 border-gray-900">
          SECTION 2: TREATMENT & MEDICAL HISTORY
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 border border-gray-400 space-y-1">
            <p className="font-bold uppercase text-gray-800">2.1 Prior Psychotherapy / Counseling History:</p>
            <p className="font-medium">Prior Treatment Attended: <strong>{previousCounseling ? 'YES' : 'NO'}</strong></p>
            {previousCounseling && previousCounselingDetails && (
              <p className="pt-1 border-t border-gray-300 text-gray-800">
                <strong>Details:</strong> {previousCounselingDetails}
              </p>
            )}
          </div>

          <div className="p-3 border border-gray-400 space-y-1">
            <p className="font-bold uppercase text-gray-800">2.2 Current Prescription / OTC Medications:</p>
            <p className="whitespace-pre-wrap">{currentMedications.trim() || <span className="italic text-gray-500">[None listed]</span>}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 border border-gray-400 space-y-1">
            <p className="font-bold uppercase text-gray-800">2.3 Relevant Medical Conditions / History:</p>
            <p className="whitespace-pre-wrap">{medicalHistoryNotes.trim() || <span className="italic text-gray-500">[None listed]</span>}</p>
          </div>

          <div className="p-3 border border-gray-400 space-y-1">
            <p className="font-bold uppercase text-gray-800">2.4 Current Healthcare / Medical Providers:</p>
            <p className="whitespace-pre-wrap">{currentProviders.trim() || <span className="italic text-gray-500">[None listed]</span>}</p>
          </div>
        </div>
      </div>

      {/* Section 3 */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest bg-gray-100 p-2 border-l-4 border-gray-900">
          SECTION 3: SOCIAL HISTORY, SAFETY ASSESSMENT & ADDITIONAL NOTES
        </h3>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 border border-gray-400">
            <span className="font-bold uppercase text-gray-800">Relationship Status: </span>
            <span className="font-semibold">{relationshipStatus.trim() || 'Not specified'}</span>
          </div>
          <div className="p-3 border border-gray-400">
            <span className="font-bold uppercase text-gray-800">Employment / Schooling: </span>
            <span className="font-semibold">{employmentOrSchool.trim() || 'Not specified'}</span>
          </div>
        </div>

        {(familySocialHistory || substanceUseQuestions) && (
          <div className="space-y-2 text-xs">
            {familySocialHistory && (
              <div className="p-3 border border-gray-400">
                <p className="font-bold uppercase text-gray-800">Family & Social History:</p>
                <p className="whitespace-pre-wrap mt-1">{familySocialHistory}</p>
              </div>
            )}
            {substanceUseQuestions && (
              <div className="p-3 border border-gray-400">
                <p className="font-bold uppercase text-gray-800">Substance Use Background:</p>
                <p className="whitespace-pre-wrap mt-1">{substanceUseQuestions}</p>
              </div>
            )}
          </div>
        )}

        <div className="p-3 border border-gray-900 bg-gray-50 text-xs space-y-1">
          <p className="font-bold uppercase tracking-wider text-gray-900">3.1 Safety Screening Assessment Record:</p>
          <p>• Suicidal Ideation Reported in Past Month: <strong>{suicidalIdeation ? 'YES (HIGH PRIORITY CLINICAL FLAG)' : 'NO'}</strong></p>
          <p>• Self-Harm History Reported: <strong>{selfHarm ? 'YES' : 'NO'}</strong></p>
          {safetyDetails && (
            <p className="pt-1 border-t border-gray-300"><strong>Safety Assessment Details:</strong> {safetyDetails}</p>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-bold text-gray-800 uppercase">3.2 Additional Client Disclosures & Notes:</p>
          <div className="p-3 border border-gray-400 text-xs min-h-[40px] whitespace-pre-wrap">
            {additionalNotes.trim() || <span className="italic text-gray-500">[No additional notes recorded]</span>}
          </div>
        </div>
      </div>

      {/* FORMAL LEGAL & CLINICAL ATTESTATION BLOCK */}
      <div className="pt-6 border-t-2 border-gray-900 space-y-6 break-inside-avoid page-break-inside-avoid">
        <div className="p-4 border border-gray-900 bg-gray-50 text-xs space-y-2">
          <h4 className="font-bold uppercase tracking-wider text-gray-900">LEGAL & CLINICAL ATTESTATION STATEMENT</h4>
          <p className="text-gray-800 leading-relaxed italic">
            "I, the undersigned client (or legal parent/guardian), hereby declare and attest under penalty of perjury and misrepresentation that all information, clinical history, and disclosures provided in this Initial Intake Questionnaire are true, accurate, and complete to the best of my knowledge. I acknowledge that this completed record forms a legal and clinical component of my permanent healthcare file with Family Trust Therapy."
          </p>
        </div>

        {/* DUAL PHYSICAL SIGNATURE LINES */}
        <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs font-sans">
          {/* Client / Guardian Signature */}
          <div className="space-y-6">
            <div className="border-b-2 border-gray-900 pb-1">
              <span className="block text-[10px] uppercase font-bold text-gray-600">Client / Parent / Legal Guardian Physical Signature</span>
              <div className="h-8 flex items-end">
                <span className="font-serif italic text-sm text-gray-900">{clientName}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 border-b border-gray-400 pb-1">
                <span className="block text-[10px] uppercase text-gray-600">Printed Legal Name</span>
                <span className="font-semibold text-gray-900">{clientName}</span>
              </div>
              <div className="border-b border-gray-400 pb-1">
                <span className="block text-[10px] uppercase text-gray-600">Date Signed</span>
                <span className="font-semibold text-gray-900">{new Date().toLocaleDateString('en-US')}</span>
              </div>
            </div>
          </div>

          {/* Clinician / Therapist Signature Block */}
          <div className="space-y-6">
            <div className="border-b-2 border-gray-900 pb-1">
              <span className="block text-[10px] uppercase font-bold text-gray-600">Licensed Therapist / Witness Signature</span>
              <div className="h-8"></div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 border-b border-gray-400 pb-1">
                <span className="block text-[10px] uppercase text-gray-600">Therapist Name & Credentials</span>
                <span className="text-gray-400 italic">[ Clinical Reviewer ]</span>
              </div>
              <div className="border-b border-gray-400 pb-1">
                <span className="block text-[10px] uppercase text-gray-600">Review Date</span>
                <span className="text-gray-400 italic">____/____/20__</span>
              </div>
            </div>
          </div>
        </div>

        {/* HIPAA & CONFIDENTIALITY FOOTNOTE */}
        <div className="pt-4 border-t border-gray-300 text-[10px] text-gray-600 text-center space-y-0.5 uppercase tracking-wider">
          <p className="font-bold">CONFIDENTIAL HEALTHCARE DOCUMENT • SUBJECT TO STATE & FEDERAL HIPAA PRIVACY LAWS</p>
          <p>Family Trust Therapy • Attachment Matters, LLC • Authorized Clinical & Legal Use Only</p>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl">Loading intake form...</div>;
  }

  if (submitted) {
    return (
      <div className="space-y-6 font-sans">
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-8 shadow-sm text-center space-y-4 no-print print:hidden">
          <div className="w-12 h-12 bg-[#4A5741]/10 text-[#4A5741] rounded-full flex items-center justify-center mx-auto text-xl font-bold">
            ✓
          </div>
          <h2 className="text-2xl font-serif text-[#2C2A2A] font-medium">Intake Form Submitted</h2>
          <p className="text-[#2C2A2A]/80 text-sm max-w-md mx-auto">
            Your client intake packet has been securely submitted and is currently being reviewed by your assigned therapist.
          </p>
          <div className="pt-4 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => window.print()}
              className="px-5 py-2.5 bg-[#4A5741] hover:bg-[#384232] text-white text-xs font-semibold rounded-xl transition shadow-sm flex items-center gap-2"
            >
              🖨️ Print Submission Copy / PDF
            </button>
            <button
              onClick={() => setSubmitted(false)}
              className="px-4 py-2.5 border border-[#BF5B33] text-[#BF5B33] text-xs font-semibold rounded-xl hover:bg-[#BF5B33]/5 transition"
            >
              ✏️ Edit / Update Form
            </button>
          </div>
        </div>

        {/* Formatted Printable Document View */}
        {renderPrintableDocument()}
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Interactive Form - Hidden when printing */}
      <div className="space-y-6 no-print print:hidden">
        {/* Header & Progress Indicator */}
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-serif text-[#2C2A2A] font-medium">Initial Client Intake Questionnaire</h2>
              <p className="text-xs text-[#2C2A2A]/70 mt-1">
                Please complete all sections to help your therapist prepare for your first session.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 border border-[#4A5741] text-[#4A5741] hover:bg-[#4A5741]/5 font-semibold text-xs rounded-xl transition"
              >
                🖨️ Print Form Preview
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving}
                className="px-4 py-2 bg-[#F7F2E9] hover:bg-[#EAE1D2] text-[#2C2A2A] font-semibold text-xs rounded-xl border border-[#EAE1D2] transition"
              >
                {saving ? 'Saving...' : '💾 Save & Continue Later'}
              </button>
            </div>
          </div>

          {revisionNotes && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs">
              <strong>Correction Requested by Therapist:</strong> {revisionNotes}
            </div>
          )}

          {/* Progress steps */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold border-t border-[#EAE1D2] pt-4">
            <button
              onClick={() => setStep(1)}
              className={`py-2 rounded-xl transition ${step === 1 ? 'bg-[#BF5B33] text-white' : 'bg-[#F7F2E9] text-[#2C2A2A]/70'}`}
            >
              Step 1: Reasons & Goals
            </button>
            <button
              onClick={() => setStep(2)}
              className={`py-2 rounded-xl transition ${step === 2 ? 'bg-[#BF5B33] text-white' : 'bg-[#F7F2E9] text-[#2C2A2A]/70'}`}
            >
              Step 2: Medical & History
            </button>
            <button
              onClick={() => setStep(3)}
              className={`py-2 rounded-xl transition ${step === 3 ? 'bg-[#BF5B33] text-white' : 'bg-[#F7F2E9] text-[#2C2A2A]/70'}`}
            >
              Step 3: History & Review
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmitFinal}>
          {/* Step 1 */}
          {step === 1 && (
            <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <h3 className="text-xl font-serif text-[#2C2A2A] font-medium border-b border-[#EAE1D2] pb-3">
                Section 1: Reason for Therapy & Primary Concerns
              </h3>

              <div>
                <label htmlFor="int-reason" className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-2">
                  What brings you to therapy at this time? <span className="text-[#BF5B33]">* Required</span>
                </label>
                <textarea
                  id="int-reason"
                  rows={4}
                  value={reasonForTherapy}
                  onChange={(e) => setReasonForTherapy(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#EAE1D2] text-sm focus:ring-2 focus:ring-[#BF5B33] outline-none"
                  placeholder="Describe what led you to seek counseling..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-2">
                  Current Concerns & Symptoms (Select all that apply)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {symptomOptions.map((sym) => {
                    const isChecked = selectedSymptoms.includes(sym);
                    return (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => toggleSymptom(sym)}
                        className={`p-3 text-xs rounded-xl border font-medium text-left transition ${
                          isChecked ? 'bg-[#4A5741] text-white border-[#4A5741]' : 'bg-[#F7F2E9] text-[#2C2A2A] border-[#EAE1D2]'
                        }`}
                      >
                        {isChecked ? '✓ ' : '+ '} {sym}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="int-goals" className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-2">
                  What are your main goals for therapy? <span className="text-[#BF5B33]">* Required</span>
                </label>
                <textarea
                  id="int-goals"
                  rows={3}
                  value={therapyGoals}
                  onChange={(e) => setTherapyGoals(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#EAE1D2] text-sm focus:ring-2 focus:ring-[#BF5B33] outline-none"
                  placeholder="What changes or outcomes would you like to see?"
                />
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="py-3 px-6 bg-[#BF5B33] text-white text-xs font-semibold rounded-xl hover:bg-[#a64e2b] transition"
                >
                  Next Step: Medical History →
                </button>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <h3 className="text-xl font-serif text-[#2C2A2A] font-medium border-b border-[#EAE1D2] pb-3">
                Section 2: Treatment & Medical History
              </h3>

              <div>
                <label className="flex items-center gap-3 text-sm text-[#2C2A2A]">
                  <input
                    type="checkbox"
                    checked={previousCounseling}
                    onChange={(e) => setPreviousCounseling(e.target.checked)}
                    className="w-4 h-4 text-[#BF5B33] rounded"
                  />
                  <span className="font-semibold">Have you previously attended counseling or therapy?</span>
                </label>
                {previousCounseling && (
                  <textarea
                    rows={2}
                    value={previousCounselingDetails}
                    onChange={(e) => setPreviousCounselingDetails(e.target.value)}
                    className="w-full mt-3 p-3 rounded-xl border border-[#EAE1D2] text-sm outline-none"
                    placeholder="When, for how long, and what was your experience?"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="int-meds" className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-2">
                    Current Medications & Dosages
                  </label>
                  <textarea
                    id="int-meds"
                    rows={3}
                    value={currentMedications}
                    onChange={(e) => setCurrentMedications(e.target.value)}
                    className="w-full p-3 rounded-xl border border-[#EAE1D2] text-sm outline-none"
                    placeholder="List any prescription or OTC medications..."
                  />
                </div>

                <div>
                  <label htmlFor="int-medhist" className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-2">
                    Relevant Medical Conditions
                  </label>
                  <textarea
                    id="int-medhist"
                    rows={3}
                    value={medicalHistoryNotes}
                    onChange={(e) => setMedicalHistoryNotes(e.target.value)}
                    className="w-full p-3 rounded-xl border border-[#EAE1D2] text-sm outline-none"
                    placeholder="Chronic illness, surgeries, sleep apnea, etc."
                  />
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="py-3 px-6 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-200 transition"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="py-3 px-6 bg-[#BF5B33] text-white text-xs font-semibold rounded-xl hover:bg-[#a64e2b] transition"
                >
                  Next Step: Safety & Final Review →
                </button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <h3 className="text-xl font-serif text-[#2C2A2A] font-medium border-b border-[#EAE1D2] pb-3">
                Section 3: Social History & Final Submission
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="int-rel" className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                    Relationship Status
                  </label>
                  <input
                    id="int-rel"
                    type="text"
                    value={relationshipStatus}
                    onChange={(e) => setRelationshipStatus(e.target.value)}
                    className="w-full p-3 rounded-xl border border-[#EAE1D2] text-sm outline-none"
                    placeholder="Single, Married, Partnered, Divorced, etc."
                  />
                </div>
                <div>
                  <label htmlFor="int-emp" className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                    Employment or School
                  </label>
                  <input
                    id="int-emp"
                    type="text"
                    value={employmentOrSchool}
                    onChange={(e) => setEmploymentOrSchool(e.target.value)}
                    className="w-full p-3 rounded-xl border border-[#EAE1D2] text-sm outline-none"
                    placeholder="Occupation / Student status"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="int-extra" className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                  Additional Information You Wish to Share
                </label>
                <textarea
                  id="int-extra"
                  rows={3}
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#EAE1D2] text-sm outline-none"
                  placeholder="Anything else you would like your therapist to know prior to your first session..."
                />
              </div>

              <div className="p-4 bg-[#F7F2E9] rounded-xl border border-[#EAE1D2] text-xs text-[#2C2A2A]">
                <strong>Submission Acknowledgment:</strong> By clicking "Submit Final Intake Packet", you confirm that the information provided is accurate to the best of your knowledge.
              </div>

              <div className="flex justify-between pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="py-3 px-6 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-200 transition"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="py-3.5 px-8 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
                >
                  {saving ? 'Submitting...' : 'Submit Final Intake Packet'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Hidden on screen, shown when printing draft */}
      <div className="hidden print:block">
        {renderPrintableDocument()}
      </div>
    </div>
  );
};
