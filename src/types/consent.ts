export interface FormSection {
  id: string;
  title: string;
  content: string;
}

export interface ConsentTemplateData {
  id: string;
  title: string;
  category: string;
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
  clientTypedName: string;
  signatureDataUrl?: string; // Drawn signature canvas PNG base64
  signedAtISO: string;
  documentHash: string; // Sha-256 or unique document identifier
  status: 'signed';
}
