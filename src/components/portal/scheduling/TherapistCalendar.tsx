import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getAppointments, updateAppointmentStatus, bookAppointmentWithLock, getAvailabilityRules, checkTherapistSlotAvailability, DEFAULT_AVAILABILITY_RULES } from '../../../lib/firebase/scheduling';
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
  const [schedBooking, setSchedBooking] = useState(false);
  const [schedMessage, setSchedMessage] = useState<string | null>(null);

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
        if (r) setRules(r);
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

  const handleScheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) {
      setSchedMessage("Please select a client.");
      return;
    }
    setSchedBooking(true);
    setSchedMessage(null);

    // Check practice settings availability
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
        priceInCents: schedType.priceInCents,
        syncStatus: 'pending'
      });

      const updated = await getAppointments({ therapistId: 'default_therapist' });
      setAppointments(updated);
      setShowScheduleModal(false);
      alert("Appointment scheduled successfully!");
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

  const upcomingAppts = appointments.filter(a => a.status === 'confirmed' || a.status === 'requested');
  const historyAppts = appointments.filter(a => a.status === 'completed' || a.status.startsWith('canceled'));
  const displayedAppts = statusTab === 'upcoming' ? upcomingAppts : historyAppts;

  return (
    <div className="space-y-6 font-sans">
      {/* Top Banner & Sync Indicator */}
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

          <div className="flex items-center gap-2 text-xs bg-green-50 text-green-800 border border-green-200 px-3 py-1.5 rounded-xl font-semibold">
            <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></span>
            Google Calendar Sync: Connected
          </div>

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

      {/* Appointments List / Agenda */}
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
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{a.appointmentTypeName}</span>
                      <span className="bg-[#BF5B33]/15 text-[#BF5B33] px-2.5 py-0.5 rounded-md font-bold text-xs">
                        👤 Client: {displayName} {displayEmail ? `(${displayEmail})` : ''}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        a.status === 'completed' ? 'bg-green-100 text-green-800 border border-green-200' :
                        a.status === 'confirmed' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                        a.status === 'requested' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {a.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="mt-1">
                      <strong>Time:</strong> {new Date(a.startISO).toLocaleString()} | <strong>Format:</strong> <span className="capitalize">{a.format}</span>
                    </p>
                    <p className="text-[11px] text-[#4A5741] mt-0.5">
                      🔒 GCal Title: "Reserved Appointment" (Privacy Protected)
                    </p>
                  </div>

                <div className="flex items-center gap-2 shrink-0">
                  {a.status !== 'completed' && (
                    <button
                      onClick={() => handleStatusChange(a.id!, 'completed')}
                      className="px-3 py-1.5 bg-[#4A5741] text-white font-semibold rounded-lg hover:bg-[#384232] transition"
                    >
                      ✓ Mark Completed
                    </button>
                  )}
                  {a.status !== 'canceled_by_practice' && (
                    <button
                      onClick={() => handleStatusChange(a.id!, 'canceled_by_practice')}
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

      {/* Admin Schedule Appointment Popup Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto font-sans">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-[#EAE1D2]">
            <div className="flex justify-between items-center border-b border-[#EAE1D2] pb-3">
              <h3 className="text-lg font-serif font-medium text-[#2C2A2A]">
                Schedule Client Clinical Session
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {schedMessage && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-medium">
                {schedMessage}
              </div>
            )}

            <form onSubmit={handleScheduleAppointment} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                  Assign To Client
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-white text-xs text-[#2C2A2A] font-medium"
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

              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                  Select Appointment Type
                </label>
                <select
                  value={schedType.id}
                  onChange={(e) => {
                    const found = DEFAULT_AVAILABILITY_RULES.appointmentTypes.find(t => t.id === e.target.value);
                    if (found) setSchedType(found);
                  }}
                  className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-white text-xs text-[#2C2A2A] font-medium"
                >
                  {DEFAULT_AVAILABILITY_RULES.appointmentTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name} ({type.durationMinutes} min • ${(type.priceInCents / 100).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={schedDate}
                    onChange={(e) => setSchedDate(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                    Start Time Slot
                  </label>
                  <select
                    value={schedTime}
                    onChange={(e) => setSchedTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-white text-xs text-[#2C2A2A] font-medium"
                  >
                    {['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'].map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                  Service Format
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSchedFormat('telehealth')}
                    className={`py-2 rounded-xl text-xs font-semibold border transition ${
                      schedFormat === 'telehealth' ? 'bg-[#BF5B33] text-white border-[#BF5B33]' : 'bg-[#F7F2E9] text-[#2C2A2A] border-[#EAE1D2]'
                    }`}
                  >
                    💻 Telehealth
                  </button>
                  <button
                    type="button"
                    onClick={() => setSchedFormat('in_person')}
                    className={`py-2 rounded-xl text-xs font-semibold border transition ${
                      schedFormat === 'in_person' ? 'bg-[#BF5B33] text-white border-[#BF5B33]' : 'bg-[#F7F2E9] text-[#2C2A2A] border-[#EAE1D2]'
                    }`}
                  >
                    🏢 In-Person Office
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#EAE1D2]">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={schedBooking}
                  className="px-5 py-2 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl shadow-sm disabled:opacity-50 transition"
                >
                  {schedBooking ? 'Booking...' : 'Book & Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
