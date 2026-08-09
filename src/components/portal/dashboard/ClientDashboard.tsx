import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getAppointments } from '../../../lib/firebase/scheduling';
import { getInvoicesForClient } from '../../../lib/firebase/billing';
import { getSignedDocuments } from '../../../lib/firebase/consent';
import { getClientProfile } from '../../../lib/firebase/clients';
import type { AppointmentData } from '../../../types/scheduling';
import type { ClientProfileData } from '../../../types/client';

interface ClientDashboardProps {
  onNavigate: (tab: string) => void;
}

export const ClientDashboard: React.FC<ClientDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ClientProfileData | null>(null);
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [outstandingBalance, setOutstandingBalance] = useState(0);
  const [signedDocsCount, setSignedDocsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function loadDashboard() {
      try {
        const [prof, appts, invs, docs] = await Promise.all([
          getClientProfile(user!.uid),
          getAppointments({ clientId: user!.uid }),
          getInvoicesForClient(user!.uid),
          getSignedDocuments(user!.uid)
        ]);

        setProfile(prof);
        setAppointments(appts);
        setSignedDocsCount(docs.length);

        const totalBal = invs.reduce((sum, i) => sum + i.balanceCents, 0);
        setOutstandingBalance(totalBal);
      } catch (err) {
        console.error("Failed to load client dashboard", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [user]);

  if (loading) {
    return <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl">Loading client dashboard...</div>;
  }

  const nextAppointment = appointments.find((a) => a.status === 'confirmed' || a.status === 'requested' || a.status === 'rescheduled');

  return (
    <div className="space-y-8 font-sans">
      {/* Welcome Header */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs bg-[#4A5741]/10 text-[#4A5741] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Client Portal Overview
          </span>
          <h2 className="text-3xl font-serif text-[#2C2A2A] font-medium mt-2">
            Welcome back, {profile?.preferredName || profile?.legalFirstName || 'Client'}
          </h2>
          <p className="text-xs text-[#2C2A2A]/70 mt-1">
            Care Team: <span className="font-semibold text-[#2C2A2A]">{profile?.assignedTherapistName || 'Family Trust Therapy Practice'}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onNavigate('appointments')}
            className="px-4 py-2.5 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-semibold text-xs rounded-xl shadow-sm transition"
          >
            📅 Schedule Appointment
          </button>
          <button
            onClick={() => onNavigate('documents')}
            className="px-4 py-2.5 bg-[#4A5741] hover:bg-[#384232] text-white font-semibold text-xs rounded-xl shadow-sm transition"
          >
            📝 Intake & Consents
          </button>
        </div>
      </div>

      {/* Next Appointment Hero Card */}
      {nextAppointment ? (
        <div className="bg-[#4A5741] text-white rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-semibold tracking-wider bg-white/20 px-3 py-1 rounded-full">
              Next Scheduled Appointment
            </span>
            <span className="text-xs font-semibold uppercase px-2.5 py-1 bg-[#BF5B33] rounded-full">
              {nextAppointment.status}
            </span>
          </div>

          <div>
            <h3 className="text-2xl font-serif font-medium">{nextAppointment.appointmentTypeName}</h3>
            <p className="text-sm opacity-90 mt-1">
              🗓️ {new Date(nextAppointment.startISO).toLocaleString()} ({nextAppointment.timezone})
            </p>
            <p className="text-xs opacity-80 mt-1">
              📍 Format: <strong className="capitalize">{nextAppointment.format}</strong> — {nextAppointment.locationOrLink}
            </p>
            {nextAppointment.notes && (
              <p className="text-xs bg-white/10 p-2 rounded-lg mt-2 italic border border-white/20">
                📝 Note: {nextAppointment.notes}
              </p>
            )}
          </div>

          <div className="pt-2 flex gap-3">
            <button
              onClick={() => onNavigate('appointments')}
              className="px-4 py-2 bg-white text-[#4A5741] text-xs font-semibold rounded-xl hover:bg-gray-100 transition"
            >
              Manage / Reschedule Session
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm font-serif text-[#2C2A2A]">No upcoming appointments currently scheduled.</p>
          <button
            onClick={() => onNavigate('appointments')}
            className="px-4 py-2 bg-[#BF5B33] text-white text-xs font-semibold rounded-xl hover:bg-[#a64e2b] transition"
          >
            Schedule Next Session
          </button>
        </div>
      )}

      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Outstanding Balance */}
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-2">
          <p className="text-xs font-semibold uppercase text-[#4A5741]">Outstanding Balance</p>
          <p className="text-3xl font-serif font-bold text-[#BF5B33]">
            ${(outstandingBalance / 100).toFixed(2)}
          </p>
          <button
            onClick={() => onNavigate('billing')}
            className="text-xs font-semibold text-[#4A5741] hover:underline block pt-1"
          >
            View Statements & Invoices →
          </button>
        </div>

        {/* Intake Form Status */}
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-2">
          <p className="text-xs font-semibold uppercase text-[#4A5741]">Intake Form Status</p>
          <p className="text-xl font-serif font-medium text-[#2C2A2A] capitalize">
            {profile?.intakeStatus ? profile.intakeStatus.replace('_', ' ') : 'Not Started'}
          </p>
          <button
            onClick={() => onNavigate('documents')}
            className="text-xs font-semibold text-[#BF5B33] hover:underline block pt-1"
          >
            Complete Questionnaire →
          </button>
        </div>

        {/* Signed Documents */}
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm space-y-2">
          <p className="text-xs font-semibold uppercase text-[#4A5741]">Signed Agreements</p>
          <p className="text-3xl font-serif font-medium text-[#2C2A2A]">
            {signedDocsCount} Active
          </p>
          <button
            onClick={() => onNavigate('documents')}
            className="text-xs font-semibold text-[#4A5741] hover:underline block pt-1"
          >
            View Signed Agreements →
          </button>
        </div>
      </div>
    </div>
  );
};
