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
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from './config';
import type { AvailabilityRules, AppointmentData, AppointmentStatus } from '../../types/scheduling';

import { createPracticeNotification } from './notifications';

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
      id: 'intake_90',
      name: 'Initial Intake & Clinical Assessment',
      durationMinutes: 90,
      priceInCents: 22000,
      bufferBeforeMinutes: 10,
      bufferAfterMinutes: 10,
      format: 'either'
    },
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
      id: 'fam_50',
      name: 'Family & Relational Therapy Session',
      durationMinutes: 50,
      priceInCents: 17500,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 5,
      format: 'either'
    },
    {
      id: 'parent_50',
      name: 'Parent Consultation & Co-Parenting Coaching',
      durationMinutes: 50,
      priceInCents: 16000,
      bufferBeforeMinutes: 5,
      bufferAfterMinutes: 5,
      format: 'either'
    },
    {
      id: 'court_60',
      name: 'Court-Involved / Custody Consultation Session',
      durationMinutes: 60,
      priceInCents: 20000,
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
export async function getAvailabilityRules(therapistId: string = 'default'): Promise<AvailabilityRules> {
  try {
    const docRef = doc(db, 'availabilityRules', therapistId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as Partial<AvailabilityRules>;
      const appointmentTypes = (Array.isArray(data.appointmentTypes) && data.appointmentTypes.length > 0)
        ? data.appointmentTypes
        : DEFAULT_AVAILABILITY_RULES.appointmentTypes;

      return {
        ...DEFAULT_AVAILABILITY_RULES,
        ...data,
        appointmentTypes,
        therapistId
      };
    }
  } catch (err) {
    console.error("Error fetching availability rules from Firestore:", err);
  }
  return { ...DEFAULT_AVAILABILITY_RULES, therapistId };
}

/**
 * Save availability rules
 */
export async function saveAvailabilityRules(rules: AvailabilityRules) {
  const docRef = doc(db, 'availabilityRules', rules.therapistId);
  await setDoc(docRef, rules, { merge: true });

  // Also update default document so client booking immediately reflects practice hours
  if (rules.therapistId !== 'default') {
    const defaultRef = doc(db, 'availabilityRules', 'default');
    await setDoc(defaultRef, { ...rules, therapistId: 'default' }, { merge: true });
  }
}

/**
 * Helper to get day-of-week key for a 'YYYY-MM-DD' string
 */
export function getDayOfWeekKey(dateStr: string): 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const days: ('sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday')[] = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ];
  return days[dateObj.getDay()];
}

/**
 * Dynamically calculate available time slots for a given date matching therapist practice rules
 */
