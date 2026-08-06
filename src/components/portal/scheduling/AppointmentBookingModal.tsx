import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getAvailabilityRules, bookAppointmentWithLock, getAppointments, updateAppointmentStatus } from '../../../lib/firebase/scheduling';
import type { AvailabilityRules, AppointmentType, AppointmentData } from '../../../types/scheduling';

export const AppointmentBookingModal: React.FC = () => {
  const { user } = useAuth();
  const [rules, setRules] = useState<AvailabilityRules | null>(null);
  const [myAppointments, setMyAppointments] = useState<AppointmentData[]>([]);
  const [selectedType, setSelectedType] = useState<AppointmentType | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [format, setFormat] = useState<'telehealth' | 'in_person'>('telehealth');
  
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    async function loadData() {
      try {
        const [r, appts] = await Promise.all([
          getAvailabilityRules('default'),
          getAppointments({ clientId: user!.uid })
        ]);
        setRules(r);
        setMyAppointments(appts);
        if (r.appointmentTypes.length > 0) setSelectedType(r.appointmentTypes[0]);
      } catch (err) {
        console.error("Failed to load booking system", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  // Generate available slots for selected date (mock calculation for demo)
  const availableSlots = [
    '09:00', '10:00', '11:00', '13:00', '14:00', '15:00'
  ];

  const handleBook = async () => {
    if (!user || !selectedType || !selectedTimeSlot) return;
    setBooking(true);
    setMessage(null);

    const startISO = `${selectedDate}T${selectedTimeSlot}:00`;
    const endISO = new Date(new Date(startISO).getTime() + selectedType.durationMinutes * 60000).toISOString();

    const appointmentPayload: Omit<AppointmentData, 'id'> = {
      clientId: user.uid,
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

  const handleCancelAppointment = async (apptId: string) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    try {
      await updateAppointmentStatus(apptId, 'canceled_by_client', 'Canceled by client via portal');
      const updated = await getAppointments({ clientId: user!.uid });
      setMyAppointments(updated);
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
              value={selectedType?.id}
              onChange={(e) => {
                const found = rules?.appointmentTypes.find((t) => t.id === e.target.value);
                if (found) setSelectedType(found);
              }}
              className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs bg-white"
            >
              {rules?.appointmentTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.durationMinutes} mins - ${(t.priceInCents / 100).toFixed(2)})
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
                className="w-full p-2.5 rounded-xl border border-[#EAE1D2] text-xs bg-white"
              >
                <option value="telehealth">Telehealth (Video)</option>
                <option value="in_person">In Person (Office)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-2">
              Available Time Slots ({rules?.timezone})
            </label>
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
          <h3 className="text-lg font-serif text-[#2C2A2A] font-medium border-b border-[#EAE1D2] pb-2">
            My Scheduled Appointments
          </h3>

          {myAppointments.length === 0 ? (
            <p className="text-xs text-[#2C2A2A]/60 py-6 text-center">No upcoming or past appointments found.</p>
          ) : (
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {myAppointments.map((appt) => (
                <div key={appt.id} className="p-4 bg-[#F7F2E9] rounded-xl border border-[#EAE1D2] space-y-1 text-xs text-[#2C2A2A]">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-sm">{appt.appointmentTypeName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      appt.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p><strong>Date & Time:</strong> {new Date(appt.startISO).toLocaleString()}</p>
                  <p><strong>Format:</strong> <span className="capitalize">{appt.format}</span></p>

                  {appt.status === 'confirmed' || appt.status === 'requested' ? (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => handleCancelAppointment(appt.id!)}
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
