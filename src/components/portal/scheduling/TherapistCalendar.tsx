import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getAppointments, updateAppointmentStatus } from '../../../lib/firebase/scheduling';
import type { AppointmentData, AppointmentStatus } from '../../../types/scheduling';

export const TherapistCalendar: React.FC = () => {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'agenda'>('agenda');
  const [statusTab, setStatusTab] = useState<'upcoming' | 'history'>('upcoming');
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

        <div className="flex items-center gap-3">
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
            {displayedAppts.map((a) => (
              <div key={a.id} className="p-4 bg-[#F7F2E9] rounded-xl border border-[#EAE1D2] flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-[#2C2A2A]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{a.appointmentTypeName}</span>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
