import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getAppointments } from '../../../lib/firebase/scheduling';
import { getClientsDirectory } from '../../../lib/firebase/clients';
import {
  getPracticeNotifications,
  deletePracticeNotification,
  clearAllPracticeNotifications,
  type PracticeNotification
} from '../../../lib/firebase/notifications';
import type { AppointmentData } from '../../../types/scheduling';
import type { ClientProfileData } from '../../../types/client';

import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';

interface TherapistDashboardProps {
  onNavigate: (tab: string) => void;
}

export const TherapistDashboard: React.FC<TherapistDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [todayAppointments, setTodayAppointments] = useState<AppointmentData[]>([]);
  const [pendingIntakes, setPendingIntakes] = useState<ClientProfileData[]>([]);
  const [notifications, setNotifications] = useState<PracticeNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDash = async () => {
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
  };

  useEffect(() => {
    loadDash();

    // Real-time listener for practice notifications feed
    const colRef = collection(db, 'practiceNotifications');
    const unsubscribe = onSnapshot(
      colRef,
      async (snapshot) => {
        const notifs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as PracticeNotification));

        try {
          const clientList = await getClientsDirectory();
          clientList.forEach((c: any) => {
            if (c.lastActivityNotice && c.updatedAt) {
              const exists = notifs.some((n) => n.clientId === c.uid && n.message === c.lastActivityNotice);
              if (!exists) {
                notifs.push({
                  id: `client_act_${c.uid}`,
                  type: 'profile_updated',
                  title: '👤 Client Profile Updated',
                  message: c.lastActivityNotice,
                  clientId: c.uid,
                  clientName: `${c.legalFirstName} ${c.legalLastName || ''}`.trim(),
                  createdAt: c.updatedAt
                });
              }
            }
          });
        } catch (cErr) {
          console.warn("Client directory activity merge skipped:", cErr);
        }

        notifs.sort((a, b) => {
          const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : Date.now());
          const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : Date.now());
          return timeB - timeA;
        });

        setNotifications(notifs);
      },
      (err) => {
        console.warn("Failed to subscribe to practice notifications:", err);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleDeleteNotif = async (id?: string) => {
    if (!id) return;
    await deletePracticeNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to delete all activity notifications?")) return;
    await clearAllPracticeNotifications();
    setNotifications([]);
  };

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

      {/* Client Activity & Notification Center */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-[#EAE1D2] pb-3">
          <div>
            <h3 className="text-xl font-serif text-[#2C2A2A] font-medium flex items-center gap-2">
              🔔 Client Activity & Notifications ({notifications.length})
            </h3>
            <p className="text-xs text-[#2C2A2A]/70 mt-0.5">
              Real-time audit log of client profile updates, form submissions, signed agreements, bookings, and cancellations.
            </p>
          </div>

          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 text-xs text-red-600 hover:text-red-800 font-semibold bg-red-50 border border-red-200 rounded-xl transition"
            >
              🗑️ Clear All Notifications
            </button>
          )}
        </div>

        {notifications.length > 0 ? (
          <div className="space-y-3">
            {notifications.map((notif) => {
              const isCanceled = notif.type === 'appointment_canceled';
              const isCreated = notif.type === 'appointment_created';
              const isIntake = notif.type === 'intake_submitted';
              const isDoc = notif.type === 'document_signed';

              return (
                <div
                  key={notif.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs ${
                    isCanceled ? 'bg-red-50/70 border-red-200 text-red-950' :
                    isCreated ? 'bg-green-50/70 border-green-200 text-green-950' :
                    isIntake ? 'bg-amber-50/70 border-amber-200 text-amber-950' :
                    isDoc ? 'bg-blue-50/70 border-blue-200 text-blue-950' :
                    'bg-[#F7F2E9] border-[#EAE1D2] text-[#2C2A2A]'
                  }`}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        isCanceled ? 'bg-red-100 text-red-800 border border-red-200' :
                        isCreated ? 'bg-green-100 text-green-800 border border-green-200' :
                        isIntake ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                        isDoc ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {notif.title}
                      </span>
                      <span className="text-[11px] text-gray-500 font-medium">
                        {notif.createdAt?.seconds
                          ? new Date(notif.createdAt.seconds * 1000).toLocaleString()
                          : (notif.createdAt ? new Date(notif.createdAt).toLocaleString() : 'Just now')}
                      </span>
                    </div>

                    <p className="font-semibold text-sm">{notif.message}</p>
                    {notif.details && (
                      <p className="text-[11px] opacity-85 italic bg-white/60 p-2 rounded-lg border border-gray-200/60 mt-1 whitespace-pre-line">
                        Details: {notif.details}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteNotif(notif.id)}
                    className="text-[11px] font-semibold text-gray-600 hover:text-red-700 px-3 py-1 bg-white hover:bg-red-50 border border-gray-200 rounded-lg transition whitespace-nowrap"
                    title="Delete notification"
                  >
                    🗑️ Delete
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-[#2C2A2A]/60 bg-[#F7F2E9] rounded-xl border border-[#EAE1D2]">
            No recent client activity notifications. Client updates, bookings, submissions, and cancellations will appear here.
          </div>
        )}
      </div>

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
