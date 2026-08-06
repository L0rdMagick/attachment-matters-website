import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getSharedNotesForClient, saveSharedNote, publishSharedNote } from '../../../lib/firebase/notes';
import type { SharedNoteData } from '../../../types/notes';

export const SharedNotesView: React.FC<{ targetClientId?: string }> = ({ targetClientId }) => {
  const { user, role } = useAuth();
  const clientId = targetClientId || user?.uid;
  const isTherapist = role === 'therapist' || role === 'admin';

  const [notes, setNotes] = useState<SharedNoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<Partial<SharedNoteData> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    async function loadNotes() {
      try {
        const data = await getSharedNotesForClient(clientId!, isTherapist);
        setNotes(data);
      } catch (err) {
        console.error("Failed to load shared notes", err);
      } finally {
        setLoading(false);
      }
    }
    loadNotes();
  }, [clientId, isTherapist]);

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote || !clientId || !user) return;
    setSaving(true);

    try {
      await saveSharedNote({
        ...editingNote,
        clientId,
        therapistId: user.uid
      });
      const updated = await getSharedNotesForClient(clientId, isTherapist);
      setNotes(updated);
      setEditingNote(null);
    } catch (err) {
      console.error("Failed to save note", err);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (noteId: string) => {
    try {
      await publishSharedNote(noteId);
      const updated = await getSharedNotesForClient(clientId!, isTherapist);
      setNotes(updated);
    } catch (err) {
      console.error("Failed to publish note", err);
    }
  };

  if (loading) {
    return <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl">Loading shared session summaries...</div>;
  }

  return (
    <div className="space-y-6 font-sans">
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif text-[#2C2A2A] font-medium">Shared Session Summaries & Resources</h2>
          <p className="text-xs text-[#2C2A2A]/70 mt-1">
            Session recaps, homework exercises, goals, and therapist-provided practice tools.
          </p>
        </div>

        {isTherapist && (
          <button
            onClick={() => setEditingNote({ title: '', recapSummary: '', homeworkAssigned: '', goalsForNextSession: '' })}
            className="px-4 py-2 bg-[#BF5B33] text-white font-semibold text-xs rounded-xl shadow-sm hover:bg-[#a64e2b] transition"
          >
            + Create Shared Note
          </button>
        )}
      </div>

      {/* Editor Modal / Form for Therapist */}
      {isTherapist && editingNote && (
        <form onSubmit={handleSaveNote} className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-serif text-[#2C2A2A] font-medium border-b border-[#EAE1D2] pb-2">
            {editingNote.id ? 'Edit Shared Summary' : 'New Shared Session Summary'}
          </h3>

          <div>
            <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Title / Focus</label>
            <input
              type="text"
              required
              value={editingNote.title || ''}
              onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
              placeholder="e.g. Grounding Exercises & Cognitive Restructuring"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Session Recap & Key Takeaways</label>
            <textarea
              rows={3}
              required
              value={editingNote.recapSummary || ''}
              onChange={(e) => setEditingNote({ ...editingNote, recapSummary: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Homework / Exercises</label>
              <textarea
                rows={2}
                value={editingNote.homeworkAssigned || ''}
                onChange={(e) => setEditingNote({ ...editingNote, homeworkAssigned: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
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

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingNote(null)}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#BF5B33] text-white text-xs font-semibold rounded-xl shadow-sm"
            >
              {saving ? 'Saving Draft...' : 'Save Draft'}
            </button>
          </div>
        </form>
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
              <div className="flex items-center justify-between border-b border-[#EAE1D2] pb-3">
                <h3 className="text-lg font-serif font-medium text-[#2C2A2A]">{note.title}</h3>
                <div className="flex items-center gap-2">
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
                      onClick={() => handlePublish(note.id!)}
                      className="px-3 py-1 bg-[#4A5741] text-white text-xs font-semibold rounded-lg hover:bg-[#384232] transition"
                    >
                      📢 Publish to Client
                    </button>
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
    </div>
  );
};
