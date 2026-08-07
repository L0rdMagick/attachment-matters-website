import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  addDoc,
  arrayUnion
} from 'firebase/firestore';
import { db } from './config';
import type { SharedNoteData, PrivateClinicalNoteData, NoteAmendment } from '../../types/notes';

/**
 * SHARED NOTES API
 * Clients only see notes where `clientId == request.auth.uid` AND `isPublished == true`.
 */
export async function getSharedNotesForClient(clientId: string, isTherapist: boolean = false): Promise<SharedNoteData[]> {
  const colRef = collection(db, 'sharedNotes');
  let q = query(colRef, where('clientId', '==', clientId));
  
  if (!isTherapist) {
    q = query(colRef, where('clientId', '==', clientId), where('isPublished', '==', true));
  }

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SharedNoteData));
}

export async function saveSharedNote(note: Partial<SharedNoteData>): Promise<string> {
  if (note.id) {
    const docRef = doc(db, 'sharedNotes', note.id);
    await updateDoc(docRef, {
      ...note,
      updatedAt: serverTimestamp()
    });
    return note.id;
  } else {
    const docRef = await addDoc(collection(db, 'sharedNotes'), {
      ...note,
      isPublished: note.isPublished || false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  }
}

export async function publishSharedNote(noteId: string) {
  const docRef = doc(db, 'sharedNotes', noteId);
  await updateDoc(docRef, {
    isPublished: true,
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function deleteSharedNote(noteId: string) {
  const docRef = doc(db, 'sharedNotes', noteId);
  await deleteDoc(docRef);
}

/**
 * PRIVATE CLINICAL NOTES API
 * Strictly prohibited from client access at security rule level.
 */
export async function getPrivateClinicalNotesForClient(clientId: string): Promise<PrivateClinicalNoteData[]> {
  const colRef = collection(db, 'privateClinicalNotes');
  const q = query(colRef, where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as PrivateClinicalNoteData));
}

export async function savePrivateClinicalNote(note: Partial<PrivateClinicalNoteData>): Promise<string> {
  if (note.id) {
    const docRef = doc(db, 'privateClinicalNotes', note.id);
    await updateDoc(docRef, {
      ...note,
      updatedAt: serverTimestamp()
    });
    return note.id;
  } else {
    const docRef = await addDoc(collection(db, 'privateClinicalNotes'), {
      ...note,
      isFinalized: false,
      amendments: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  }
}

export async function finalizePrivateClinicalNote(noteId: string) {
  const docRef = doc(db, 'privateClinicalNotes', noteId);
  await updateDoc(docRef, {
    isFinalized: true,
    finalizedAtISO: new Date().toISOString(),
    updatedAt: serverTimestamp()
  });
}

export async function addAmendmentToClinicalNote(noteId: string, amendment: NoteAmendment) {
  const docRef = doc(db, 'privateClinicalNotes', noteId);
  await updateDoc(docRef, {
    amendments: arrayUnion(amendment),
    updatedAt: serverTimestamp()
  });
}
