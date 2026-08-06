export interface Address {
  street: string;
  unit?: string;
  city: string;
  state: string;
  zip: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

export interface InsuranceInfo {
  provider: string;
  policyNumber: string;
  groupNumber?: string;
  subscriberName: string;
  subscriberDob?: string;
  subscriberRelationship?: string;
}

export interface ClientProfileData {
  uid: string;
  legalFirstName: string;
  legalMiddleName?: string;
  legalLastName: string;
  preferredName?: string;
  pronouns?: string;
  dob?: string;
  address?: Address;
  email: string;
  primaryPhone?: string;
  alternatePhone?: string;
  preferredContactMethod?: 'email' | 'phone' | 'sms';
  communicationConsent?: {
    emailConsent: boolean;
    smsConsent: boolean;
    voicemailConsent: boolean;
  };
  emergencyContact?: EmergencyContact;
  primaryCareProvider?: string;
  referralSource?: string;
  preferredFormat?: 'in_person' | 'telehealth' | 'either';
  accessibilityRequests?: string;
  preferredPharmacy?: string;
  insuranceInfo?: InsuranceInfo;
  insuranceCardFrontPath?: string;
  insuranceCardBackPath?: string;
  assignedTherapistId?: string;
  assignedTherapistName?: string;
  accountStatus: 'active' | 'inactive' | 'suspended';
  intakeStatus: 'not_started' | 'in_progress' | 'submitted' | 'approved' | 'revision_requested';
  consentStatus: 'pending' | 'completed';
  createdAt?: any;
  updatedAt?: any;
}

export interface ProfileAuditLog {
  id: string;
  updatedByUid: string;
  updatedByRole: string;
  changedFields: string[];
  previousValues: Record<string, any>;
  newValues: Record<string, any>;
  timestamp: any;
}
