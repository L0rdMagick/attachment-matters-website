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

interface IndividualFormSubmissionItem {
  id: string;
  clientId: string;
  clientName: string;
  itemType: 'signed_consent' | 'intake_form';
  formTitle: string;
  submittedAtISO?: string;
  submittedAtFormatted: string;
  details?: string;
}

export const TherapistDashboard: React.FC<TherapistDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [todayAppointments, setTodayAppointments] = useState<AppointmentData[]>([]);
  const [pendingFormSubmissions, setPendingFormSubmissions] = useState<IndividualFormSubmissionItem[]>([]);
  const [notifications, setNotifications] = useState<PracticeNotification[]>([]);
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

      // Build individual pending review items for EVERY signed consent form and EVERY submitted intake form
      const pendingItemsList: IndividualFormSubmissionItem[] = [];

      // 1. Process all signed consent documents as individual notification items
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

        pendingItemsList.push({
          id: `signed_doc_${docSnap.id}`,
          clientId: d.clientId || '',
          clientName,
          itemType: 'signed_consent',
          formTitle: d.documentTitle || 'Practice Consent & Agreement',
          submittedAtISO: isoTimestamp,
          submittedAtFormatted: formattedDate,
          details: `Version: ${d.templateVersion || 'v1.0'} | Audit Hash: ${d.documentHash || 'N/A'}`
        });
      });

      // 2. Process all intake questionnaire submissions as individual notification items
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

          pendingItemsList.push({
            id: `intake_sub_${c.uid}`,
            clientId: c.uid,
            clientName,
            itemType: 'intake_form',
            formTitle: 'Initial Clinical Intake Questionnaire',
            submittedAtISO: isoTimestamp,
            submittedAtFormatted: formattedDate,
            details: 'Completed full clinical intake questionnaire packet.'
          });
        }
      });

      // Sort newest submissions first
      pendingItemsList.sort((a, b) => {
        const timeA = a.submittedAtISO ? new Date(a.submittedAtISO).getTime() : 0;
        const timeB = b.submittedAtISO ? new Date(b.submittedAtISO).getTime() : 0;
        return timeB - timeA;
      });

      setPendingFormSubmissions(pendingItemsList);

      const combinedNotifs: PracticeNotification[] = [...notifDocs];

      // Merge appointment booking/change events into activity feed
      allAppts.forEach((appt) => {
        const clientName = appt.clientName || appt.clientEmail || 'Client';
        const dateStr = appt.startISO ? new Date(appt.startISO).toLocaleString() : 'N/A';
        const apptNoticeMsg = `${clientName} booked session (${appt.appointmentTypeName || 'Therapy Session'}) for ${dateStr}.`;

        const exists = combinedNotifs.some(
          (n) => n.clientId === appt.clientId && n.message === apptNoticeMsg
        );

        if (!exists && appt.status !== 'canceled' && appt.status !== 'canceled_by_client') {
          combinedNotifs.push({
            id: `appt_act_${appt.id}`,
            type: 'appointment_created',
            title: '📅 New Appointment Booked',
            message: apptNoticeMsg,
            clientId: appt.clientId,
            clientName,
            details: `Status: ${appt.status} | Format: ${appt.format}`,
            createdAt: appt.createdAt || appt.startISO
          });
        }
      });

      // Merge profile activity updates
      allClients.forEach((c: any) => {
        if (c.updatedAt || c.lastActivityAt) {
          const clientName = (c.legalFirstName ? `${c.legalFirstName} ${c.legalLastName || ''}` : c.email || 'Client').trim();
          const noticeMsg = c.lastActivityNotice || `${clientName} updated profile information.`;

          const exists = combinedNotifs.some(
            (n) => n.clientId === c.uid && (n.message === noticeMsg || n.title.includes('Profile'))
          );

          if (!exists) {
            combinedNotifs.push({
              id: `client_act_${c.uid}`,
              type: 'profile_updated',
              title: '👤 Client Profile Saved / Updated',
              message: noticeMsg,
              clientId: c.uid,
              clientName,
              details: `Email: ${c.email || 'N/A'}`,
              createdAt: c.lastActivityAt || c.updatedAt
            });
          }
        }
      });

      const getNoticeTime = (n: any): number => {
        if (n.createdAtISO) {
          const t = new Date(n.createdAtISO).getTime();
          if (!isNaN(t) && t > 0) return t;
        }
        if (n.createdAt?.seconds) return n.createdAt.seconds * 1000;
        if (n.createdAt) {
          const t = new Date(n.createdAt).getTime();
          if (!isNaN(t) && t > 0) return t;
        }
        return Date.now();
      };

      combinedNotifs.sort((a, b) => getNoticeTime(b) - getNoticeTime(a));

      setNotifications(combinedNotifs);
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
      (snapshot) => {
        const notifs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as PracticeNotification));

        const getNoticeTime = (n: any): number => {
          if (n.createdAtISO) {
            const t = new Date(n.createdAtISO).getTime();
            if (!isNaN(t) && t > 0) return t;
          }
          if (n.createdAt?.seconds) return n.createdAt.seconds * 1000;
          if (n.createdAt) {
            const t = new Date(n.createdAt).getTime();
            if (!isNaN(t) && t > 0) return t;
          }
          return Date.now();
        };

        notifs.sort((a, b) => getNoticeTime(b) - getNoticeTime(a));

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
              <p className="text-xs font-semibold uppercase text-[#4A5741]">Forms & Intakes Pending Review</p>
              <p className="text-3xl font-serif font-bold text-[#BF5B33]">{pendingFormSubmissions.length}</p>
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
                      <div className="text-[11px] bg-white/90 p-3 rounded-xl border border-gray-200/80 mt-2 space-y-1 font-mono text-[#2C2A2A]">
                        <strong className="block text-[10px] font-sans font-bold uppercase tracking-wider text-[#BF5B33]">
                          Detailed Audit & Form Summary:
                        </strong>
                        <div className="whitespace-pre-line leading-relaxed text-[11px] font-sans opacity-95">
                          {notif.details}
                        </div>
                      </div>
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

      {/* Pending Client Forms & Intake Questionnaires Section */}
      {pendingFormSubmissions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm space-y-3 font-sans">
          <div className="border-b border-amber-200/80 pb-2">
            <h3 className="text-base font-serif font-medium text-amber-900 flex items-center gap-2">
              ⚠️ Client Forms & Intake Questionnaires Awaiting Review ({pendingFormSubmissions.length})
            </h3>
            <p className="text-xs text-amber-800/80 mt-0.5">
              Clients who have submitted clinical intake packets or signed practice consent forms & agreements requiring clinician review.
            </p>
          </div>

          <div className="space-y-2.5 pt-1">
            {pendingFormSubmissions.map((item) => {
              const isConsent = item.itemType === 'signed_consent';

              return (
                <div key={item.id} className="bg-white p-4 rounded-xl border border-amber-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs shadow-xs">
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm text-[#2C2A2A] font-semibold">{item.clientName}</strong>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        isConsent ? 'bg-blue-100 text-blue-900 border-blue-200' : 'bg-amber-100 text-amber-900 border-amber-200'
                      }`}>
                        {isConsent ? '✍️ Signed Consent Form' : '📋 Intake Questionnaire'}
                      </span>
                      <span className="text-[11px] text-gray-500 font-medium ml-auto sm:ml-0">
                        🕒 {item.submittedAtFormatted}
                      </span>
                    </div>
                    <p className="text-[#2C2A2A] font-bold text-xs">
                      {item.formTitle}
                    </p>
                    {item.details && (
                      <p className="text-[11px] text-gray-600 italic">
                        {item.details}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onNavigate('clients')}
                    className="px-4 py-2 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-semibold text-xs rounded-xl shadow-xs transition whitespace-nowrap self-end sm:self-center"
                  >
                    {isConsent ? 'Review Form →' : 'Review Packet →'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
