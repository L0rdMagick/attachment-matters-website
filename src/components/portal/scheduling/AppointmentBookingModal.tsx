import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getAvailabilityRules, bookAppointmentWithLock, getAppointments, updateAppointmentStatus, getAvailableTimeSlots, DEFAULT_AVAILABILITY_RULES } from '../../../lib/firebase/scheduling';
import type { AvailabilityRules, AppointmentType, AppointmentData } from '../../../types/scheduling';

export const AppointmentBookingModal: React.FC = () => {
  const { user } = useAuth();
  const [rules, setRules] = useState<AvailabilityRules>(DEFAULT_AVAILABILITY_RULES);
  const [myAppointments, setMyAppointments] = useState<AppointmentData[]>([]);
  const [selectedType, setSelectedType] = useState<AppointmentType | null>(DEFAULT_AVAILABILITY_RULES.appointmentTypes[0] || null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [format, setFormat] = useState<'telehealth' | 'in_person'>('telehealth');
  const [apptTab, setApptTab] = useState<'upcoming' | 'history'>('upcoming');
  
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [r, appts] = await Promise.all([
          getAvailabilityRules('default'),
          user ? getAppointments({ clientId: user.uid }) : Promise.resolve([])
        ]);
        if (r && r.appointmentTypes && r.appointmentTypes.length > 0) {
          setRules(r);
          setSelectedType((prev) => prev || r.appointmentTypes[0]);
        }
        if (appts) {
          setMyAppointments(appts);
        }
      } catch (err) {
        console.error("Failed to load booking system", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const upcomingClientAppts = myAppointments.filter(a => a.status === 'confirmed' || a.status === 'requested');
  const historyClientAppts = myAppointments.filter(a => a.status === 'completed' || a.status.startsWith('canceled'));
  const displayedClientAppts = apptTab === 'upcoming' ? upcomingClientAppts : historyClientAppts;

  // Dynamically calculate open time slots matching therapist practice rules
  const { slots: availableSlots, reason: closedReason } = getAvailableTimeSlots(
    selectedDate,
    rules,
    myAppointments,
    selectedType?.durationMinutes || 50,
    selectedType?.bufferBeforeMinutes || 0,
    selectedType?.bufferAfterMinutes || 0
  );

  const handleBook = async () => {
    if (rules?.allowClientSelfScheduling === false) {
      setMessage({
        type: 'error',
        text: 'Online self-scheduling is currently disabled by practice administrators. Please contact your therapist directly.'
      });
      return;
    }

    if (!selectedType) {
      setMessage({ type: 'error', text: 'Please select an appointment type.' });
      return;
    }

    if (!selectedTimeSlot) {
      setMessage({ type: 'error', text: 'Please select an available time slot before booking.' });
      return;
    }

    if (!user) return;
    setBooking(true);
    setMessage(null);

    const startISO = `${selectedDate}T${selectedTimeSlot}:00`;
    const endISO = new Date(new Date(startISO).getTime() + selectedType.durationMinutes * 60000).toISOString();

    const appointmentPayload: Omit<AppointmentData, 'id'> = {
      clientId: user.uid,
      clientName: user.displayName || user.email || 'Client',
      clientEmail: user.email || undefined,
      therapistId: 'default_therapist',
      appointmentTypeId: selectedType.id,
      appointmentTypeName: selectedType.name,
      startISO,
      endISO,
      timezone: rules?.timezone || 'America/Chicago',
      format,
      locationOrLink: format === 'telehealth' ? 'https://familytrusttherapy.com/telehealth-room' : '123 Practice Way, Suite 100',
      status: rules?.requireAppointmentApproval ? 'requested' : 'confirmed',
      priceInCents: selectedType.priceInCents,
      syncStatus: 'pending'
    };

    try {
      const apptId = await bookAppointmentWithLock(appointmentPayload);
      setMessage({
        type: 'success',
        text: `Appointment reserved successfully! Reservation ID: ${apptId}. Lock acquired.`
      });
      // Refresh user appointments
      const updated = await getAppointments({ clientId: user.uid });
      setMyAppointments(updated);
      setSelectedTimeSlot(null);
    } catch (err: any) {
      console.error(err);
      setMessage({
        type: 'error',
        text: err.message || "Failed to book appointment due to double-booking lock protection."
      });
    } finally {
      setBooking(false);
    }
  };

  const handleCancelAppointment = async (appt: AppointmentData) => {
    const cancelNoticeHours = rules?.cancellationNoticeHours ?? 24;
    const cancelNoticeMs = cancelNoticeHours * 3600000;
    const apptStartMs = new Date(appt.startISO).getTime();
    const timeUntilApptMs = apptStartMs - Date.now();

    if (timeUntilApptMs < cancelNoticeMs) {
      const cancelNoticeDays = (cancelNoticeHours / 24).toFixed(1).replace('.0', '');
      setMessage({
        type: 'error',
        text: `Self-service cancellation is restricted within ${cancelNoticeDays} day${cancelNoticeDays === '1' ? '' : 's'} (${cancelNoticeHours} hrs) of scheduled appointment time per practice policy. Please contact Family Trust Therapy directly to cancel.`
      });
      return;
    }

    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      await updateAppointmentStatus(appt.id!, 'canceled_by_client', 'Canceled by client via portal');
      const updated = await getAppointments({ clientId: user!.uid });
      setMyAppointments(updated);
      setMessage({ type: 'success', text: 'Appointment canceled successfully.' });
    } catch (err) {
      console.error("Failed to cancel appointment", err);
    }
  };

  if (loading) {
    return <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl">Loading scheduling engine...</div>;
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Top Banner */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm">
        <h2 className="text-3xl font-serif text-[#2C2A2A] font-medium">Appointment Scheduling</h2>
        <p className="text-xs text-[#2C2A2A]/70 mt-1">
          Select an available date and time slot. Atomic server reservation locking prevents double bookings.
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs font-semibold border ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Booking Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Booking Form */}
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-5">
          <h3 className="text-lg font-serif text-[#2C2A2A] font-medium border-b border-[#EAE1D2] pb-2">
            Schedule a New Session
          </h3>

          <div>
            <label htmlFor="bk-type" className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
              Select Appointment Type
            </label>
            <select
              id="bk-type"
              value={selectedType?.id || ''}
              onChange={(e) => {
                const found = rules?.appointmentTypes?.find((t) => t.id === e.target.value);
                if (found) {
                  setSelectedType(found);
                  if (found.format === 'telehealth') setFormat('telehealth');
                  else if (found.format === 'in_person') setFormat('in_person');
                }
              }}
              className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs bg-white font-medium text-[#2C2A2A]"
            >
              {rules?.appointmentTypes?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.durationMinutes} mins — ${(t.priceInCents / 100).toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="bk-date" className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Date</label>
              <input
                id="bk-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs"
              />
            </div>
            <div>
              <label htmlFor="bk-fmt" className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Format</label>
              <select
                id="bk-fmt"
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                disabled={selectedType?.format === 'telehealth' || selectedType?.format === 'in_person'}
                className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs bg-white disabled:opacity-75"
              >
                {selectedType?.format !== 'in_person' && <option value="telehealth">Telehealth (Video)</option>}
                {selectedType?.format !== 'telehealth' && <option value="in_person">In Person (Office)</option>}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-2">
              Available Time Slots ({rules?.timezone})
            </label>
            {availableSlots.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {availableSlots.map((slot) => {
                  const isSelected = selectedTimeSlot === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTimeSlot(slot)}
                      className={`py-2 rounded-xl text-xs font-semibold transition border ${
                        isSelected ? 'bg-[#BF5B33] text-white border-[#BF5B33]' : 'bg-[#F7F2E9] text-[#2C2A2A] border-[#EAE1D2] hover:bg-[#EAE1D2]/60'
                      }`}
                    >
                      {slot}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold text-center">
                {closedReason || 'No available appointment time slots on this date. Please select a different day.'}
              </div>
            )}
          </div>

          <button
            onClick={handleBook}
            disabled={!selectedTimeSlot || booking}
            className="w-full py-3 px-6 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-semibold text-xs rounded-xl transition disabled:opacity-50"
          >
            {booking ? 'Reserving Lock...' : 'Confirm Appointment Reservation'}
          </button>
        </div>

        {/* Existing Appointments List */}
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#EAE1D2] pb-2">
            <h3 className="text-lg font-serif text-[#2C2A2A] font-medium">
              My Appointments
            </h3>
            <div className="flex bg-[#F7F2E9] p-1 rounded-xl border border-[#EAE1D2] text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setApptTab('upcoming')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  apptTab === 'upcoming' ? 'bg-[#BF5B33] text-white shadow-sm' : 'text-[#2C2A2A]/70 hover:text-[#2C2A2A]'
                }`}
              >
                Scheduled ({upcomingClientAppts.length})
              </button>
              <button
                type="button"
                onClick={() => setApptTab('history')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  apptTab === 'history' ? 'bg-[#BF5B33] text-white shadow-sm' : 'text-[#2C2A2A]/70 hover:text-[#2C2A2A]'
                }`}
              >
                Completed & History ({historyClientAppts.length})
              </button>
            </div>
          </div>

          {displayedClientAppts.length === 0 ? (
            <p className="text-xs text-[#2C2A2A]/60 py-6 text-center">
              {apptTab === 'upcoming' ? 'No active upcoming appointments currently scheduled.' : 'No completed or past appointment history.'}
            </p>
          ) : (
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {displayedClientAppts.map((appt) => (
                <div key={appt.id} className="p-4 bg-[#F7F2E9] rounded-xl border border-[#EAE1D2] space-y-1 text-xs text-[#2C2A2A]">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm">{appt.appointmentTypeName}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      appt.status === 'completed' ? 'bg-green-100 text-green-800 border border-green-200' :
                      appt.status === 'confirmed' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                      appt.status === 'requested' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {appt.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p><strong>Date & Time:</strong> {new Date(appt.startISO).toLocaleString()}</p>
                  <p><strong>Format:</strong> <span className="capitalize">{appt.format}</span></p>

                  {appt.status === 'confirmed' || appt.status === 'requested' ? (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => handleCancelAppointment(appt)}
                        className="text-[11px] font-semibold text-red-600 hover:underline"
                      >
                        Cancel Appointment
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
