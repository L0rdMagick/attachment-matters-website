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

import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';

interface TherapistDashboardProps {
  onNavigate: (tab: string) => void;
}

export type ActivityCategory = 'all' | 'appointments' | 'profile' | 'intakes' | 'signed_forms';

export interface UnifiedActivityItem {
  id: string;
  category: 'appointments' | 'profile' | 'intakes' | 'signed_forms';
  badgeTitle: string;
  clientName: string;
  message: string;
  details?: string;
  timestampISO: string;
  timestampFormatted: string;
  actionButton?: {
    label: string;
    onClick: () => void;
  };
  deleteId?: string;
}

export const TherapistDashboard: React.FC<TherapistDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [todayAppointments, setTodayAppointments] = useState<AppointmentData[]>([]);
  const [activityFeed, setActivityFeed] = useState<UnifiedActivityItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<ActivityCategory>('all');
  const [loading, setLoading] = useState(true);

  const loadDash = async () => {
    try {
      const [allAppts, allClients, notifDocs, signedDocsSnap] = await Promise.all([
        getAppointments({}),
        getClientsDirectory({ accountStatus: 'all' }),
        getPracticeNotifications(),
        getDocs(collection(db, 'signedDocuments'))
      ]);

      setTodayAppointments(allAppts);

      const itemsMap = new Map<string, UnifiedActivityItem>();

      // 1. Process Practice Notifications
      notifDocs.forEach((notif) => {
        const isCanceled = notif.type === 'appointment_canceled';
        const isCreated = notif.type === 'appointment_created';
        const isIntake = notif.type === 'intake_submitted';
        const isDoc = notif.type === 'document_signed';
        const isProfile = notif.type === 'profile_updated';

        let category: UnifiedActivityItem['category'] = 'appointments';
        if (isIntake) category = 'intakes';
        else if (isDoc) category = 'signed_forms';
        else if (isProfile) category = 'profile';

        const isoTimestamp = notif.createdAtISO || (notif.createdAt?.seconds ? new Date(notif.createdAt.seconds * 1000).toISOString() : new Date().toISOString());
        const formattedDate = new Date(isoTimestamp).toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        itemsMap.set(`notif_${notif.id}`, {
          id: `notif_${notif.id}`,
          category,
          badgeTitle: notif.title || 'Notification',
          clientName: notif.clientName || 'Client',
          message: notif.message,
          details: notif.details,
          timestampISO: isoTimestamp,
          timestampFormatted: formattedDate,
          deleteId: notif.id,
          actionButton: (isIntake || isDoc) ? {
            label: isDoc ? 'Review Form →' : 'Review Packet →',
            onClick: () => onNavigate('clients')
          } : undefined
        });
      });

      // 2. Process Signed Consent Documents
      signedDocsSnap.docs.forEach((docSnap) => {
        const d = docSnap.data();
        const client = allClients.find((c: any) => c.uid === d.clientId);

        let clientName = '';
        if (client?.legalFirstName) {
          clientName = `${client.legalLastName || ''}${client.legalLastName ? ', ' : ''}${client.legalFirstName}`.trim();
        } else if (d.clientTypedName) {
          clientName = d.clientTypedName;
        } else {
          clientName = client?.email || 'Client';
        }

        const isoTimestamp = d.signedAtISO || (d.createdAt?.seconds ? new Date(d.createdAt.seconds * 1000).toISOString() : new Date().toISOString());
        const formattedDate = new Date(isoTimestamp).toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });

        const key = `signed_doc_${docSnap.id}`;
        if (!itemsMap.has(key)) {
          itemsMap.set(key, {
            id: key,
            category: 'signed_forms',
            badgeTitle: '✍️ Signed Consent Form',
            clientName,
            message: d.documentTitle || 'Practice Consent & Agreement',
            details: `Version: ${d.templateVersion || 'v1.0'} | Audit Hash: ${d.documentHash || 'N/A'}`,
            timestampISO: isoTimestamp,
            timestampFormatted: formattedDate,
            actionButton: {
              label: 'Review Form →',
              onClick: () => onNavigate('clients')
            }
          });
        }
      });

      // 3. Process Intake Questionnaire Submissions
      allClients.forEach((c: any) => {
        if (c.intakeStatus === 'submitted') {
          const clientName = (c.legalFirstName ? `${c.legalLastName || ''}${c.legalLastName ? ', ' : ''}${c.legalFirstName}` : c.email || 'Client').trim();
          const isoTimestamp = c.updatedAt?.seconds ? new Date(c.updatedAt.seconds * 1000).toISOString() : (c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString());
          const formattedDate = new Date(isoTimestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          const key = `intake_sub_${c.uid}`;
          if (!itemsMap.has(key)) {
            itemsMap.set(key, {
              id: key,
              category: 'intakes',
              badgeTitle: '📋 Intake Questionnaire',
              clientName,
              message: 'Initial Clinical Intake Questionnaire Submission',
              details: 'Completed full clinical intake questionnaire packet.',
              timestampISO: isoTimestamp,
              timestampFormatted: formattedDate,
              actionButton: {
                label: 'Review Packet →',
                onClick: () => onNavigate('clients')
              }
            });
          }
        }
      });

      // 4. Merge Appointment Bookings
      allAppts.forEach((appt) => {
        const clientName = appt.clientName || appt.clientEmail || 'Client';
        const dateStr = appt.startISO ? new Date(appt.startISO).toLocaleString() : 'N/A';
        const apptNoticeMsg = `${clientName} booked session (${appt.appointmentTypeName || 'Therapy Session'}) for ${dateStr}.`;

        const key = `appt_act_${appt.id}`;
        if (!itemsMap.has(key) && appt.status !== 'canceled' && appt.status !== 'canceled_by_client') {
          const isoTimestamp = appt.createdAt || appt.startISO || new Date().toISOString();
          const formattedDate = new Date(isoTimestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          itemsMap.set(key, {
            id: key,
            category: 'appointments',
            badgeTitle: '📅 New Appointment Booked',
            clientName,
            message: apptNoticeMsg,
            details: `Status: ${appt.status} | Format: ${appt.format}`,
            timestampISO: isoTimestamp,
            timestampFormatted: formattedDate
          });
        }
      });

      // 5. Merge Profile Activity Updates
      allClients.forEach((c: any) => {
        if (c.updatedAt || c.lastActivityAt) {
          const clientName = (c.legalFirstName ? `${c.legalFirstName} ${c.legalLastName || ''}` : c.email || 'Client').trim();
          const noticeMsg = c.lastActivityNotice || `${clientName} updated profile information.`;
          const key = `client_act_${c.uid}`;

          if (!itemsMap.has(key)) {
            const isoTimestamp = c.lastActivityAt || (c.updatedAt?.seconds ? new Date(c.updatedAt.seconds * 1000).toISOString() : new Date().toISOString());
            const formattedDate = new Date(isoTimestamp).toLocaleString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            itemsMap.set(key, {
              id: key,
              category: 'profile',
              badgeTitle: '👤 Client Profile Saved / Updated',
              clientName,
              message: noticeMsg,
              details: `Email: ${c.email || 'N/A'}`,
              timestampISO: isoTimestamp,
              timestampFormatted: formattedDate
            });
          }
        }
      });

      const combinedList = Array.from(itemsMap.values());
      combinedList.sort((a, b) => new Date(b.timestampISO).getTime() - new Date(a.timestampISO).getTime());

      setActivityFeed(combinedList);
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
      () => {
        loadDash();
      },
      (err) => {
        console.warn("Failed to subscribe to practice notifications:", err);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleDeleteNotif = async (deleteId?: string, itemId?: string) => {
    if (deleteId) {
      await deletePracticeNotification(deleteId);
    }
    setActivityFeed((prev) => prev.filter((item) => item.id !== (itemId || deleteId)));
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to delete all activity notifications?")) return;
    await clearAllPracticeNotifications();
    setActivityFeed([]);
  };

  if (loading) {
    return <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl">Loading therapist dashboard...</div>;
  }

  // Calculate counts for filters
  const categoryCounts = {
    all: activityFeed.length,
    appointments: activityFeed.filter((i) => i.category === 'appointments').length,
    profile: activityFeed.filter((i) => i.category === 'profile').length,
    intakes: activityFeed.filter((i) => i.category === 'intakes').length,
    signed_forms: activityFeed.filter((i) => i.category === 'signed_forms').length
  };

  const filteredFeed = activeFilter === 'all'
    ? activityFeed
    : activityFeed.filter((item) => item.category === activeFilter);

  return (
    <div className="space-y-6 sm:space-y-8 font-sans">
      {/* Top Banner */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-5 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs bg-[#BF5B33]/10 text-[#BF5B33] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
            Clinical Practice Dashboard
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif text-[#2C2A2A] font-medium mt-2">
            Welcome back, Clinician
          </h2>
          <p className="text-xs text-[#2C2A2A]/70 mt-1">
            Family Trust Therapy Practice Management & Electronic Health Records
          </p>
        </div>

        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-2.5">
          <button
            onClick={() => onNavigate('calendar')}
            className="w-full sm:w-auto px-4 py-3 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl shadow-sm transition min-h-[44px] flex items-center justify-center"
          >
            🗓️ Open Calendar
          </button>
          <button
            onClick={() => onNavigate('clients')}
            className="w-full sm:w-auto px-4 py-3 bg-[#4A5741] hover:bg-[#384232] text-white text-xs font-semibold rounded-xl shadow-sm transition min-h-[44px] flex items-center justify-center"
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white border border-[#EAE1D2] rounded-2xl p-5 sm:p-6 shadow-xs space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4A5741]">Sessions Scheduled</p>
              <p className="text-2xl sm:text-3xl font-serif font-bold text-[#2C2A2A]">{activeScheduledCount}</p>
              <p className="text-[11px] text-gray-500">{completedCount} completed sessions</p>
            </div>

            <div className="bg-white border border-[#EAE1D2] rounded-2xl p-5 sm:p-6 shadow-xs space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4A5741]">Forms & Intakes Pending Review</p>
              <p className="text-2xl sm:text-3xl font-serif font-bold text-[#BF5B33]">{categoryCounts.intakes + categoryCounts.signed_forms}</p>
            </div>

            <div className="bg-white border border-[#EAE1D2] rounded-2xl p-5 sm:p-6 shadow-xs space-y-1 sm:col-span-2 lg:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#4A5741]">Google Calendar Sync</p>
              <p className="text-xs sm:text-sm font-semibold text-green-700 flex items-center gap-1.5 mt-2">
                <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></span> 2-Way Sync Active
              </p>
            </div>
          </div>
        );
      })()}

      {/* Combined Client Activity Updates Section */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-5 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#EAE1D2] pb-4 gap-3">
          <div>
            <h3 className="text-lg sm:text-xl font-serif text-[#2C2A2A] font-medium flex items-center gap-2">
              🔔 Client Activity Updates ({activityFeed.length})
            </h3>
            <p className="text-xs text-[#2C2A2A]/70 mt-0.5">
              Combined real-time feed of client bookings, profile updates, intake questionnaires, and signed consent forms listed in chronological order.
            </p>
          </div>

          {activityFeed.length > 0 && (
            <button
              onClick={handleClearAll}
              className="w-full sm:w-auto px-3 py-2 text-xs text-red-600 hover:text-red-800 font-semibold bg-red-50 border border-red-200 rounded-xl transition min-h-[38px]"
            >
              🗑️ Clear All Updates
            </button>
          )}
        </div>

        {/* Category Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All', count: categoryCounts.all },
            { id: 'appointments', label: 'New Appointments', count: categoryCounts.appointments },
            { id: 'profile', label: 'Profile Updates', count: categoryCounts.profile },
            { id: 'intakes', label: 'Intakes', count: categoryCounts.intakes },
            { id: 'signed_forms', label: 'Signed Forms', count: categoryCounts.signed_forms }
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id as ActivityCategory)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition min-h-[38px] flex items-center gap-1.5 ${
                activeFilter === filter.id
                  ? 'bg-[#BF5B33] text-white shadow-xs'
                  : 'bg-white text-[#2C2A2A] hover:bg-[#EAE1D2]/50 border border-[#EAE1D2]'
              }`}
            >
              <span>{filter.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                activeFilter === filter.id ? 'bg-white/20 text-white' : 'bg-[#EAE1D2] text-[#2C2A2A]'
              }`}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>

        {/* Activity Items List */}
        {filteredFeed.length > 0 ? (
          <div className="space-y-3 pt-1">
            {filteredFeed.map((item) => {
              const isAppointment = item.category === 'appointments';
              const isProfile = item.category === 'profile';
              const isIntake = item.category === 'intakes';
              const isSignedForm = item.category === 'signed_forms';

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs ${
                    isAppointment ? 'bg-green-50/60 border-green-200 text-green-950' :
                    isProfile ? 'bg-[#F7F2E9] border-[#EAE1D2] text-[#2C2A2A]' :
                    isIntake ? 'bg-amber-50/70 border-amber-200 text-amber-950' :
                    isSignedForm ? 'bg-blue-50/70 border-blue-200 text-blue-950' :
                    'bg-[#F7F2E9] border-[#EAE1D2] text-[#2C2A2A]'
                  }`}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm font-semibold text-[#2C2A2A]">{item.clientName}</strong>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        isAppointment ? 'bg-green-100 text-green-800 border-green-200' :
                        isProfile ? 'bg-gray-100 text-gray-800 border-gray-200' :
                        isIntake ? 'bg-amber-100 text-amber-900 border-amber-200' :
                        isSignedForm ? 'bg-blue-100 text-blue-900 border-blue-200' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {item.badgeTitle}
                      </span>
                      <span className="text-[11px] text-gray-500 font-medium ml-auto sm:ml-0">
                        🕒 {item.timestampFormatted}
                      </span>
                    </div>

                    <p className="font-semibold text-xs sm:text-sm text-[#2C2A2A] mt-0.5">{item.message}</p>

                    {item.details && (
                      <p className="text-[11px] text-gray-600 italic">
                        {item.details}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200/50 justify-end">
                    {item.actionButton && (
                      <button
                        onClick={item.actionButton.onClick}
                        className="w-full sm:w-auto px-4 py-2 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-semibold text-xs rounded-xl shadow-xs transition whitespace-nowrap min-h-[38px] flex items-center justify-center"
                      >
                        {item.actionButton.label}
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteNotif(item.deleteId, item.id)}
                      className="text-[11px] font-semibold text-gray-600 hover:text-red-700 px-3 py-2 bg-white hover:bg-red-50 border border-gray-200 rounded-xl transition whitespace-nowrap min-h-[38px] flex items-center justify-center"
                      title="Dismiss or delete update"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-[#2C2A2A]/60 bg-[#F7F2E9] rounded-xl border border-[#EAE1D2]">
            No activity updates found for the selected category.
          </div>
        )}
      </div>
    </div>
  );
};
