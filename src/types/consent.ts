export interface FormSection {
  id: string;
  title: string;
  content: string; // Used as User Instructions for questionnaires or section body for consents
  fieldType?: 'short_text' | 'long_text'; // 'short_text' = single-line input, 'long_text' = multi-line box
  placeholder?: string;
}

export interface ConsentTemplateData {
  id: string;
  title: string;
  category: string;
  formType?: 'consent' | 'questionnaire'; // 'consent' = Read & Sign, 'questionnaire' = Fillable questions
  textContent: string;
  version: string;
  isActive: boolean;
  requiredForIntake: boolean;
  description?: string;
  sections?: FormSection[];
  lastUpdated?: string;
}

export interface SignedDocumentData {
  id?: string;
  clientId: string;
  templateId: string;
  templateVersion: string;
  documentTitle: string;
  exactTextSnapshot: string;
  answers?: Record<string, string>; // Maps section/question ID to client's answer string
  clientTypedName: string;
  signatureDataUrl?: string; // Drawn signature canvas PNG base64
  signedAtISO: string;
  documentHash: string; // Sha-256 or unique document identifier
  status: 'signed';
}
