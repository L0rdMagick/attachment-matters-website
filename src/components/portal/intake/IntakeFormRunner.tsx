import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getIntakeSubmission, saveIntakeSubmission } from '../../../lib/firebase/intake';
import type { IntakeSubmissionData } from '../../../types/intake';
import { PrintableIntakeDocument } from './PrintableIntakeDocument';
import { usePortalModal } from '../common/PortalModalContext';

export const IntakeFormRunner: React.FC = () => {
  const { user, profile } = useAuth();
  const { showAlert } = usePortalModal();
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
    'Depression / Low Mood',
    'Trauma / PTSD Symptoms',
    'Relational / Attachment Conflicts',
    'Family / Parenting Challenges',
    'Grief / Loss',
    'Emotional Regulation',
    'Stress / Burnout'
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
          if (data.status === 'revision_requested' && data.revisionNotes) {
            setRevisionNotes(data.revisionNotes);
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
      showAlert('💾 Draft Saved', 'Your intake draft has been saved. You can return to complete it at any time.', 'success', '💾');
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
      showAlert('⚠️ Section 1 Incomplete', 'Please describe your primary reason for seeking therapy in Step 1.', 'warning', '⚠️');
      setStep(1);
      return;
    }

    if (!therapyGoals.trim()) {
      showAlert('⚠️ Section 1 Incomplete', 'Please describe your goals for therapy in Step 1.', 'warning', '⚠️');
      setStep(1);
      return;
    }

    showConfirm({
      title: '📋 Submit Clinical Intake Packet',
      message: 'Are you ready to submit your completed initial clinical background and intake questionnaire to your therapist?',
      details: 'Once submitted, your responses will be securely archived in your clinical chart for therapist review.',
      icon: '📋',
      confirmText: 'Submit Intake Packet',
      cancelText: 'Review Responses',
      variant: 'info',
      onConfirm: async () => {
        setSaving(true);
        try {
          await saveIntakeSubmission(user.uid, getFormData(), true);
          setSubmitted(true);
          showAlert('✓ Packet Submitted', 'Your clinical intake packet has been securely submitted to your therapist.', 'success', '✓');
        } catch (err: any) {
          console.error("Failed to submit intake", err);
          showAlert('⚠️ Submission Error', err.message || 'Failed to submit intake packet. Please check your responses and try again.', 'danger', '⚠️');
        } finally {
          setSaving(false);
        }
      }
    });
  };

  const renderPrintableDocument = () => (
    <PrintableIntakeDocument
      clientName={clientName}
      clientEmail={clientEmail}
      reasonForTherapy={reasonForTherapy}
      selectedSymptoms={selectedSymptoms}
      therapyGoals={therapyGoals}
      previousCounseling={previousCounseling}
      previousCounselingDetails={previousCounselingDetails}
      currentMedications={currentMedications}
      medicalHistoryNotes={medicalHistoryNotes}
      currentProviders={currentProviders}
      relationshipStatus={relationshipStatus}
      employmentOrSchool={employmentOrSchool}
      familySocialHistory={familySocialHistory}
      substanceUseQuestions={substanceUseQuestions}
      suicidalIdeation={suicidalIdeation}
      selfHarm={selfHarm}
      safetyDetails={safetyDetails}
      additionalNotes={additionalNotes}
      status={submitted ? 'submitted' : 'draft'}
    />
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
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-serif text-[#2C2A2A] font-medium">Initial Client Intake Questionnaire</h2>
              <p className="text-xs text-[#2C2A2A]/70 mt-1">
                Please complete all sections to help your therapist prepare for your first session.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full sm:w-auto px-4 py-2.5 border border-[#4A5741] text-[#4A5741] hover:bg-[#4A5741]/5 font-semibold text-xs rounded-xl transition min-h-[40px] flex items-center justify-center"
              >
                🖨️ Print Form Preview
              </button>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2.5 bg-[#F7F2E9] hover:bg-[#EAE1D2] text-[#2C2A2A] font-semibold text-xs rounded-xl border border-[#EAE1D2] transition min-h-[40px] flex items-center justify-center"
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
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center text-[11px] sm:text-xs font-semibold border-t border-[#EAE1D2] pt-4">
            <button
              onClick={() => setStep(1)}
              className={`py-2.5 px-1 rounded-xl transition min-h-[42px] flex items-center justify-center ${step === 1 ? 'bg-[#BF5B33] text-white shadow-xs' : 'bg-[#F7F2E9] text-[#2C2A2A]/70 hover:bg-[#EAE1D2]/60'}`}
            >
              <span>Step 1<span className="hidden sm:inline">: Reasons & Goals</span></span>
            </button>
            <button
              onClick={() => setStep(2)}
              className={`py-2.5 px-1 rounded-xl transition min-h-[42px] flex items-center justify-center ${step === 2 ? 'bg-[#BF5B33] text-white shadow-xs' : 'bg-[#F7F2E9] text-[#2C2A2A]/70 hover:bg-[#EAE1D2]/60'}`}
            >
              <span>Step 2<span className="hidden sm:inline">: Medical & History</span></span>
            </button>
            <button
              onClick={() => setStep(3)}
              className={`py-2.5 px-1 rounded-xl transition min-h-[42px] flex items-center justify-center ${step === 3 ? 'bg-[#BF5B33] text-white shadow-xs' : 'bg-[#F7F2E9] text-[#2C2A2A]/70 hover:bg-[#EAE1D2]/60'}`}
            >
              <span>Step 3<span className="hidden sm:inline">: History & Review</span></span>
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

              <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full sm:w-auto py-3 px-6 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-200 transition min-h-[44px] flex items-center justify-center order-2 sm:order-1"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto py-3.5 px-8 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50 min-h-[44px] flex items-center justify-center order-1 sm:order-2"
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
