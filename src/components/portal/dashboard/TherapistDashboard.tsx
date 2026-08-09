import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getAppointments } from '../../../lib/firebase/scheduling';
import { getClientsDirectory } from '../../../lib/firebase/clients';
import type { AppointmentData } from '../../../types/scheduling';
import type { ClientProfileData } from '../../../types/client';

interface TherapistDashboardProps {
  onNavigate: (tab: string) => void;
}

export const TherapistDashboard: React.FC<TherapistDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [todayAppointments, setTodayAppointments] = useState<AppointmentData[]>([]);
  const [pendingIntakes, setPendingIntakes] = useState<ClientProfileData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDash() {
      try {
        const [appts, clients] = await Promise.all([
          getAppointments({ therapistId: 'default_therapist' }),
          getClientsDirectory({ intakeStatus: 'submitted' })
        ]);

        setTodayAppointments(appts);
        setPendingIntakes(clients);
      } catch (err) {
        console.error("Failed to load therapist dashboard", err);
      } finally {
        setLoading(false);
      }
    }
    loadDash();
  }, []);

  if (loading) {
    return <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl">Loading therapist dashboard...</div>;
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Top Banner */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs bg-[#BF5B33]/10 text-[#BF5B33] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Clinical Practice Dashboard
          </span>
          <h2 className="text-3xl font-serif text-[#2C2A2A] font-medium mt-2">
            Welcome back, Clinician
          </h2>
          <p className="text-xs text-[#2C2A2A]/70 mt-1">
            Family Trust Therapy Practice Management & Electronic Health Records
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onNavigate('calendar')}
            className="px-4 py-2.5 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            🗓️ Open Calendar
          </button>
          <button
            onClick={() => onNavigate('clients')}
            className="px-4 py-2.5 bg-[#4A5741] hover:bg-[#384232] text-white text-xs font-semibold rounded-xl shadow-sm transition"
          >
            👥 Client Directory
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      {(() => {
        const activeScheduledCount = todayAppointments.filter(a => a.status === 'confirmed' || a.status === 'requested' || a.status === 'rescheduled').length;
        const completedCount = todayAppointments.filter(a => a.status === 'completed').length;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-1">
              <p className="text-xs font-semibold uppercase text-[#4A5741]">Sessions Scheduled</p>
              <p className="text-3xl font-serif font-bold text-[#2C2A2A]">{activeScheduledCount}</p>
              <p className="text-[11px] text-gray-500">{completedCount} completed sessions</p>
            </div>

            <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-1">
              <p className="text-xs font-semibold uppercase text-[#4A5741]">Intakes Pending Review</p>
              <p className="text-3xl font-serif font-bold text-[#BF5B33]">{pendingIntakes.length}</p>
            </div>

            <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-1">
              <p className="text-xs font-semibold uppercase text-[#4A5741]">Google Calendar Sync</p>
              <p className="text-sm font-semibold text-green-700 flex items-center gap-1.5 mt-2">
                <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></span> 2-Way Sync Active
              </p>
            </div>
          </div>
        );
      })()}

      {/* Pending Intakes Section */}
      {pendingIntakes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm space-y-3">
          <h3 className="text-base font-serif font-medium text-amber-900">
            ⚠️ Intake Questionnaires Awaiting Review ({pendingIntakes.length})
          </h3>
          <div className="space-y-2">
            {pendingIntakes.map((c) => (
              <div key={c.uid} className="bg-white p-3.5 rounded-xl border border-amber-200 flex justify-between items-center text-xs">
                <div>
                  <strong className="text-[#2C2A2A]">{c.legalLastName}, {c.legalFirstName}</strong> — Submitted intake packet
                </div>
                <button
                  onClick={() => onNavigate('clients')}
                  className="px-3 py-1 bg-[#BF5B33] text-white font-semibold rounded-lg"
                >
                  Review Packet →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
