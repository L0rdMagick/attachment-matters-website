export interface IntakeSubmissionData {
  id?: string;
  clientId: string;
  templateVersion: string;
  status: 'draft' | 'submitted' | 'approved' | 'revision_requested';
  
  // Section 1: Reason & Goals
  reasonForTherapy: string;
  currentSymptoms: string[];
  symptomSeverity?: string;
  therapyGoals: string;
  
  // Section 2: Mental Health & Medical History
  previousCounseling: boolean;
  previousCounselingDetails?: string;
  medicalHistoryNotes?: string;
  currentMedications?: string;
  currentProviders?: string;

  // Section 3: Social, Family & Safety
  familySocialHistory?: string;
  relationshipStatus?: string;
  employmentOrSchool?: string;
  substanceUseQuestions?: string;
  safetyScreeningAnswers?: {
    suicidalIdeationPastMonth: boolean;
    selfHarmHistory: boolean;
    safetyDetails?: string;
  };

  // Additional Notes
  additionalNotes?: string;
  
  submittedAt?: any;
  reviewedAt?: any;
  reviewedByUid?: string;
  revisionNotes?: string;
}
