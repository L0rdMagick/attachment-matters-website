import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './config';
import type { ClientProfileData } from '../../types/client';

/**
 * Fetch client profile by UID
 */
export async function getClientProfile(clientId: string): Promise<ClientProfileData | null> {
  const docRef = doc(db, 'clients', clientId);
  const snap = await getDoc(docRef);
  if (snap.exists()) {
    return snap.data() as ClientProfileData;
  }
  return null;
}

import { createPracticeNotification } from './notifications';

/**
 * Update client profile with audit logging
 */
export async function updateClientProfile(
  clientId: string,
  updatedData: Partial<ClientProfileData>,
  actorUid: string,
  actorRole: string
) {
  const clientRef = doc(db, 'clients', clientId);
  const currentSnap = await getDoc(clientRef);
  const currentData = currentSnap.exists() ? currentSnap.data() as Partial<ClientProfileData> : {};

  // Record audit log entry
  const changedFields = Object.keys(updatedData);
  const previousValues: Record<string, any> = {};
  changedFields.forEach((key) => {
    previousValues[key] = (currentData as any)[key] ?? null;
  });

  // Update client document safely
  await setDoc(clientRef, {
    ...updatedData,
    updatedAt: serverTimestamp()
  }, { merge: true });

  // Create audit event record safely
  try {
    await addDoc(collection(db, 'auditEvents'), {
      actorUid,
      actorRole,
      targetUid: clientId,
      action: 'update_client_profile',
      resourcePath: `clients/${clientId}`,
      changedFields,
      previousValues,
      newValues: updatedData,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.warn("Audit log creation skipped:", err);
  }

  // Always record practice notification for client profile changes
  const name = (updatedData.legalFirstName ? `${updatedData.legalFirstName} ${updatedData.legalLastName || ''}` : (currentData.legalFirstName ? `${currentData.legalFirstName} ${currentData.legalLastName || ''}` : 'Client')).trim();
  await createPracticeNotification({
    type: 'profile_updated',
    title: '👤 Client Profile Saved / Updated',
    message: `${name} updated profile information.`,
    clientId,
    clientName: name,
    details: `Updated fields: ${changedFields.join(', ')}`
  });
}

/**
 * Upload Insurance Card Image to Storage
 */
export async function uploadInsuranceCard(
  clientId: string,
  file: File,
  side: 'front' | 'back'
): Promise<string> {
  const fileExt = file.name.split('.').pop() || 'png';
  const storagePath = `clients/${clientId}/insurance_${side}_${Date.now()}.${fileExt}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, file);
  const downloadUrl = await getDownloadURL(storageRef);

  const updateKey = side === 'front' ? 'insuranceCardFrontPath' : 'insuranceCardBackPath';
  const clientRef = doc(db, 'clients', clientId);
  await setDoc(
    clientRef,
    {
      uid: clientId,
      [updateKey]: downloadUrl,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  await createPracticeNotification({
    type: 'profile_updated',
    title: '📇 Insurance Card Uploaded',
    message: `Client uploaded new insurance card image (${side} side).`,
    clientId,
    clientName: 'Client'
  });

  return downloadUrl;
}

/**
 * Delete Insurance Card Image from Storage and Firestore
 */
export async function deleteInsuranceCard(
  clientId: string,
  side: 'front' | 'back'
): Promise<void> {
  const updateKey = side === 'front' ? 'insuranceCardFrontPath' : 'insuranceCardBackPath';
  const clientRef = doc(db, 'clients', clientId);

  await setDoc(
    clientRef,
    {
      [updateKey]: null,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

/**
 * Therapist / Admin: Search & Filter Client Directory
 */
export async function getClientsDirectory(filters?: {
  searchQuery?: string;
  assignedTherapistId?: string;
  accountStatus?: string;
  intakeStatus?: string;
}): Promise<ClientProfileData[]> {
  const clientMap = new Map<string, ClientProfileData>();

  // 1. Query clients collection safely
  try {
    const clientsSnap = await getDocs(collection(db, 'clients'));
    clientsSnap.docs.forEach((d) => {
      const data = d.data() as ClientProfileData;
      if (data.accountStatus !== 'deleted' && !(data as any).isDeleted) {
        clientMap.set(d.id, { uid: d.id, ...data });
      }
    });
  } catch (err) {
    console.warn("Could not query clients collection directly:", err);
  }

  // 2. Query users collection safely
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    for (const uDoc of usersSnap.docs) {
      const uData = uDoc.data();
      if ((uData.role === 'client' || !uData.role) && uData.status !== 'deleted' && !uData.isDeleted) {
        if (!clientMap.has(uDoc.id)) {
          const uEmail = (uData.email || '').toLowerCase().trim();
          // Check if email belongs to an already deleted or existing profile in clientMap
          const existingByEmail = Array.from(clientMap.values()).find(
            (c) => c.email && c.email.toLowerCase().trim() === uEmail
          );

          if (!existingByEmail && uEmail) {
            const newClient: ClientProfileData = {
              uid: uDoc.id,
              legalFirstName: uData.legalFirstName || 'New',
              legalLastName: uData.legalLastName || 'Client',
              email: uData.email || '',
              accountStatus: (uData.status as any) || 'active',
              intakeStatus: 'not_started',
              consentStatus: 'pending'
            };
            clientMap.set(uDoc.id, newClient);
          }
        }
      }
    }
  } catch (err) {
    console.warn("Could not query users collection directly:", err);
  }

  let clients = Array.from(clientMap.values());

  // Filter out any explicitly deleted records
  clients = clients.filter((c) => c.accountStatus !== 'deleted' && !(c as any).isDeleted);

  if (filters?.assignedTherapistId) {
    clients = clients.filter((c) => c.assignedTherapistId === filters.assignedTherapistId);
  }

  // In-memory filters for text search and status
  if (filters?.searchQuery) {
    const term = filters.searchQuery.toLowerCase();
    clients = clients.filter(
      (c) =>
        (c.legalFirstName && c.legalFirstName.toLowerCase().includes(term)) ||
        (c.legalLastName && c.legalLastName.toLowerCase().includes(term)) ||
        (c.email && c.email.toLowerCase().includes(term)) ||
        (c.preferredName && c.preferredName.toLowerCase().includes(term))
    );
  }

  if (filters?.accountStatus) {
    clients = clients.filter((c) => (c.accountStatus || 'active') === filters.accountStatus);
  }

  if (filters?.intakeStatus) {
    clients = clients.filter((c) => (c.intakeStatus || 'not_started') === filters.intakeStatus);
  }

  return clients;
}

/**
 * Permanently delete client profile and all associated portal documents across collections
 */
export async function deleteClientProfile(clientId: string, clientEmail?: string) {
  const refsToDelete: any[] = [
    doc(db, 'clients', clientId),
    doc(db, 'users', clientId),
    doc(db, 'intakeSubmissions', clientId)
  ];

  // Also query users and clients by email to delete any duplicate/orphaned user documents
  if (clientEmail && clientEmail.trim()) {
    const trimmedEmail = clientEmail.trim();
    try {
      const [uSnap, cSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), where('email', '==', trimmedEmail))),
        getDocs(query(collection(db, 'clients'), where('email', '==', trimmedEmail)))
      ]);
      uSnap.docs.forEach((d) => refsToDelete.push(d.ref));
      cSnap.docs.forEach((d) => refsToDelete.push(d.ref));
    } catch (err) {
      console.warn("Could not query documents by email for deletion:", err);
    }
  }

  // Execute document deletions
  await Promise.allSettled(refsToDelete.map((dRef) => deleteDoc(dRef)));

  // Clean up collections linked by clientId
  const collectionsToClean = [
    'appointments',
    'signedDocuments',
    'invoices',
    'ledgerEntries',
    'practiceNotifications',
    'cancellationAlerts'
  ];

  for (const colName of collectionsToClean) {
    try {
      const q = query(collection(db, colName), where('clientId', '==', clientId));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    } catch (err) {
      console.warn(`Error deleting from ${colName}:`, err);
    }
  }
}
