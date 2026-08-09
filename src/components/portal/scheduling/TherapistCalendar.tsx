import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  getAppointments,
  updateAppointmentStatus,
  bookAppointmentWithLock,
  rescheduleAppointment,
  getAvailabilityRules,
  checkTherapistSlotAvailability,
  getAvailableTimeSlots,
  DEFAULT_AVAILABILITY_RULES
} from '../../../lib/firebase/scheduling';
import { getClientsDirectory } from '../../../lib/firebase/clients';
import type { AppointmentData, AppointmentStatus, AvailabilityRules } from '../../../types/scheduling';
import type { ClientProfileData } from '../../../types/client';

export const TherapistCalendar: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [clientList, setClientList] = useState<ClientProfileData[]>([]);
  const [rules, setRules] = useState<AvailabilityRules>(DEFAULT_AVAILABILITY_RULES);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'agenda'>('agenda');
  const [statusTab, setStatusTab] = useState<'upcoming' | 'history'>('upcoming');
  const [loading, setLoading] = useState(true);

  // Scheduling Modal State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [schedType, setSchedType] = useState(DEFAULT_AVAILABILITY_RULES.appointmentTypes[0]);
  const [schedDate, setSchedDate] = useState(new Date().toISOString().split('T')[0]);
  const [schedTime, setSchedTime] = useState('09:00');
  const [schedFormat, setSchedFormat] = useState<'telehealth' | 'in_person'>('telehealth');
  const [schedNote, setSchedNote] = useState('');
  const [schedBooking, setSchedBooking] = useState(false);
  const [schedMessage, setSchedMessage] = useState<string | null>(null);

  // Modals state for therapist
  const [noticeModal, setNoticeModal] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [cancelModalAppt, setCancelModalAppt] = useState<AppointmentData | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [canceling, setCanceling] = useState(false);

  const [rescheduleModalAppt, setRescheduleModalAppt] = useState<AppointmentData | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState(new Date().toISOString().split('T')[0]);
  const [rescheduleSlot, setRescheduleSlot] = useState<string | null>(null);
  const [rescheduleNote, setRescheduleNote] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  useEffect(() => {
    async function loadAppts() {
      try {
        const [data, clients, r] = await Promise.all([
          getAppointments({ therapistId: 'default_therapist' }),
          getClientsDirectory(),
          getAvailabilityRules(user?.uid || 'default')
        ]);
        setAppointments(data);
        setClientList(clients);
        if (r) {
          setRules(r);
          if (r.appointmentTypes && r.appointmentTypes.length > 0) {
            setSchedType(r.appointmentTypes[0]);
          }
        }
        if (clients.length > 0) {
          setSelectedClientId(clients[0].uid);
        }
      } catch (err) {
        console.error("Failed to load therapist appointments", err);
      } finally {
        setLoading(false);
      }
    }
    loadAppts();
  }, [user]);

  const handleStatusChange = async (apptId: string, newStatus: AppointmentStatus) => {
    try {
      await updateAppointmentStatus(apptId, newStatus);
      const updated = await getAppointments({ therapistId: 'default_therapist' });
      setAppointments(updated);
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  const openCancelModal = (appt: AppointmentData) => {
    setCancelModalAppt(appt);
    setCancelReasonInput('');
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalAppt) return;
    setCanceling(true);
    try {
      const reasonText = cancelReasonInput.trim() || 'Canceled by practice therapist';
      await updateAppointmentStatus(cancelModalAppt.id!, 'canceled_by_practice', reasonText);
      const updated = await getAppointments({ therapistId: 'default_therapist' });
      setAppointments(updated);
      setCancelModalAppt(null);

      setNoticeModal({
        title: "Session Canceled",
        message: `The session with ${cancelModalAppt.clientName || 'Client'} scheduled for ${new Date(cancelModalAppt.startISO).toLocaleString()} has been canceled.`,
        type: "info"
      });
    } catch (err) {
      console.error("Failed to cancel session", err);
    } finally {
      setCanceling(false);
    }
  };

  const openRescheduleModal = (appt: AppointmentData) => {
    setRescheduleModalAppt(appt);
    setRescheduleDate(appt.startISO.split('T')[0]);
    setRescheduleSlot(null);
    setRescheduleNote(appt.notes || '');
  };

  const rescheduleApptType = rules.appointmentTypes.find(t => t.id === rescheduleModalAppt?.appointmentTypeId) || schedType;
  const { slots: rescheduleAvailableSlots, reason: rescheduleClosedReason } = getAvailableTimeSlots(
    rescheduleDate,
    rules,
    appointments.filter(a => a.id !== rescheduleModalAppt?.id),
    rescheduleApptType?.durationMinutes || 50,
    rescheduleApptType?.bufferBeforeMinutes || 0,
    rescheduleApptType?.bufferAfterMinutes || 0
  );

  const rescheduleAvailCheck = (rescheduleModalAppt && rescheduleSlot) ? checkTherapistSlotAvailability(
    rescheduleDate,
    rescheduleSlot,
    rescheduleApptType?.durationMinutes || 50,
    rules,
    appointments.filter(a => a.id !== rescheduleModalAppt.id),
    rescheduleApptType?.bufferBeforeMinutes || 0,
    rescheduleApptType?.bufferAfterMinutes || 0
  ) : { isAvailable: true };

  const handleConfirmReschedule = async () => {
    if (!rescheduleModalAppt || !rescheduleSlot) return;
    setRescheduling(true);
    try {
      const startISO = `${rescheduleDate}T${rescheduleSlot}:00`;
      const dur = rescheduleApptType?.durationMinutes || 50;
      const endISO = new Date(new Date(startISO).getTime() + dur * 60000).toISOString();
      const existingNotes = rescheduleModalAppt.notes || '';
      const extraNote = rescheduleNote.trim();
      let finalNotes: string | undefined = existingNotes || undefined;
      if (extraNote) {
        finalNotes = existingNotes ? `${existingNotes}\n[Rescheduled Note]: ${extraNote}` : extraNote;
      }

      await rescheduleAppointment(rescheduleModalAppt.id!, startISO, endISO, finalNotes, 'rescheduled');
      const updated = await getAppointments({ therapistId: 'default_therapist' });
      setAppointments(updated);
      setRescheduleModalAppt(null);

      setNoticeModal({
        title: "Session Rescheduled",
        message: `Session for ${rescheduleModalAppt.clientName || 'Client'} successfully rescheduled to ${new Date(startISO).toLocaleString()}.`,
        type: "success"
      });
    } catch (err: any) {
      console.error("Failed to reschedule session", err);
      alert(err.message || "Failed to reschedule session.");
    } finally {
      setRescheduling(false);
    }
  };

  const handleScheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      setSchedMessage("Please select a client.");
      return;
    }
    setSchedBooking(true);
    setSchedMessage(null);

    const availCheck = checkTherapistSlotAvailability(
      schedDate,
      schedTime,
      schedType?.durationMinutes || 50,
      rules,
      appointments,
      schedType?.bufferBeforeMinutes || 0,
      schedType?.bufferAfterMinutes || 0
    );

    if (!availCheck.isAvailable) {
      const proceed = confirm(
        `⚠️ OVERRIDE PRACTICE AVAILABILITY WARNING:\n\n${availCheck.reason}\n\nDo you want to override your practice settings and schedule this session anyway?`
      );
      if (!proceed) {
        setSchedBooking(false);
        return;
      }
    }

    const startISO = `${schedDate}T${schedTime}:00`;
    const endISO = new Date(new Date(startISO).getTime() + (schedType?.durationMinutes || 50) * 60000).toISOString();
    const selectedClientObj = clientList.find(c => c.uid === selectedClientId);

    try {
      await bookAppointmentWithLock({
        clientId: selectedClientId,
        clientName: selectedClientObj ? `${selectedClientObj.legalFirstName} ${selectedClientObj.legalLastName}` : undefined,
        clientEmail: selectedClientObj?.email || undefined,
        therapistId: 'default_therapist',
        appointmentTypeId: schedType.id,
        appointmentTypeName: schedType.name,
        startISO,
        endISO,
        timezone: rules.timezone || 'America/Chicago',
        format: schedFormat,
        locationOrLink: schedFormat === 'telehealth' ? 'https://familytrusttherapy.com/telehealth-room' : '123 Practice Way, Suite 100',
        status: 'confirmed',
        notes: schedNote.trim() || undefined,
        priceInCents: schedType.priceInCents,
        syncStatus: 'pending'
      });

      const updated = await getAppointments({ therapistId: 'default_therapist' });
      setAppointments(updated);
      setShowScheduleModal(false);
      setSchedNote('');

      setNoticeModal({
        title: "Appointment Scheduled",
        message: `Clinical session (${schedType.name}) for ${selectedClientObj ? `${selectedClientObj.legalFirstName} ${selectedClientObj.legalLastName}` : 'Client'} booked for ${new Date(startISO).toLocaleString()}.`,
        type: "success"
      });
    } catch (err: any) {
      console.error(err);
      setSchedMessage(err.message || "Failed to schedule appointment.");
    } finally {
      setSchedBooking(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl">Loading clinical calendar...</div>;
  }

  const upcomingAppts = appointments.filter(a => a.status === 'confirmed' || a.status === 'requested' || a.status === 'rescheduled');
  const historyAppts = appointments.filter(a => a.status === 'completed' || a.status.startsWith('canceled'));
  const displayedAppts = statusTab === 'upcoming' ? upcomingAppts : historyAppts;

  return (
    <div className="space-y-6 font-sans relative">
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-[#2C2A2A] font-medium">Therapist Clinical Calendar</h2>
          <p className="text-xs text-[#2C2A2A]/70 mt-1">
            Manage daily schedule, client sessions, and two-way Google Calendar synchronization.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowScheduleModal(true)}
            className="px-4 py-2 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            + Schedule Client Session
          </button>
          <div className="flex bg-[#F7F2E9] p-1 rounded-xl border border-[#EAE1D2] text-xs font-semibold">
            {(['agenda', 'day', 'week', 'month'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-lg capitalize transition ${
                  viewMode === mode ? 'bg-[#BF5B33] text-white shadow-sm' : 'text-[#2C2A2A]/70 hover:text-[#2C2A2A]'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#EAE1D2] pb-3">
          <h3 className="text-lg font-serif text-[#2C2A2A] font-medium">
            Session Agenda ({displayedAppts.length})
          </h3>
          <div className="flex bg-[#F7F2E9] p-1 rounded-xl border border-[#EAE1D2] text-xs font-semibold">
            <button
              onClick={() => setStatusTab('upcoming')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusTab === 'upcoming' ? 'bg-[#BF5B33] text-white shadow-sm' : 'text-[#2C2A2A]/70 hover:text-[#2C2A2A]'
              }`}
            >
              Scheduled Sessions ({upcomingAppts.length})
            </button>
            <button
              onClick={() => setStatusTab('history')}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusTab === 'history' ? 'bg-[#BF5B33] text-white shadow-sm' : 'text-[#2C2A2A]/70 hover:text-[#2C2A2A]'
              }`}
            >
              Completed & History ({historyAppts.length})
            </button>
          </div>
        </div>

        {displayedAppts.length === 0 ? (
          <p className="text-xs text-[#2C2A2A]/60 py-8 text-center">
            {statusTab === 'upcoming' ? 'No active upcoming sessions scheduled.' : 'No completed or past session history found.'}
          </p>
        ) : (
          <div className="space-y-3">
            {displayedAppts.map((a) => {
              const matchedClient = clientList.find(c => c.uid === a.clientId);
              const displayName = a.clientName || (matchedClient ? `${matchedClient.legalFirstName} ${matchedClient.legalLastName}` : `Client ID: ${a.clientId.slice(0, 8)}...`);
              const displayEmail = a.clientEmail || matchedClient?.email;

              return (
                <div key={a.id} className="p-4 bg-[#F7F2E9] rounded-xl border border-[#EAE1D2] flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-[#2C2A2A]">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{a.appointmentTypeName}</span>
                      <span className="bg-[#BF5B33]/15 text-[#BF5B33] px-2.5 py-0.5 rounded-md font-bold text-xs">
                        👤 Client: {displayName} {displayEmail ? `(${displayEmail})` : ''}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        a.status === 'completed' ? 'bg-green-100 text-green-800 border border-green-200' :
                        a.status === 'confirmed' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                        a.status === 'rescheduled' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                        a.status === 'requested' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {a.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="mt-1">
                      <strong>Time:</strong> {new Date(a.startISO).toLocaleString()} | <strong>Format:</strong> <span className="capitalize">{a.format}</span>
                    </p>
                    {a.notes && (
                      <p className="text-[11px] bg-white/90 p-2 rounded-lg border border-[#EAE1D2] text-[#2C2A2A] italic mt-1 whitespace-pre-line">
                        <strong>Note:</strong> {a.notes}
                      </p>
                    )}
                    {a.cancellationReason && (
                      <p className="text-[11px] bg-red-50 p-2 rounded-lg border border-red-200 text-red-900 mt-1">
                        <strong>Cancellation Reason:</strong> {a.cancellationReason}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {a.status !== 'completed' && (
                      <button
                        onClick={() => handleStatusChange(a.id!, 'completed')}
                        className="px-3 py-1.5 bg-[#4A5741] text-white font-semibold rounded-lg hover:bg-[#384232] transition"
                      >
                        ✓ Mark Completed
                      </button>
                    )}
                    {a.status === 'confirmed' || a.status === 'requested' || a.status === 'rescheduled' ? (
                      <button
                        onClick={() => openRescheduleModal(a)}
                        className="px-3 py-1.5 bg-[#BF5B33] text-white font-semibold rounded-lg hover:bg-[#a64e2b] transition"
                      >
                        Reschedule
                      </button>
                    ) : null}
                    {a.status !== 'canceled_by_practice' && a.status !== 'canceled_by_client' && (
                      <button
                        onClick={() => openCancelModal(a)}
                        className="px-3 py-1.5 border border-red-300 text-red-700 font-semibold rounded-lg hover:bg-red-50 transition"
                      >
                        Cancel Session
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto font-sans">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-[#EAE1D2]">
            <div className="flex justify-between items-center border-b border-[#EAE1D2] pb-3">
              <h3 className="text-lg font-serif font-medium text-[#2C2A2A]">Schedule Client Clinical Session</h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-gray-400 hover:text-gray-600 font-bold text-sm">✕</button>
            </div>
            {schedMessage && <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-medium">{schedMessage}</div>}
            <form onSubmit={handleScheduleAppointment} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Assign To Client</label>
                <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-white text-xs text-[#2C2A2A] font-medium">
                  {clientList.length === 0 ? <option value="">No clients found</option> : clientList.map((c) => <option key={c.uid} value={c.uid}>{c.legalFirstName} {c.legalLastName} ({c.email || 'No Email'})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Select Appointment Type</label>
                <select value={schedType.id} onChange={(e) => { const found = rules.appointmentTypes.find(t => t.id === e.target.value); if (found) { setSchedType(found); if (found.format === 'telehealth') setSchedFormat('telehealth'); else if (found.format === 'in_person') setSchedFormat('in_person'); } }} className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-white text-xs text-[#2C2A2A] font-medium">
                  {rules.appointmentTypes.map((type) => <option key={type.id} value={type.id}>{type.name} ({type.durationMinutes} min • ${(type.priceInCents / 100).toFixed(2)})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Date</label>
                  <input type="date" required value={schedDate} onChange={(e) => setSchedDate(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Start Time Slot</label>
                  <select value={schedTime} onChange={(e) => setSchedTime(e.target.value)} className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-white text-xs text-[#2C2A2A] font-medium">
                    {['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'].map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Service Format</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setSchedFormat('telehealth')} className={`py-2 rounded-xl text-xs font-semibold border transition ${schedFormat === 'telehealth' ? 'bg-[#BF5B33] text-white border-[#BF5B33]' : 'bg-[#F7F2E9] text-[#2C2A2A] border-[#EAE1D2]'}`}>💻 Telehealth</button>
                  <button type="button" onClick={() => setSchedFormat('in_person')} className={`py-2 rounded-xl text-xs font-semibold border transition ${schedFormat === 'in_person' ? 'bg-[#BF5B33] text-white border-[#BF5B33]' : 'bg-[#F7F2E9] text-[#2C2A2A] border-[#EAE1D2]'}`}>🏢 In-Person Office</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Appointment Note (Optional)</label>
                <textarea rows={2} value={schedNote} onChange={(e) => setSchedNote(e.target.value)} placeholder="Add note for this appointment..." className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-white text-xs text-[#2C2A2A]" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-[#EAE1D2]">
                <button type="button" onClick={() => setShowScheduleModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl">Cancel</button>
                <button type="submit" disabled={schedBooking} className="px-5 py-2 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl shadow-sm disabled:opacity-50 transition">{schedBooking ? 'Booking...' : 'Book & Confirm Appointment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {noticeModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4 text-center">
            <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center text-xl font-bold ${noticeModal.type === 'success' ? 'bg-green-100 text-green-700' : noticeModal.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
              {noticeModal.type === 'success' ? '✓' : noticeModal.type === 'error' ? '✕' : 'ℹ'}
            </div>
            <h3 className="text-xl font-serif text-[#2C2A2A] font-medium">{noticeModal.title}</h3>
            <p className="text-xs text-[#2C2A2A]/80 leading-relaxed">{noticeModal.message}</p>
            <button onClick={() => setNoticeModal(null)} className="w-full py-2.5 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-semibold text-xs rounded-xl transition">Dismiss Notice</button>
          </div>
        </div>
      )}

      {cancelModalAppt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-xl font-serif text-[#2C2A2A] font-medium border-b border-[#EAE1D2] pb-2">Cancel Session</h3>
            <p className="text-xs text-[#2C2A2A]/80">Please enter the cancellation reason for session with <strong>{cancelModalAppt.clientName || 'Client'}</strong> scheduled on {new Date(cancelModalAppt.startISO).toLocaleString()}.</p>
            <div>
              <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Reason for Cancellation</label>
              <textarea rows={3} value={cancelReasonInput} onChange={(e) => setCancelReasonInput(e.target.value)} placeholder="e.g. Therapist emergency, client requested cancellation..." className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs bg-white text-[#2C2A2A]" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setCancelModalAppt(null)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#2C2A2A] font-semibold text-xs rounded-xl transition">Go Back</button>
              <button type="button" disabled={canceling} onClick={handleConfirmCancel} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl transition disabled:opacity-50">{canceling ? 'Canceling...' : 'Confirm Cancellation'}</button>
            </div>
          </div>
        </div>
      )}

      {rescheduleModalAppt && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 max-w-lg w-full shadow-xl space-y-4">
            <h3 className="text-xl font-serif text-[#2C2A2A] font-medium border-b border-[#EAE1D2] pb-2">Reschedule Session for {rescheduleModalAppt.clientName || 'Client'}</h3>
            <p className="text-xs text-[#2C2A2A]/80">Current Session: <strong>{rescheduleModalAppt.appointmentTypeName}</strong> ({new Date(rescheduleModalAppt.startISO).toLocaleString()})</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Select New Date</label>
                <input type="date" value={rescheduleDate} onChange={(e) => { setRescheduleDate(e.target.value); setRescheduleSlot(null); }} className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-2">Select Open Time Slot ({rules?.timezone})</label>
                {rescheduleAvailableSlots.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {rescheduleAvailableSlots.map((slot) => {
                      const isSelected = rescheduleSlot === slot;
                      return (
                        <button key={slot} type="button" onClick={() => setRescheduleSlot(slot)} className={`py-2 rounded-xl text-xs font-semibold transition border ${isSelected ? 'bg-[#BF5B33] text-white border-[#BF5B33]' : 'bg-[#F7F2E9] text-[#2C2A2A] border-[#EAE1D2] hover:bg-[#EAE1D2]/60'}`}>
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs text-center font-medium">{rescheduleClosedReason || 'No available slots on this date according to practice rules.'}</div>
                )}
              </div>
              {rescheduleSlot && !rescheduleAvailCheck.isAvailable && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs font-semibold space-y-1">
                  <p className="font-bold text-amber-800">⚠️ OVERRIDE PRACTICE AVAILABILITY WARNING:</p>
                  <p>{rescheduleAvailCheck.reason}</p>
                  <p className="text-[11px] font-normal text-amber-700">As a practice therapist/admin, you may override this warning and proceed with rescheduling if necessary.</p>
                </div>
              )}

              {rescheduleModalAppt.notes && (
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                    Existing Note (Read-Only)
                  </label>
                  <div className="p-2.5 bg-gray-50 border border-[#EAE1D2] rounded-xl text-xs text-[#2C2A2A]/90 italic whitespace-pre-line">
                    {rescheduleModalAppt.notes}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Additional Reschedule Note (Optional)</label>
                <input type="text" value={rescheduleNote} onChange={(e) => setRescheduleNote(e.target.value)} placeholder="Add an additional note for this reschedule..." className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs bg-white text-[#2C2A2A]" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setRescheduleModalAppt(null)} className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#2C2A2A] font-semibold text-xs rounded-xl transition">Cancel</button>
              <button type="button" disabled={!rescheduleSlot || rescheduling} onClick={handleConfirmReschedule} className="flex-1 py-2.5 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-semibold text-xs rounded-xl transition disabled:opacity-50">
                {rescheduling ? 'Rescheduling...' : (!rescheduleAvailCheck.isAvailable ? '⚠️ Override & Reschedule' : 'Confirm Reschedule')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
