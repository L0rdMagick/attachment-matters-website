import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getAppointments, updateAppointmentStatus } from '../../../lib/firebase/scheduling';
import type { AppointmentData, AppointmentStatus } from '../../../types/scheduling';

export const TherapistCalendar: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'agenda'>('agenda');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAppts() {
      try {
        const data = await getAppointments({ therapistId: 'default_therapist' });
        setAppointments(data);
      } catch (err) {
        console.error("Failed to load therapist appointments", err);
      } finally {
        setLoading(false);
      }
    }
    loadAppts();
  }, []);

  const handleStatusChange = async (apptId: string, newStatus: AppointmentStatus) => {
    try {
      await updateAppointmentStatus(apptId, newStatus);
      const updated = await getAppointments({ therapistId: 'default_therapist' });
      setAppointments(updated);
    } catch (err) {
      console.error("Failed to update status", err);
    }
  };

  if (loading) {
    return <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl">Loading clinical calendar...</div>;
  }

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

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs bg-green-50 text-green-800 border border-green-200 px-3 py-1.5 rounded-xl font-semibold">
            <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></span>
            Google Calendar Sync: Connected (Generic Titles)
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
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-serif text-[#2C2A2A] font-medium border-b border-[#EAE1D2] pb-3 mb-4">
          Session Agenda ({appointments.length} Total Sessions)
        </h3>

        {appointments.length === 0 ? (
          <p className="text-xs text-[#2C2A2A]/60 py-8 text-center">No clinical appointments scheduled on calendar.</p>
        ) : (
          <div className="space-y-3">
            {appointments.map((a) => (
              <div key={a.id} className="p-4 bg-[#F7F2E9] rounded-xl border border-[#EAE1D2] flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-[#2C2A2A]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{a.appointmentTypeName}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      a.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {a.status.replace('_', ' ')}
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