export function getAvailableTimeSlots(
  dateStr: string,
  rules: AvailabilityRules,
  existingAppointments: AppointmentData[],
  durationMinutes: number = 50,
  bufferBeforeMinutes: number = 0,
  bufferAfterMinutes: number = 0
): { slots: string[]; reason?: string } {
  const dayKey = getDayOfWeekKey(dateStr);
  const dayConfig = rules.workingDays[dayKey];

  if (!dayConfig || !dayConfig.enabled) {
    const formattedDay = dayKey.charAt(0).toUpperCase() + dayKey.slice(1);
    return {
      slots: [],
      reason: `Practice is closed on ${formattedDay}s according to practice settings.`
    };
  }

  const nowMs = Date.now();

  // 1. Enforce Max Advance Booking Window (0 - 100 Days)
  const maxAdvanceDays = rules.maxAdvanceDays ?? 60;
  const maxAdvanceMs = nowMs + maxAdvanceDays * 86400000;
  const targetDateMs = new Date(`${dateStr}T23:59:59`).getTime();

  if (targetDateMs > maxAdvanceMs) {
    return {
      slots: [],
      reason: `Online booking is only permitted up to ${maxAdvanceDays} day${maxAdvanceDays === 1 ? '' : 's'} in advance per practice policy.`
    };
  }

  // 2. Enforce Minimum Lead Notice Window (Hours/Days)
  const minNoticeHours = rules.minNoticeHours ?? 24;
  const minNoticeMs = nowMs + minNoticeHours * 3600000;

  const [startHour, startMin] = dayConfig.startTime.split(':').map(Number);
  const [endHour, endMin] = dayConfig.endTime.split(':').map(Number);

  const dayStartMinutes = startHour * 60 + startMin;
  const dayEndMinutes = endHour * 60 + endMin;

  const validSlots: string[] = [];
  const stepMinutes = 30; // Generate slots every 30 mins

  for (let current = dayStartMinutes; current + durationMinutes <= dayEndMinutes; current += stepMinutes) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    const slotTimeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const slotStartISO = `${dateStr}T${slotTimeStr}:00`;
    const sessionStartMs = new Date(slotStartISO).getTime();
    const sessionEndMs = sessionStartMs + durationMinutes * 60000;

    // Full block including pre & post session buffers
    const blockedStartMs = sessionStartMs - bufferBeforeMinutes * 60000;
    const blockedEndMs = sessionEndMs + bufferAfterMinutes * 60000;

    // Check if slot falls within minimum lead notice period
    if (sessionStartMs < minNoticeMs) {
      continue;
    }

    // Check for overlap with existing confirmed/requested appointments (including buffer times)
    const hasOverlap = existingAppointments.some((appt) => {
      if (appt.status !== 'confirmed' && appt.status !== 'requested' && appt.status !== 'rescheduled') return false;
      const apptStartMs = new Date(appt.startISO).getTime();
      const apptEndMs = new Date(appt.endISO).getTime();
      return blockedStartMs < apptEndMs && blockedEndMs > apptStartMs;
    });

    if (!hasOverlap) {
      validSlots.push(slotTimeStr);
    }
  }

  if (validSlots.length === 0) {
    const minNoticeDays = (minNoticeHours / 24).toFixed(1).replace('.0', '');
    return {
      slots: [],
      reason: `No available slots on this date (minimum notice requirement is ${minNoticeDays} day${minNoticeDays === '1' ? '' : 's'} / ${minNoticeHours} hrs).`
    };
  }

  return { slots: validSlots };
}

/**
 * Evaluates whether a proposed therapist booking is available in practice settings
 */
