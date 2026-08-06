import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  getPrivateClinicalNotesForClient,
  savePrivateClinicalNote,
  finalizePrivateClinicalNote,
  addAmendmentToClinicalNote
} from '../../../lib/firebase/notes';
import type { PrivateClinicalNoteData } from '../../../types/notes';

export const PrivateClinicalNotesEditor: React.FC<{ clientId: string }> = ({ clientId }) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<PrivateClinicalNoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeNote, setActiveNote] = useState<Partial<PrivateClinicalNoteData> | null>(null);
  const [saving, setSaving] = useState(false);

  const [amendmentText, setAmendmentText] = useState('');
  const [amendmentReason, setAmendmentReason] = useState('');
  const [addingAmendmentForId, setAddingAmendmentForId] = useState<string | null>(null);

  useEffect(() => {
    async function loadNotes() {
      try {
        const data = await getPrivateClinicalNotesForClient(clientId);
        setNotes(data);
      } catch (err) {
        console.error("Failed to load private clinical notes", err);
      } finally {
        setLoading(false);
      }
    }
    loadNotes();
  }, [clientId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNote || !user) return;
    setSaving(true);

    try {
      await savePrivateClinicalNote({
        ...activeNote,
        clientId,
        therapistId: user.uid
      });
      const updated = await getPrivateClinicalNotesForClient(clientId);
      setNotes(updated);
      setActiveNote(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async (noteId: string) => {
    if (!confirm("Finalizing this clinical note will lock it permanently. Subsequent corrections must be made via documented amendments. Continue?")) return;
    try {
      await finalizePrivateClinicalNote(noteId);
      const updated = await getPrivateClinicalNotesForClient(clientId);
      setNotes(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddAmendment = async (noteId: string) => {
    if (!amendmentText.trim() || !user) return;
    try {
      await addAmendmentToClinicalNote(noteId, {
        amendedAtISO: new Date().toISOString(),
        amendedByUid: user.uid,
        reason: amendmentReason || 'Clinical correction',
        additionalContent: amendmentText
      });
      const updated = await getPrivateClinicalNotesForClient(clientId);
      setNotes(updated);
      setAddingAmendmentForId(null);
      setAmendmentText('');
      setAmendmentReason('');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl">Loading private clinical notes...</div>;
  }

  return (
    <div className="space-y-6 font-sans">
      {/* HIPAA Isolation Warning Banner */}
      <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-900 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🔒</span>
          <div>
            <strong className="font-semibold text-red-700 uppercase">Strictly Confidential Clinical Records:</strong>{' '}
            <span>This section stores therapist-only DAP/SOAP notes. Deny-by-default rules prevent client access.</span>
          </div>
        </div>
        <button
          onClick={() => setActiveNote({ noteType: 'dap', dataSection: '', assessmentSection: '', planSection: '' })}
          className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white font-semibold text-xs rounded-xl transition shadow-sm shrink-0"
        >
          + New DAP Note
        </button>
      </div>

      {/* Editor Modal / Form */}
      {activeNote && (
        <form onSubmit={handleSave} className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-[#EAE1D2] pb-3">
            <h3 className="text-lg font-serif font-medium text-[#2C2A2A]">
              {activeNote.id ? 'Edit Clinical Note Draft' : 'New DAP Clinical Note'}
            </h3>
            <select
              value={activeNote.noteType || 'dap'}
              onChange={(e) => setActiveNote({ ...activeNote, noteType: e.target.value as any })}
              className="p-1.5 rounded-lg border border-[#EAE1D2] text-xs bg-white"
            >
              <option value="dap">DAP Note (Data, Assessment, Plan)</option>
              <option value="soap">SOAP Note (Subjective, Objective, Assessment, Plan)</option>
            </select>
          </div>

          {activeNote.noteType === 'dap' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">D - Data (Objective Information & Subjective Presentation)</label>
                <textarea
                  rows={3}
                  required
                  value={activeNote.dataSection || ''}
                  onChange={(e) => setActiveNote({ ...activeNote, dataSection: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                  placeholder="Client report, affect, mood, observed behaviors..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">A - Assessment (Clinical Impression & Progress toward Goals)</label>
                <textarea
                  rows={3}
                  required
                  value={activeNote.assessmentSection || ''}
                  onChange={(e) => setActiveNote({ ...activeNote, assessmentSection: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                  placeholder="Clinical synthesis, risk screening, response to intervention..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">P - Plan (Treatment Plan Adjustments & Homework)</label>
                <textarea
                  rows={2}
                  required
                  value={activeNote.planSection || ''}
                  onChange={(e) => setActiveNote({ ...activeNote, planSection: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                  placeholder="Schedule for next session, assigned exercises..."
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setActiveNote(null)}
              className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-[#BF5B33] text-white text-xs font-semibold rounded-xl shadow-sm"
            >
              {saving ? 'Saving...' : 'Save Clinical Draft'}
            </button>
          </div>
        </form>
      )}

      {/* Clinical Notes Archive */}
      <div className="space-y-4">
        {notes.length === 0 ? (
          <div className="bg-white border border-[#EAE1D2] rounded-2xl p-8 text-center text-xs text-[#2C2A2A]/60">
            No private clinical notes recorded for this client.
          </div>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[#EAE1D2] pb-3">
                <span className="text-xs font-semibold uppercase text-[#4A5741] font-mono">
                  {n.noteType.toUpperCase()} NOTE • {n.finalizedAtISO ? `Finalized ${new Date(n.finalizedAtISO).toLocaleDateString()}` : 'Draft'}
                </span>

                <div className="flex items-center gap-2">
                  {n.isFinalized ? (
                    <span className="px-2.5 py-1 bg-gray-200 text-gray-800 text-[10px] font-bold rounded-full uppercase">
                      🔒 Finalized & Locked
                    </span>
                  ) : (
                    <button
                      onClick={() => handleFinalize(n.id!)}
                      className="px-3 py-1 bg-green-700 hover:bg-green-800 text-white text-xs font-semibold rounded-lg transition"
                    >
                      ✓ Finalize Note
                    </button>
                  )}
                </div>
              </div>

              {n.dataSection && (
                <div className="text-xs text-[#2C2A2A] space-y-1">
                  <p><strong>Data:</strong> {n.dataSection}</p>
                  <p><strong>Assessment:</strong> {n.assessmentSection}</p>
                  <p><strong>Plan:</strong> {n.planSection}</p>
                </div>
              )}

              {/* Documented Amendments */}
              {n.amendments && n.amendments.length > 0 && (
                <div className="border-t border-[#EAE1D2] pt-3 space-y-2">
                  <p className="text-[11px] font-bold uppercase text-[#BF5B33]">Documented Amendments</p>
                  {n.amendments.map((a, idx) => (
                    <div key={idx} className="p-3 bg-[#F7F2E9] rounded-xl text-xs text-[#2C2A2A] border border-[#EAE1D2]">
                      <p className="font-semibold text-[11px] text-[#4A5741]">
                        Amendment #{idx + 1} ({new Date(a.amendedAtISO).toLocaleString()}) - Reason: {a.reason}
                      </p>
                      <p className="mt-1">{a.additionalContent}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Amendment Form */}
              {n.isFinalized && (
                <div className="pt-2 border-t border-[#EAE1D2]/60">
                  {addingAmendmentForId === n.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Reason for amendment..."
                        value={amendmentReason}
                        onChange={(e) => setAmendmentReason(e.target.value)}
                        className="w-full p-2 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                      />
                      <textarea
                        rows={2}
                        placeholder="Additional clinical note text..."
                        value={amendmentText}
                        onChange={(e) => setAmendmentText(e.target.value)}
                        className="w-full p-2 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setAddingAmendmentForId(null)}
                          className="px-3 py-1 bg-gray-100 text-xs font-semibold rounded-lg"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleAddAmendment(n.id!)}
                          className="px-3 py-1 bg-[#BF5B33] text-white text-xs font-semibold rounded-lg"
                        >
                          Add Documented Amendment
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingAmendmentForId(n.id!)}
                      className="text-xs font-semibold text-[#BF5B33] hover:underline"
                    >
                      + Add Documented Clinical Amendment
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
