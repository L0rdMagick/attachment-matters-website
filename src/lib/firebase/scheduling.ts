import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  runTransaction,
  addDoc
} from 'firebase/firestore';
import { db } from './config';
import type { AvailabilityRules, AppointmentData, AppointmentStatus } from '../../types/scheduling';

export const DEFAULT_AVAILABILITY_RULES: AvailabilityRules = {
  therapistId: 'default',
  timezone: 'America/Chicago',
  workingDays: {
    monday: { enabled: true, startTime: '09:00', endTime: '17:00' },
    tuesday: { enabled: true, startTime: '09:00', endTime: '17:00' },
    wednesday: { enabled: true, startTime: '09:00', endTime: '17:00' },
    thursday: { enabled: true, startTime: '09:00', endTime: '17:00' },
    friday: { enabled: true, startTime: '09:00', endTime: '15:00' },
    saturday: { enabled: false, startTime: '09:00', endTime: '12:00' },
    sunday: { enabled: false, startTime: '09:00', endTime: '12:00' }
  },
  appointmentTypes: [
    {
      id: 'ind_50',
      name: 'Individual Therapy Session',
      durationMinutes: 50,
      priceInCents: 15000,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 5,
      format: 'either'
    },
    {
      id: 'intake_90',
      name: 'Initial Intake Assessment',
      durationMinutes: 90,
      priceInCents: 22000,
      bufferBeforeMinutes: 10,
      bufferAfterMinutes: 10,
      format: 'either'
    }
  ],
  minNoticeHours: 24,
  maxAdvanceDays: 60,
  cancellationNoticeHours: 24,
  allowClientSelfScheduling: true,
  requireAppointmentApproval: false,
  blockedPeriods: []
};

/**
 * Fetch availability rules for a therapist
 */
export async function getAvailabilityRules(therapistId: string): Promise<AvailabilityRules> {
  const docRef = doc(db, 'availabilityRules', therapistId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data() as AvailabilityRules;
  }
  return { ...DEFAULT_AVAILABILITY_RULES, therapistId };
}

/**
 * Save availability rules
 */
export async function saveAvailabilityRules(rules: AvailabilityRules) {
  const docRef = doc(db, 'availabilityRules', rules.therapistId);
  await setDoc(docRef, rules, { merge: true });
}

/**
 * Fetch appointments for client or therapist
 */
export async function getAppointments(filter: { clientId?: string; therapistId?: string }): Promise<AppointmentData[]> {
  const colRef = collection(db, 'appointments');
  let q;
  if (filter.clientId) {
    q = query(colRef, where('clientId', '==', filter.clientId));
  } else if (filter.therapistId) {
    q = query(colRef, where('therapistId', '==', filter.therapistId));
  } else {
    q = query(colRef);
  }

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppointmentData));
}

/**
 * ATOMIC RESERVATION LOCKING & BOOKING
 * Uses a Firestore transaction to acquire an atomic lock document in `appointmentLocks`
 * preventing double-booking race conditions when two clients attempt to reserve the same slot simultaneously.
 */
export async function bookAppointmentWithLock(appointment: Omit<AppointmentData, 'id'>): Promise<string> {
  const slotKey = `${appointment.therapistId}_${new Date(appointment.startISO).getTime()}`;
  const lockRef = doc(db, 'appointmentLocks', slotKey);
  const newApptRef = doc(collection(db, 'appointments'));

  await runTransaction(db, async (transaction) => {
    const lockDoc = await transaction.get(lockRef);
    if (lockDoc.exists()) {
      throw new Error("RESERVATION_LOCK_FAILED: This appointment time slot was just claimed by another client. Please select a different time.");
    }

    // Acquire atomic reservation lock
    transaction.set(lockRef, {
      appointmentId: newApptRef.id,
      lockedByUid: appointment.clientId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min lock
      createdAt: serverTimestamp()
    });

    // Create appointment record
    transaction.set(newApptRef, {
      ...appointment,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  return newApptRef.id;
}

/**
 * Update appointment status (Cancel, Reschedule, Complete)
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
  reason?: string
) {
  const docRef = doc(db, 'appointments', appointmentId);
  await updateDoc(docRef, {
    status,
    ...(reason ? { cancellationReason: reason } : {}),
    updatedAt: serverTimestamp()
  });
}
