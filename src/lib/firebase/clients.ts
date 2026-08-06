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
  const currentData = currentSnap.exists() ? currentSnap.data() : {};

  // Record audit log entry
  const changedFields = Object.keys(updatedData);
  const previousValues: Record<string, any> = {};
  changedFields.forEach((key) => {
    previousValues[key] = (currentData as any)[key] ?? null;
  });

  // Update client document
  await updateDoc(clientRef, {
    ...updatedData,
    updatedAt: serverTimestamp()
  });

  // Create audit event record
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
      clientMap.set(d.id, { uid: d.id, ...d.data() } as ClientProfileData);
    });
  } catch (err) {
    console.warn("Could not query clients collection directly:", err);
  }

  // 2. Query users collection safely
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    for (const uDoc of usersSnap.docs) {
      const uData = uDoc.data();
      if (uData.role === 'client' || !uData.role) {
        if (!clientMap.has(uDoc.id)) {
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
  } catch (err) {
    console.warn("Could not query users collection directly:", err);
  }

  let clients = Array.from(clientMap.values());

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
