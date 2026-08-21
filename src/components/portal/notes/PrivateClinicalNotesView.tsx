import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getClientsDirectory } from '../../../lib/firebase/clients';
import {
  getPrivateClinicalNotesForClient,
  savePrivateClinicalNote,
  finalizePrivateClinicalNote,
  addAmendmentToClinicalNote
} from '../../../lib/firebase/notes';
import type { PrivateClinicalNoteData, NoteFormat, NoteAmendment } from '../../../types/notes';
import type { ClientProfileData } from '../../../types/client';

export const PrivateClinicalNotesView: React.FC<{ targetClientId?: string }> = ({ targetClientId }) => {
  const { user, role } = useAuth();
  const isTherapist = role === 'therapist' || role === 'admin';

  const [clientList, setClientList] = useState<ClientProfileData[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(targetClientId || '');

  const activeClientId = targetClientId || (isTherapist ? selectedClientId : '');

  const [notes, setNotes] = useState<PrivateClinicalNoteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [noteFormat, setNoteFormat] = useState<NoteFormat>('DAP');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);

  // DAP Fields
  const [dapData, setDapData] = useState('');
  const [dapAssessment, setDapAssessment] = useState('');
  const [dapPlan, setDapPlan] = useState('');

  // SOAP Fields
  const [soapSubjective, setSoapSubjective] = useState('');
  const [soapObjective, setSoapObjective] = useState('');
  const [soapAssessment, setSoapAssessment] = useState('');
  const [soapPlan, setSoapPlan] = useState('');

  // Amendment modal state
  const [amendNoteId, setAmendNoteId] = useState<string | null>(null);
  const [amendmentReason, setAmendmentReason] = useState('');

  const resetForm = () => {
    setEditingNoteId(null);
    setNoteFormat('DAP');
    setSessionDate(new Date().toISOString().split('T')[0]);
    setDapData('');
    setDapAssessment('');
    setDapPlan('');
    setSoapSubjective('');
    setSoapObjective('');
    setSoapAssessment('');
    setSoapPlan('');
  };

  const handleOpenNew = () => {
    resetForm();
    setShowEditor(true);
  };

  const handleEditDraft = (note: PrivateClinicalNoteData) => {
    if (note.isFinalized) return;
    setEditingNoteId(note.id);
    setNoteFormat(note.format);
    setSessionDate(note.sessionDateISO || new Date().toISOString().split('T')[0]);
    if (note.format === 'DAP' && note.dap) {
      setDapData(note.dap.data || '');
      setDapAssessment(note.dap.assessment || '');
      setDapPlan(note.dap.plan || '');
    } else if (note.format === 'SOAP' && note.soap) {
      setSoapSubjective(note.soap.subjective || '');
      setSoapObjective(note.soap.objective || '');
      setSoapAssessment(note.soap.assessment || '');
      setSoapPlan(note.soap.plan || '');
    }
    setShowEditor(true);
  };

  useEffect(() => {
    if (isTherapist) {
      getClientsDirectory().then((list) => {
        setClientList(list);
        if (!selectedClientId && list.length > 0) {
          setSelectedClientId(targetClientId || list[0].uid);
        }
      }).catch(err => console.error("Failed to load client list for clinical notes", err));
    }
  }, [isTherapist, targetClientId]);

  useEffect(() => {
    if (!activeClientId) {
      setLoading(false);
      return;
    }
    async function loadClinicalNotes() {
      setLoading(true);
      try {
        const data = await getPrivateClinicalNotesForClient(activeClientId);
        setNotes(data);
      } catch (err) {
        console.error("Failed to load clinical notes", err);
      } finally {
        setLoading(false);
      }
    }
    loadClinicalNotes();
  }, [activeClientId]);

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClientId || !user) {
      alert("Error: Client ID or user authentication is missing.");
      return;
    }
    setSaving(true);

    try {
      const payload: Partial<PrivateClinicalNoteData> = {
        id: editingNoteId || undefined,
        clientId: activeClientId,
        therapistId: user.uid,
        sessionDateISO: sessionDate,
        format: noteFormat,
        isFinalized: false
      };

      if (noteFormat === 'DAP') {
        payload.dap = { data: dapData, assessment: dapAssessment, plan: dapPlan };
      } else if (noteFormat === 'SOAP') {
        payload.soap = { subjective: soapSubjective, objective: soapObjective, assessment: soapAssessment, plan: soapPlan };
      }

      await savePrivateClinicalNote(payload);
      const updated = await getPrivateClinicalNotesForClient(activeClientId);
      setNotes(updated);
      setShowEditor(false);
      resetForm();
    } catch (err: any) {
      console.error("Failed to save clinical note", err);
      alert(`Failed to save private clinical note: ${err.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async (noteId: string) => {
    if (!confirm("Are you sure you want to finalize this clinical note? Finalized notes cannot be edited, only amended.")) return;
    try {
      await finalizePrivateClinicalNote(noteId);
      const updated = await getPrivateClinicalNotesForClient(activeClientId);
      setNotes(updated);
    } catch (err) {
      console.error("Failed to finalize note", err);
    }
  };

  const handleAddAmendment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amendNoteId || !amendmentReason.trim() || !user) return;
    try {
      const amendment: NoteAmendment = {
        timestampISO: new Date().toISOString(),
        authorUid: user.uid,
        reason: amendmentReason,
        content: amendmentReason
      };
      await addAmendmentToClinicalNote(amendNoteId, amendment);
      const updated = await getPrivateClinicalNotesForClient(activeClientId);
      setNotes(updated);
      setAmendNoteId(null);
      setAmendmentReason('');
    } catch (err) {
      console.error("Failed to add amendment", err);
    }
  };

  if (!isTherapist) {
    return <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl text-xs text-red-600 font-semibold">Access Restricted: Clinical notes are restricted to authorized clinical staff.</div>;
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif text-[#2C2A2A] font-medium">Private Clinical Notes (DAP / SOAP)</h2>
          <p className="text-xs text-[#2C2A2A]/70 mt-1">
            HIPAA-compliant, confidential progress notes. Prohibited from client access at security rule level.
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="w-full sm:w-auto px-4 py-3 bg-[#BF5B33] text-white font-semibold text-xs rounded-xl shadow-sm hover:bg-[#a64e2b] transition min-h-[44px] flex items-center justify-center"
        >
          + Write New Clinical Note
        </button>
      </div>

      {/* Client Selector Dropdown */}
      {!targetClientId && (
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <label htmlFor="clinical-client-select" className="text-xs font-semibold uppercase text-[#2C2A2A]">
            Select Client Chart:
          </label>
          <select
            id="clinical-client-select"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="p-2.5 rounded-xl border border-[#EAE1D2] text-xs font-medium bg-white text-[#2C2A2A] max-w-sm w-full outline-none focus:ring-2 focus:ring-[#BF5B33]/20 min-h-[42px]"
          >
            {clientList.length === 0 ? (
              <option value="">No clients found</option>
            ) : (
              clientList.map((c) => (
                <option key={c.uid} value={c.uid}>
                  {c.legalFirstName} {c.legalLastName} ({c.email || 'No Email'})
                </option>
              ))
            )}
          </select>
        </div>
      )}

      {/* New / Edit Note Form */}
      {showEditor && (
        <form onSubmit={handleSaveNote} className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#EAE1D2] pb-3">
            <h3 className="text-lg font-serif text-[#2C2A2A] font-medium">
              {editingNoteId ? 'Edit Draft Clinical Note' : 'New Confidential Progress Note'}
            </h3>
            <button type="button" onClick={() => setShowEditor(false)} className="text-xs text-gray-500 hover:text-gray-800">Cancel</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Session Date</label>
              <input
                type="date"
                required
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Format Type</label>
              <select
                value={noteFormat}
                onChange={(e) => setNoteFormat(e.target.value as NoteFormat)}
                className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs bg-white"
              >
                <option value="DAP">DAP (Data, Assessment, Plan)</option>
                <option value="SOAP">SOAP (Subjective, Objective, Assessment, Plan)</option>
              </select>
            </div>
          </div>

          {noteFormat === 'DAP' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Data (Subjective & Objective Clinical Data)</label>
                <textarea
                  required
                  rows={3}
                  value={dapData}
                  onChange={(e) => setDapData(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#EAE1D2] text-xs outline-none focus:ring-2 focus:ring-[#BF5B33]/20"
                  placeholder="Client presentation, reported symptoms, emotional state, session content..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Assessment (Clinical Impression & Risk Evaluation)</label>
                <textarea
                  required
                  rows={3}
                  value={dapAssessment}
                  onChange={(e) => setDapAssessment(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#EAE1D2] text-xs outline-none focus:ring-2 focus:ring-[#BF5B33]/20"
                  placeholder="Clinical analysis, progress toward treatment goals, risk assessment..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Plan (Interventions & Future Directions)</label>
                <textarea
                  required
                  rows={2}
                  value={dapPlan}
                  onChange={(e) => setDapPlan(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#EAE1D2] text-xs outline-none focus:ring-2 focus:ring-[#BF5B33]/20"
                  placeholder="Planned therapeutic interventions, homework, next scheduled appointment..."
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Subjective (Client Report)</label>
                <textarea
                  required
                  rows={2}
                  value={soapSubjective}
                  onChange={(e) => setSoapSubjective(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                  placeholder="Direct quotes, reported concerns, subjective experience..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Objective (Clinician Observations)</label>
                <textarea
                  required
                  rows={2}
                  value={soapObjective}
                  onChange={(e) => setSoapObjective(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                  placeholder="Mental status exam, affect, motor behavior, observable symptoms..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Assessment (Diagnostic & Clinical Synthesis)</label>
                <textarea
                  required
                  rows={2}
                  value={soapAssessment}
                  onChange={(e) => setSoapAssessment(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                  placeholder="Clinical synthesis, diagnostic impression, treatment response..."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Plan (Treatment Plan Updates)</label>
                <textarea
                  required
                  rows={2}
                  value={soapPlan}
                  onChange={(e) => setSoapPlan(e.target.value)}
                  className="w-full p-3 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                  placeholder="Frequency, referral needs, homework, follow-up..."
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowEditor(false)}
              className="px-4 py-2 border border-[#EAE1D2] text-xs rounded-xl hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#BF5B33] text-white text-xs font-semibold rounded-xl hover:bg-[#a64e2b] disabled:opacity-50 transition"
            >
              {saving ? 'Saving Note...' : (editingNoteId ? 'Update Draft Note' : 'Save Draft Note')}
            </button>
          </div>
        </form>
      )}

      {/* Note Timeline */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl">Loading clinical progress notes...</div>
        ) : notes.length === 0 ? (
          <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl text-xs text-[#2C2A2A]/60">
            No clinical progress notes recorded for this client chart yet. Click "+ Write New Clinical Note" to begin documentation.
          </div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[#EAE1D2] pb-2">
                <div className="flex items-center gap-3">
                  <span className="font-serif font-bold text-sm text-[#2C2A2A]">
                    Session: {note.sessionDateISO || 'Date Unspecified'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#F7F2E9] text-[#BF5B33] border border-[#EAE1D2]">
                    {note.format} Note
                  </span>
                  {note.isFinalized ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-green-50 text-green-700 border border-green-200">
                      Finalized
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-yellow-50 text-yellow-700 border border-yellow-200">
                      Draft
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!note.isFinalized && (
                    <>
                      <button
                        onClick={() => handleEditDraft(note)}
                        className="px-3 py-1 bg-amber-700 text-white text-xs font-medium rounded-lg hover:bg-amber-800 transition"
                      >
                        ✏️ Edit Draft
                      </button>
                      <button
                        onClick={() => handleFinalize(note.id)}
                        className="px-3 py-1 bg-emerald-700 text-white text-xs font-medium rounded-lg hover:bg-emerald-800 transition"
                      >
                        ✓ Finalize Note
                      </button>
                    </>
                  )}
                  {note.isFinalized && (
                    <button
                      onClick={() => setAmendNoteId(note.id)}
                      className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition"
                    >
                      + Add Amendment
                    </button>
                  )}
                </div>
              </div>

              {note.format === 'DAP' && note.dap && (
                <div className="space-y-2 text-xs text-[#2C2A2A]">
                  <div>
                    <span className="font-bold text-[#4A5741] uppercase">Data:</span>
                    <p className="mt-0.5 whitespace-pre-wrap">{note.dap.data}</p>
                  </div>
                  <div>
                    <span className="font-bold text-[#4A5741] uppercase">Assessment:</span>
                    <p className="mt-0.5 whitespace-pre-wrap">{note.dap.assessment}</p>
                  </div>
                  <div>
                    <span className="font-bold text-[#4A5741] uppercase">Plan:</span>
                    <p className="mt-0.5 whitespace-pre-wrap">{note.dap.plan}</p>
                  </div>
                </div>
              )}

              {note.format === 'SOAP' && note.soap && (
                <div className="space-y-2 text-xs text-[#2C2A2A]">
                  <div>
                    <span className="font-bold text-[#4A5741] uppercase">Subjective:</span>
                    <p className="mt-0.5 whitespace-pre-wrap">{note.soap.subjective}</p>
                  </div>
                  <div>
                    <span className="font-bold text-[#4A5741] uppercase">Objective:</span>
                    <p className="mt-0.5 whitespace-pre-wrap">{note.soap.objective}</p>
                  </div>
                  <div>
                    <span className="font-bold text-[#4A5741] uppercase">Assessment:</span>
                    <p className="mt-0.5 whitespace-pre-wrap">{note.soap.assessment}</p>
                  </div>
                  <div>
                    <span className="font-bold text-[#4A5741] uppercase">Plan:</span>
                    <p className="mt-0.5 whitespace-pre-wrap">{note.soap.plan}</p>
                  </div>
                </div>
              )}

              {note.amendments && note.amendments.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#EAE1D2] space-y-2 bg-[#F7F2E9] p-3 rounded-xl">
                  <span className="text-[10px] font-bold uppercase text-[#BF5B33]">Amendments Audit Log:</span>
                  {note.amendments.map((a, idx) => (
                    <div key={idx} className="text-xs text-gray-700">
                      <span className="font-semibold">{new Date(a.timestampISO).toLocaleDateString()}: </span>
                      <span>{a.content}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Amendment Modal */}
      {amendNoteId && (
        <form onSubmit={handleAddAmendment} className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-lg font-serif text-[#2C2A2A] font-medium border-b pb-2">Add Clinical Amendment</h3>
            <div>
              <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Amendment Detail / Reason</label>
              <textarea
                required
                rows={3}
                value={amendmentReason}
                onChange={(e) => setAmendmentReason(e.target.value)}
                className="w-full p-3 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                placeholder="Enter formal amendment rationale..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAmendNoteId(null)} className="px-4 py-2 border rounded-xl text-xs">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-[#BF5B33] text-white text-xs font-semibold rounded-xl">Add Permanent Amendment</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