export function checkTherapistSlotAvailability(
  dateStr: string,
  timeStr: string,
  durationMinutes: number,
  rules: AvailabilityRules,
  existingAppointments: AppointmentData[],
  bufferBeforeMinutes: number = 0,
  bufferAfterMinutes: number = 0
): { isAvailable: boolean; reason?: string } {
  const dayKey = getDayOfWeekKey(dateStr);
  const dayConfig = rules.workingDays[dayKey];
  const formattedDay = dayKey.charAt(0).toUpperCase() + dayKey.slice(1);

  if (!dayConfig || !dayConfig.enabled) {
    return {
      isAvailable: false,
      reason: `Your practice settings show that ${formattedDay}s are currently closed / disabled for appointments.`
    };
  }

  const [tHour, tMin] = timeStr.split(':').map(Number);
  const slotStartMin = tHour * 60 + tMin;
  const slotEndMin = slotStartMin + durationMinutes;

  const [sHour, sMin] = dayConfig.startTime.split(':').map(Number);
  const [eHour, eMin] = dayConfig.endTime.split(':').map(Number);
  const dayStartMin = sHour * 60 + sMin;
  const dayEndMin = eHour * 60 + eMin;

  if (slotStartMin < dayStartMin || slotEndMin > dayEndMin) {
    return {
      isAvailable: false,
      reason: `The requested time (${timeStr}) is outside your configured practice working hours for ${formattedDay}s (${dayConfig.startTime} - ${dayConfig.endTime}).`
    };
  }

  // Check overlap with existing appointments (accounting for pre/post buffers)
  const sessionStartMs = new Date(`${dateStr}T${timeStr}:00`).getTime();
  const sessionEndMs = sessionStartMs + durationMinutes * 60000;
  const blockedStartMs = sessionStartMs - bufferBeforeMinutes * 60000;
  const blockedEndMs = sessionEndMs + bufferAfterMinutes * 60000;

  const conflict = existingAppointments.find((appt) => {
    if (appt.status !== 'confirmed' && appt.status !== 'requested' && appt.status !== 'rescheduled') return false;
    const apptStartMs = new Date(appt.startISO).getTime();
    const apptEndMs = new Date(appt.endISO).getTime();
    return blockedStartMs < apptEndMs && blockedEndMs > apptStartMs;
  });

  if (conflict) {
    return {
      isAvailable: false,
      reason: `This time slot conflicts with an existing appointment for ${conflict.clientName || 'another client'} (${new Date(conflict.startISO).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).`
    };
  }

  return { isAvailable: true };
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
export async function bookAppointmentWithLock(
  appointment: Omit<AppointmentData, 'id'>,
  allowOverride: boolean = false
): Promise<string> {
  const slotKey = `${appointment.therapistId}_${new Date(appointment.startISO).getTime()}`;
  const lockRef = doc(db, 'appointmentLocks', slotKey);
  const newApptRef = doc(collection(db, 'appointments'));

  await runTransaction(db, async (transaction) => {
    const lockDoc = await transaction.get(lockRef);
    if (lockDoc.exists() && !allowOverride) {
      const lockData = lockDoc.data();
      let isLockActive = true;
      if (lockData?.appointmentId) {
        const existingApptRef = doc(db, 'appointments', lockData.appointmentId);
        const existingApptSnap = await transaction.get(existingApptRef);
        if (existingApptSnap.exists()) {
          const existingAppt = existingApptSnap.data();
          if (
            existingAppt.status !== 'confirmed' &&
            existingAppt.status !== 'requested' &&
            existingAppt.status !== 'rescheduled'
          ) {
            isLockActive = false;
          }
        } else {
          isLockActive = false;
        }
      }
      if (isLockActive) {
        throw new Error("RESERVATION_LOCK_FAILED: This appointment time slot was just claimed by another client. Please select a different time.");
      }
    }

    // Acquire atomic reservation lock
    transaction.set(lockRef, {
      appointmentId: newApptRef.id,
      lockedByUid: appointment.clientId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min lock
      createdAt: serverTimestamp()
    });

    // Filter out undefined properties because Firestore transaction.set throws on undefined values
    const cleanAppointmentData: Record<string, any> = {};
    for (const [key, val] of Object.entries(appointment)) {
      if (val !== undefined) {
        cleanAppointmentData[key] = val;
      }
    }

    // Create appointment record
    transaction.set(newApptRef, {
      ...cleanAppointmentData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  // Record practice notification for appointment creation
  createPracticeNotification({
    type: 'appointment_created',
    title: '📅 New Appointment Booked',
    message: `${appointmentData.clientName || 'Client'} booked ${appointmentData.appointmentTypeName || 'Therapy Session'} for ${new Date(appointmentData.startISO).toLocaleString()}.`,
    clientId: appointmentData.clientId,
    clientName: appointmentData.clientName || appointmentData.clientEmail || 'Client',
    details: `Format: ${appointmentData.format}`
  });

  return newApptRef.id;
}

import { createInvoice, recordLedgerTransaction, getInvoicesForClient } from './billing';

/**
 * Update appointment status (Cancel, Reschedule, Complete)
 * Automatically issues an official invoice and ledger charge entry when an appointment is marked 'completed'
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
  reason?: string
) {
  const docRef = doc(db, 'appointments', appointmentId);
  const apptSnap = await getDoc(docRef);

  if (apptSnap.exists()) {
    const apptData = apptSnap.data() as AppointmentData;

    // Release/delete reservation lock if completed or canceled
    if (status === 'completed' || status === 'canceled' || status.startsWith('canceled')) {
      if (apptData.therapistId && apptData.startISO) {
        const slotKey = `${apptData.therapistId}_${new Date(apptData.startISO).getTime()}`;
        const lockRef = doc(db, 'appointmentLocks', slotKey);
        try {
          await deleteDoc(lockRef);
        } catch (e) {
          console.warn('Failed to release lock document:', e);
        }
      }
    }

    if (status === 'completed') {
      const invoiceNum = `INV-APPT-${appointmentId.slice(-6).toUpperCase()}`;

      // Check if an invoice for this appointment already exists
      const existingInvs = await getInvoicesForClient(apptData.clientId);
      const alreadyInvoiced = existingInvs.some((inv) => inv.invoiceNumber === invoiceNum);

      if (!alreadyInvoiced) {
        const apptDateStr = apptData.startISO ? new Date(apptData.startISO).toLocaleDateString('en-US') : new Date().toLocaleDateString('en-US');
        const price = apptData.priceInCents || 15000;

        const invId = await createInvoice({
          clientId: apptData.clientId,
          invoiceNumber: invoiceNum,
          description: `${apptData.appointmentTypeName || 'Completed Therapy Session'} (${apptDateStr})`,
          totalCents: price,
          balanceCents: price,
          status: 'unpaid',
          dueDate: new Date().toISOString().split('T')[0]
        });

        await recordLedgerTransaction({
          clientId: apptData.clientId,
          invoiceId: invId,
          type: 'charge',
          amountCents: price,
          notes: `Completed Session Charge: ${apptData.appointmentTypeName || 'Therapy Session'} (${invoiceNum})`,
          createdById: 'system'
        });
      }
    }
  }

  await updateDoc(docRef, {
    status,
    ...(reason ? { cancellationReason: reason } : {}),
    updatedAt: serverTimestamp()
  });

  // If appointment was canceled by client, record practice notification
  if (status === 'canceled_by_client' && apptSnap.exists()) {
    try {
      const appt = apptSnap.data() as AppointmentData;
      const cancelReason = reason || 'Canceled by client via portal';
      
      await createPracticeNotification({
        type: 'appointment_canceled',
        title: '🛑 Appointment Canceled by Client',
        message: `${appt.clientName || appt.clientEmail || 'Client'} canceled session (${appt.appointmentTypeName || 'Therapy Session'}) scheduled for ${new Date(appt.startISO).toLocaleString()}.`,
        clientId: appt.clientId,
        clientName: appt.clientName || appt.clientEmail || 'Client',
        details: cancelReason
      });

      // Also create document in cancellationAlerts for fallback compatibility
      await addDoc(collection(db, 'cancellationAlerts'), {
        appointmentId,
        clientId: appt.clientId,
        clientName: appt.clientName || appt.clientEmail || 'Client',
        appointmentTypeName: appt.appointmentTypeName || 'Therapy Session',
        startISO: appt.startISO,
        reason: cancelReason,
        canceledAt: new Date().toISOString(),
        read: false
      });
    } catch (err) {
      console.warn("Failed to create cancellation alert notice:", err);
    }
  }
}

/**
 * Reschedule an appointment to a new startISO and endISO, updating status and optionally notes
 */
export async function rescheduleAppointment(
  appointmentId: string,
  newStartISO: string,
  newEndISO: string,
  newNotes?: string,
  targetStatus: string = 'requested'
) {
  const docRef = doc(db, 'appointments', appointmentId);
  const apptSnap = await getDoc(docRef);

  if (apptSnap.exists()) {
    const apptData = apptSnap.data() as AppointmentData;
    if (apptData.therapistId && apptData.startISO) {
      const oldSlotKey = `${apptData.therapistId}_${new Date(apptData.startISO).getTime()}`;
      const oldLockRef = doc(db, 'appointmentLocks', oldSlotKey);
      try {
        await deleteDoc(oldLockRef);
      } catch (e) {
        console.warn('Failed to release old lock document during reschedule:', e);
      }
    }
  }

  const updatePayload: Record<string, any> = {
    startISO: newStartISO,
    endISO: newEndISO,
    status: targetStatus,
    updatedAt: serverTimestamp()
  };
  if (newNotes !== undefined) {
    updatePayload.notes = newNotes;
  }

  try {
    await updateDoc(docRef, updatePayload);
  } catch (err: any) {
    if (err && (err.code === 'permission-denied' || String(err).includes('permission'))) {
      updatePayload.status = 'requested';
      await updateDoc(docRef, updatePayload);
    } else {
      throw err;
    }
  }
}
