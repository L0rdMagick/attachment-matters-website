export interface SharedNoteData {
  id?: string;
  clientId: string;
  therapistId: string;
  title: string;
  sessionDate?: string;
  startDate?: string;
  endDate?: string;
  recapSummary: string;
  homeworkAssigned?: string;
  goalsForNextSession?: string;
  resources?: { name: string; url: string }[];
  isPublished: boolean;
  publishedAt?: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface NoteAmendment {
  amendedAtISO: string;
  amendedByUid: string;
  reason: string;
  additionalContent: string;
}

export interface PrivateClinicalNoteData {
  id?: string;
  clientId: string;
  therapistId: string;
  appointmentId?: string;
  noteType: 'dap' | 'soap' | 'girp' | 'freeform';
  
  // DAP fields (Data, Assessment, Plan)
  dataSection?: string;
  assessmentSection?: string;
  planSection?: string;

  // SOAP fields (Subjective, Objective, Assessment, Plan)
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;

  freeformContent?: string;

  isFinalized: boolean;
  finalizedAtISO?: string;
  amendments?: NoteAmendment[];

  createdAt?: any;
  updatedAt?: any;
}
