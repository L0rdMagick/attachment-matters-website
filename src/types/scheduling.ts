export interface AppointmentType {
  id: string;
  name: string; // e.g. "Individual Therapy", "Intake Assessment", "Couples Therapy"
  durationMinutes: number; // e.g. 50, 90
  priceInCents: number; // e.g. 15000 ($150.00)
  bufferBeforeMinutes: number; // e.g. 10
  bufferAfterMinutes: number; // e.g. 10
  format: 'in_person' | 'telehealth' | 'either';
}

export interface WorkingDay {
  enabled: boolean;
  startTime: string; // "09:00"
  endTime: string; // "17:00"
}

export interface BlockedPeriod {
  id: string;
  startISO: string;
  endISO: string;
  reason: string;
}

export interface AvailabilityRules {
  therapistId: string;
  timezone: string; // Default: "America/Chicago"
  workingDays: Record<string, WorkingDay>; // 'monday' through 'sunday'
  appointmentTypes: AppointmentType[];
  minNoticeHours: number; // Default: 24
  maxAdvanceDays: number; // Default: 60
  cancellationNoticeHours: number; // Default: 24
  allowClientSelfScheduling: boolean;
  requireAppointmentApproval: boolean;
  blockedPeriods: BlockedPeriod[];
}

export type AppointmentStatus =
  | 'requested'
  | 'confirmed'
  | 'completed'
  | 'canceled_by_client'
  | 'canceled_by_practice'
  | 'late_canceled'
  | 'no_show'
  | 'rescheduled';

export interface AppointmentData {
  id?: string;
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  therapistId: string;
  appointmentTypeId: string;
  appointmentTypeName: string;
  startISO: string;
  endISO: string;
  timezone: string;
  format: 'in_person' | 'telehealth';
  locationOrLink?: string;
  status: AppointmentStatus;
  notes?: string;
  cancellationReason?: string;
  priceInCents: number;
  googleCalendarEventId?: string;
  syncStatus?: 'synced' | 'pending' | 'error';
  createdAt?: any;
  updatedAt?: any;
}
