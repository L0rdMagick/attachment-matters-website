import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getSharedNotesForClient, saveSharedNote, publishSharedNote, deleteSharedNote } from '../../../lib/firebase/notes';
import { getClientsDirectory } from '../../../lib/firebase/clients';
import type { SharedNoteData } from '../../../types/notes';
import type { ClientProfileData } from '../../../types/client';
import { PortalConfirmModal } from '../common/PortalConfirmModal';
import { PortalClientSelector } from '../common/PortalClientSelector';

export const SharedNotesView: React.FC<{ targetClientId?: string }> = ({ targetClientId }) => {
  const { user, role } = useAuth();
  const isTherapist = role === 'therapist' || role === 'admin';

  const [clientList, setClientList] = useState<ClientProfileData[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(targetClientId || '');

  const activeClientId = targetClientId || (isTherapist ? selectedClientId : user?.uid);

  const [notes, setNotes] = useState<SharedNoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<Partial<SharedNoteData> | null>(null);
  const [saving, setSaving] = useState(false);

  // Portal Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
    icon?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info' | 'success';
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, isOpen: false }));

  useEffect(() => {
    if (isTherapist) {
      getClientsDirectory().then((list) => {
        setClientList(list);
        if (!selectedClientId && list.length > 0) {
          setSelectedClientId(targetClientId || list[0].uid);
        }
      }).catch(err => console.error("Failed to load clients for shared notes", err));
    }
  }, [isTherapist, targetClientId]);

  useEffect(() => {
    if (!activeClientId) {
      setLoading(false);
      return;
    }
    async function loadNotes() {
      setLoading(true);
      try {
        const data = await getSharedNotesForClient(activeClientId!, isTherapist);
        setNotes(data);
      } catch (err) {
        console.error("Failed to load shared notes", err);
      } finally {
        setLoading(false);
      }
    }
    loadNotes();
  }, [activeClientId, isTherapist]);

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote || !activeClientId || !user) return;
    setSaving(true);

    try {
      await saveSharedNote({
        ...editingNote,
        clientId: activeClientId,
        therapistId: user.uid
      });
      const updated = await getSharedNotesForClient(activeClientId, isTherapist);
      setNotes(updated);
      setEditingNote(null);
    } catch (err) {
      console.error("Failed to save note", err);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (noteId: string) => {
    if (!activeClientId) return;
    try {
      await publishSharedNote(noteId);
      const updated = await getSharedNotesForClient(activeClientId, isTherapist);
      setNotes(updated);
    } catch (err) {
      console.error("Failed to publish note", err);
    }
  };

  const handleDeleteNote = (noteId: string) => {
    if (!activeClientId) return;
    setConfirmModal({
      isOpen: true,
      title: '🗑️ Delete Shared Summary',
      message: 'Are you sure you want to delete this shared session summary note?',
      details: 'This will remove the summary from the client portal.',
      icon: '🗑️',
      confirmText: 'Delete Summary',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await deleteSharedNote(noteId);
          const updated = await getSharedNotesForClient(activeClientId, isTherapist);
          setNotes(updated);
        } catch (err) {
          console.error("Failed to delete shared note", err);
        }
      },
      onCancel: closeConfirmModal
    });
  };

  if (loading) {
    return <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl">Loading shared session summaries...</div>;
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif text-[#2C2A2A] font-medium">Shared Session Summaries</h2>
          <p className="text-xs text-[#2C2A2A]/70 mt-1">
            Session recaps, homework exercises, goals, and therapist-provided practice tools.
          </p>
        </div>

        {isTherapist && (
          <button
            onClick={() => setEditingNote({
              title: '',
              recapSummary: '',
              homeworkAssigned: '',
              goalsForNextSession: '',
              startDate: new Date().toISOString().split('T')[0],
              endDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
            })}
            className="w-full sm:w-auto px-4 py-3 bg-[#BF5B33] text-white font-semibold text-xs rounded-xl shadow-sm hover:bg-[#a64e2b] transition min-h-[44px] flex items-center justify-center"
          >
            + Create Shared Note
          </button>
        )}
      </div>

      {isTherapist && !targetClientId && (
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase text-[#2C2A2A]">
            Active Client for Shared Summaries & Homework:
          </span>
          <PortalClientSelector
            clients={clientList}
            selectedClientId={selectedClientId}
            onSelectClient={(id) => setSelectedClientId(id)}
          />
        </div>
      )}

      {/* Shared Summary Editor Overlay Modal */}
      {isTherapist && editingNote && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-fade-in">
          <div className="bg-[#F7F2E9] border border-[#EAE1D2] rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#EAE1D2] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">📢</span>
                <h3 className="text-lg font-serif text-[#2C2A2A] font-medium">
                  {editingNote.id ? 'Edit Shared Summary' : 'New Shared Session Summary'}
                </h3>
              </div>
              <button type="button" onClick={() => setEditingNote(null)} className="text-gray-400 hover:text-gray-600 font-bold text-sm">✕</button>
            </div>

            <form onSubmit={handleSaveNote} className="space-y-4 bg-white p-5 rounded-xl border border-[#EAE1D2]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={editingNote.startDate || ''}
                    onChange={(e) => setEditingNote({ ...editingNote, startDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Goal Due Date (End Date)</label>
                  <input
                    type="date"
                    value={editingNote.endDate || ''}
                    onChange={(e) => setEditingNote({ ...editingNote, endDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Title / Focus</label>
                  <input
                    type="text"
                    required
                    value={editingNote.title || ''}
                    onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                    placeholder="e.g. Grounding Exercises & Co-Regulation"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Key Takeaways & Session Insights</label>
                  <textarea
                    required
                    rows={3}
                    value={editingNote.recapSummary || ''}
                    onChange={(e) => setEditingNote({ ...editingNote, recapSummary: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                    placeholder="Bullet points or summary of therapeutic progress discussed during session..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Homework & Action Items Assigned</label>
                  <textarea
                    rows={2}
                    value={editingNote.homeworkAssigned || ''}
                    onChange={(e) => setEditingNote({ ...editingNote, homeworkAssigned: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                    placeholder="Worksheets, exercises, practice tasks assigned to client..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Goals for Next Session</label>
                  <textarea
                    rows={2}
                    value={editingNote.goalsForNextSession || ''}
                    onChange={(e) => setEditingNote({ ...editingNote, goalsForNextSession: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#EAE1D2]">
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
                  className="px-4 py-2 bg-[#EAE1D2] hover:bg-[#e0d4c1] text-[#2C2A2A] font-semibold text-xs rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#BF5B33] text-white text-xs font-semibold rounded-xl hover:bg-[#a64e2b] disabled:opacity-50 transition shadow-xs"
                >
                  {saving ? 'Saving Summary...' : 'Save Summary'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notes List */}
      <div className="space-y-4">
        {notes.length === 0 ? (
          <div className="bg-white border border-[#EAE1D2] rounded-2xl p-8 text-center text-xs text-[#2C2A2A]/60">
            No shared session summaries available yet.
          </div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EAE1D2] pb-3 gap-2">
                <div>
                  <h3 className="text-lg font-serif font-medium text-[#2C2A2A]">{note.title}</h3>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                    {note.startDate && <span>📅 Start: <strong>{note.startDate}</strong></span>}
                    {note.endDate && <span className="text-[#BF5B33]">🎯 Goal Due: <strong>{note.endDate}</strong></span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {!note.isPublished ? (
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full uppercase">
                      Draft (Hidden from Client)
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 bg-green-100 text-green-800 text-[10px] font-bold rounded-full uppercase">
                      Published
                    </span>
                  )}

                  {isTherapist && !note.isPublished && (
                    <button
                      onClick={() => {
                        showConfirm({
                          title: '📢 Publish Session Summary',
                          message: `Are you sure you want to publish "${note.title}" to the client portal?`,
                          details: 'Once published, this summary will be visible to the client when they log into their portal.',
                          icon: '📢',
                          confirmText: 'Yes, Publish Note',
                          cancelText: 'Keep as Draft',
                          variant: 'info',
                          onConfirm: () => handlePublish(note.id!)
                        });
                      }}
                      className="px-3 py-1 bg-[#4A5741] text-white text-xs font-semibold rounded-lg hover:bg-[#384232] transition"
                    >
                      📢 Publish to Client
                    </button>
                  )}

                  {isTherapist && (
                    <>
                      <button
                        onClick={() => setEditingNote(note)}
                        className="px-3 py-1 border border-[#EAE1D2] text-[#2C2A2A] text-xs font-semibold rounded-lg hover:bg-[#F7F2E9] transition"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id!)}
                        className="px-3 py-1 bg-red-50 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-100 transition"
                      >
                        🗑️ Delete
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="text-xs text-[#2C2A2A] space-y-2">
                <p><strong>Recap:</strong> {note.recapSummary}</p>
                {note.homeworkAssigned && <p><strong>Homework:</strong> {note.homeworkAssigned}</p>}
                {note.goalsForNextSession && <p><strong>Goals:</strong> {note.goalsForNextSession}</p>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Portal Confirm Modal */}
      <PortalConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        details={confirmModal.details}
        icon={confirmModal.icon}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={confirmModal.onCancel || closeConfirmModal}
      />
    </div>
  );
};
