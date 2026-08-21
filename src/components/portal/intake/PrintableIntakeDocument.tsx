import React from 'react';
import type { IntakeSubmissionData } from '../../../types/intake';

export interface PrintableIntakeDocumentProps {
  clientName: string;
  clientEmail?: string;
  intakeData?: IntakeSubmissionData | null;
  // Fallbacks for direct state passing (e.g. from IntakeFormRunner)
  reasonForTherapy?: string;
  selectedSymptoms?: string[];
  therapyGoals?: string;
  previousCounseling?: boolean;
  previousCounselingDetails?: string;
  currentMedications?: string;
  medicalHistoryNotes?: string;
  currentProviders?: string;
  relationshipStatus?: string;
  employmentOrSchool?: string;
  familySocialHistory?: string;
  substanceUseQuestions?: string;
  suicidalIdeation?: boolean;
  selfHarm?: boolean;
  safetyDetails?: string;
  additionalNotes?: string;
  submittedAt?: string | null;
  status?: string;
}

export const PrintableIntakeDocument: React.FC<PrintableIntakeDocumentProps> = (props) => {
  const { clientName, clientEmail, intakeData } = props;

  const reason = intakeData?.reasonForTherapy ?? props.reasonForTherapy ?? '';
  const symptoms = intakeData?.currentSymptoms ?? props.selectedSymptoms ?? [];
  const goals = intakeData?.therapyGoals ?? props.therapyGoals ?? '';
  const prevCounseling = intakeData?.previousCounseling ?? props.previousCounseling ?? false;
  const prevCounselingDetails = intakeData?.previousCounselingDetails ?? props.previousCounselingDetails ?? '';
  const medications = intakeData?.currentMedications ?? props.currentMedications ?? '';
  const medicalHistory = intakeData?.medicalHistoryNotes ?? props.medicalHistoryNotes ?? '';
  const providers = intakeData?.currentProviders ?? props.currentProviders ?? '';
  const relationship = intakeData?.relationshipStatus ?? props.relationshipStatus ?? '';
  const employment = intakeData?.employmentOrSchool ?? props.employmentOrSchool ?? '';
  const familyHistory = intakeData?.familySocialHistory ?? props.familySocialHistory ?? '';
  const substance = intakeData?.substanceUseQuestions ?? props.substanceUseQuestions ?? '';
  const suicidal = intakeData?.safetyScreeningAnswers?.suicidalIdeationPastMonth ?? props.suicidalIdeation ?? false;
  const selfHarmHistory = intakeData?.safetyScreeningAnswers?.selfHarmHistory ?? props.selfHarm ?? false;
  const safety = intakeData?.safetyScreeningAnswers?.safetyDetails ?? props.safetyDetails ?? '';
  const notes = intakeData?.additionalNotes ?? props.additionalNotes ?? '';

  const rawStatus = intakeData?.status || props.status || 'submitted';
  const isSubmitted = rawStatus === 'submitted' || rawStatus === 'approved';
  const statusDisplay = rawStatus.replace('_', ' ').toUpperCase();

  const formattedDate = intakeData?.submittedAt
    ? (typeof intakeData.submittedAt === 'string'
        ? new Date(intakeData.submittedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : (intakeData.submittedAt?.toDate
            ? intakeData.submittedAt.toDate().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
            : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })))
    : (props.submittedAt
        ? new Date(props.submittedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));

  return (
    <div className="official-print-document bg-white border-2 border-gray-900 rounded-none p-8 sm:p-12 shadow-none space-y-6 font-sans text-gray-900 print:border-none print:shadow-none print:p-0 print:m-0 print-card">
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
        <div className="overflow-hidden">
          <span className="block font-bold uppercase tracking-wider text-gray-600 text-[10px]">Client Account Email</span>
          <span className="font-semibold text-gray-900 break-all break-words">{clientEmail || 'N/A'}</span>
        </div>
        <div>
          <span className="block font-bold uppercase tracking-wider text-gray-600 text-[10px]">Document Record Date</span>
          <span className="font-semibold text-gray-900">{formattedDate}</span>
        </div>
        <div>
          <span className="block font-bold uppercase tracking-wider text-gray-600 text-[10px]">Submission Status</span>
          <span className="font-bold text-gray-900 uppercase">{isSubmitted ? `VERIFIED (${statusDisplay})` : statusDisplay}</span>
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
            {reason.trim() || <span className="italic text-gray-500">[No clinical response recorded]</span>}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-bold text-gray-800 uppercase">1.2 Reported Symptoms & Presenting Concerns:</p>
          <div className="p-3 border border-gray-400 text-xs">
            {symptoms.length > 0 ? (
              <p className="font-medium text-gray-900">{symptoms.join(' • ')}</p>
            ) : (
              <span className="italic text-gray-500">[No specific symptom categories checked]</span>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-bold text-gray-800 uppercase">1.3 Primary Treatment Goals & Desired Outcomes:</p>
          <div className="p-3 border border-gray-400 text-xs leading-relaxed min-h-[50px] whitespace-pre-wrap">
            {goals.trim() || <span className="italic text-gray-500">[No treatment goals recorded]</span>}
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
            <p className="font-medium">Prior Treatment Attended: <strong>{prevCounseling ? 'YES' : 'NO'}</strong></p>
            {prevCounseling && prevCounselingDetails && (
              <p className="pt-1 border-t border-gray-300 text-gray-800">
                <strong>Details:</strong> {prevCounselingDetails}
              </p>
            )}
          </div>

          <div className="p-3 border border-gray-400 space-y-1">
            <p className="font-bold uppercase text-gray-800">2.2 Current Prescription / OTC Medications:</p>
            <p className="whitespace-pre-wrap">{medications.trim() || <span className="italic text-gray-500">[None listed]</span>}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 border border-gray-400 space-y-1">
            <p className="font-bold uppercase text-gray-800">2.3 Relevant Medical Conditions / History:</p>
            <p className="whitespace-pre-wrap">{medicalHistory.trim() || <span className="italic text-gray-500">[None listed]</span>}</p>
          </div>

          <div className="p-3 border border-gray-400 space-y-1">
            <p className="font-bold uppercase text-gray-800">2.4 Current Healthcare / Medical Providers:</p>
            <p className="whitespace-pre-wrap">{providers.trim() || <span className="italic text-gray-500">[None listed]</span>}</p>
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
            <span className="font-semibold">{relationship.trim() || 'Not specified'}</span>
          </div>
          <div className="p-3 border border-gray-400">
            <span className="font-bold uppercase text-gray-800">Employment / Schooling: </span>
            <span className="font-semibold">{employment.trim() || 'Not specified'}</span>
          </div>
        </div>

        {(familyHistory || substance) && (
          <div className="space-y-2 text-xs">
            {familyHistory && (
              <div className="p-3 border border-gray-400">
                <p className="font-bold uppercase text-gray-800">Family & Social History:</p>
                <p className="whitespace-pre-wrap mt-1">{familyHistory}</p>
              </div>
            )}
            {substance && (
              <div className="p-3 border border-gray-400">
                <p className="font-bold uppercase text-gray-800">Substance Use Background:</p>
                <p className="whitespace-pre-wrap mt-1">{substance}</p>
              </div>
            )}
          </div>
        )}

        <div className="p-3 border border-gray-900 bg-gray-50 text-xs space-y-1">
          <p className="font-bold uppercase tracking-wider text-gray-900">3.1 Safety Screening Assessment Record:</p>
          <p>• Suicidal Ideation Reported in Past Month: <strong>{suicidal ? 'YES (HIGH PRIORITY CLINICAL FLAG)' : 'NO'}</strong></p>
          <p>• Self-Harm History Reported: <strong>{selfHarmHistory ? 'YES' : 'NO'}</strong></p>
          {safety && (
            <p className="pt-1 border-t border-gray-300"><strong>Safety Assessment Details:</strong> {safety}</p>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-bold text-gray-800 uppercase">3.2 Additional Client Disclosures & Notes:</p>
          <div className="p-3 border border-gray-400 text-xs min-h-[40px] whitespace-pre-wrap">
            {notes.trim() || <span className="italic text-gray-500">[No additional notes recorded]</span>}
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
                <span className="font-semibold text-gray-900">{formattedDate}</span>
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
};
