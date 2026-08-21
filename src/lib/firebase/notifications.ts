import {
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config';

export interface PracticeNotification {
  id?: string;
  type: 'appointment_created' | 'appointment_canceled' | 'intake_submitted' | 'document_signed' | 'profile_updated';
  title: string;
  message: string;
  clientId: string;
  clientName: string;
  details?: string;
  createdAt?: any;
  read?: boolean;
}

/**
 * Add a new practice notification event
 */
export async function createPracticeNotification(notification: Omit<PracticeNotification, 'id' | 'createdAt' | 'read'>) {
  const cleanPayload: Record<string, any> = {
    type: notification.type || 'profile_updated',
    title: notification.title || 'Client Activity Notice',
    message: notification.message || '',
    clientId: notification.clientId || 'unknown',
    clientName: notification.clientName || 'Client',
    details: notification.details || '',
    read: false,
    createdAt: serverTimestamp()
  };

  try {
    await addDoc(collection(db, 'practiceNotifications'), cleanPayload);
  } catch (err) {
    console.warn("Failed to create practice notification in Firestore:", err);
  }
}

/**
 * Fetch all notifications ordered by creation time
 */
export async function getPracticeNotifications(): Promise<PracticeNotification[]> {
  try {
    const colRef = collection(db, 'practiceNotifications');
    const snap = await getDocs(colRef);
    const notifs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PracticeNotification));
    
    // Sort newest first
    return notifs.sort((a, b) => {
      const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  } catch (err) {
    console.warn("Failed to fetch notifications:", err);
    return [];
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(id: string) {
  try {
    await updateDoc(doc(db, 'practiceNotifications', id), { read: true });
  } catch (err) {
    console.error("Failed to mark notification read:", err);
  }
}

/**
 * Delete a single notification document
 */
export async function deletePracticeNotification(id: string) {
  try {
    await deleteDoc(doc(db, 'practiceNotifications', id));
  } catch (err) {
    console.error("Failed to delete notification:", err);
  }
}

/**
 * Clear/Delete all practice notifications
 */
export async function clearAllPracticeNotifications() {
  try {
    const colRef = collection(db, 'practiceNotifications');
    const snap = await getDocs(colRef);
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  } catch (err) {
    console.error("Failed to clear notifications:", err);
  }
}
