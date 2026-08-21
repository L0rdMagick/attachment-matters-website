import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { EmergencyNoticeHeader } from './EmergencyNoticeHeader';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';

interface StaffLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

interface PopupNoticeAlert {
  id: string;
  type?: string;
  title: string;
  message: string;
  clientName: string;
  details?: string;
  createdAt?: any;
  sourceCollection: 'practiceNotifications' | 'cancellationAlerts';
}

export const StaffLayout: React.FC<StaffLayoutProps> = ({ children, activeTab, onTabChange }) => {
  const { user, profile, role, logout } = useAuth();
  const [activeAlert, setActiveAlert] = useState<PopupNoticeAlert | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadAlertsList, setUnreadAlertsList] = useState<PopupNoticeAlert[]>([]);

  useEffect(() => {
    if (!user) return;

    let notifList: PopupNoticeAlert[] = [];
    let cancelList: PopupNoticeAlert[] = [];

    const updateCombinedAlerts = () => {
      const combined = [...notifList, ...cancelList];
      combined.sort((a, b) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : Date.now());
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : Date.now());
        return timeB - timeA;
      });

      setUnreadCount(combined.length);
      setUnreadAlertsList(combined);
      setActiveAlert(combined.length > 0 ? combined[0] : null);
    };

    // 1. Independent listener for practiceNotifications
    const unsubNotifs = onSnapshot(
      collection(db, 'practiceNotifications'),
      (snapshot) => {
        try {
          notifList = snapshot.docs
            .map((d) => ({ id: d.id, sourceCollection: 'practiceNotifications', ...d.data() } as any))
            .filter((n) => n.read !== true);
          updateCombinedAlerts();
        } catch (err) {
          console.warn("Error processing practiceNotifications snapshot:", err);
        }
      },
      (err) => {
        console.warn("Failed to subscribe to practiceNotifications:", err);
      }
    );

    // 2. Independent listener for cancellationAlerts
    const unsubCancels = onSnapshot(
      collection(db, 'cancellationAlerts'),
      (snapCancels) => {
        try {
          cancelList = snapCancels.docs
            .map((d) => ({
              id: d.id,
              sourceCollection: 'cancellationAlerts',
              type: 'appointment_canceled',
              title: '🛑 Appointment Canceled by Client',
              message: `${d.data().clientName || 'Client'} canceled session (${d.data().appointmentTypeName || 'Therapy Session'}).`,
              clientName: d.data().clientName || 'Client',
              details: d.data().reason || '',
              createdAt: d.data().canceledAt,
              read: d.data().read
            }))
            .filter((c) => c.read !== true);
          updateCombinedAlerts();
        } catch (err) {
          console.warn("Error processing cancellationAlerts snapshot:", err);
        }
      },
      (err) => {
        console.warn("Failed to subscribe to cancellationAlerts:", err);
      }
    );

    return () => {
      unsubNotifs();
      unsubCancels();
    };
  }, [user]);

  const handleDismissAlert = async () => {
    if (!activeAlert?.id) return;
    try {
      await updateDoc(doc(db, activeAlert.sourceCollection, activeAlert.id), {
        read: true
      });
      const remaining = unreadAlertsList.filter((a) => a.id !== activeAlert.id);
      setUnreadAlertsList(remaining);
      setActiveAlert(remaining.length > 0 ? remaining[0] : null);
    } catch (err) {
      console.error("Failed to dismiss notice", err);
      setActiveAlert(null);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Therapist Dashboard' },
    { id: 'calendar', label: 'Calendar & Schedule' },
    { id: 'clients', label: 'Client Directory' },
    { id: 'clinical-notes', label: 'Private Clinical Notes' },
    { id: 'shared-notes', label: 'Shared Summaries' },
    { id: 'billing', label: 'Billing & Ledger' },
    { id: 'intake-templates', label: 'Templates & Forms' },
    { id: 'settings', label: 'Practice Settings' }
  ];

  const roleTitle = role === 'admin' ? 'Practice Administrator' : 'Licensed Therapist';

  return (
    <div className="min-h-screen bg-[#F7F2E9] text-[#2C2A2A] font-sans flex flex-col print:bg-white print:p-0 relative">
      <div className="no-print print:hidden">
        <EmergencyNoticeHeader />
      </div>

      {/* Real-time Client Activity Pop-up Modal Notice */}
      {activeAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white border-2 border-[#BF5B33] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-[#EAE1D2] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#BF5B33]/10 text-[#BF5B33] flex items-center justify-center font-bold text-xl">
                  {activeAlert.type === 'appointment_canceled' ? '🚨' :
                   activeAlert.type === 'appointment_created' ? '📅' :
                   activeAlert.type === 'intake_submitted' ? '📝' :
                   activeAlert.type === 'document_signed' ? '📄' : '🔔'}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-[#2C2A2A]">
                    {activeAlert.title}
                  </h3>
                  <p className="text-[11px] text-[#BF5B33] font-semibold uppercase tracking-wider">
                    Staff Real-Time Notice
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#F7F2E9] border border-[#EAE1D2] rounded-2xl p-4 space-y-2 text-xs text-[#2C2A2A]">
              <p>
                <strong className="font-bold text-[#4A5741]">Client:</strong>{' '}
                <span className="font-semibold text-sm text-[#2C2A2A]">{activeAlert.clientName}</span>
              </p>
              <p className="leading-relaxed">
                {activeAlert.message}
              </p>
              {activeAlert.details && (
                <div className="mt-2 p-2.5 bg-white rounded-xl border border-[#EAE1D2] text-[#2C2A2A]">
                  <strong className="text-[#BF5B33] text-[11px] uppercase block mb-0.5 font-bold">Details / Reason:</strong>
                  <span className="italic text-[#2C2A2A]/90 whitespace-pre-line">{activeAlert.details}</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleDismissAlert}
                className="w-full py-3 px-6 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-semibold text-xs rounded-xl shadow-md transition"
              >
                Acknowledge & Dismiss Notice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-[#EAE1D2] sticky top-0 z-30 no-print print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center gap-3">
              <a href="/" className="flex items-center gap-2 group">
                <span className="font-serif text-2xl font-semibold text-[#2C2A2A] tracking-tight group-hover:text-[#BF5B33] transition">
                  Family Trust Therapy
                </span>
                <span className="text-xs bg-[#BF5B33]/10 text-[#BF5B33] font-sans font-semibold px-2.5 py-0.5 rounded-full">
                  Clinical & Staff Portal
                </span>
              </a>
            </div>

            <div className="flex items-center gap-4">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (unreadAlertsList.length > 0) {
                      setActiveAlert(unreadAlertsList[0]);
                    }
                  }}
                  className="px-3 py-1.5 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl animate-bounce flex items-center gap-1.5 shadow-md transition"
                  title="Click to view real-time notice"
                >
                  🔔 Real-Time Notice ({unreadCount})
                </button>
              )}
              <div className="hidden sm:block text-right">
                <p className="text-xs font-semibold text-[#2C2A2A]">
                  {profile?.legalFirstName ? `${profile.legalFirstName} ${profile.legalLastName}` : user?.email}
                </p>
                <p className="text-[11px] text-[#BF5B33] font-medium">{roleTitle}</p>
              </div>
              <button
                onClick={logout}
                className="text-xs font-medium text-[#BF5B33] hover:text-[#a64e2b] border border-[#BF5B33]/30 px-3 py-1.5 rounded-lg hover:bg-[#BF5B33]/5 transition"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Navigation Bar */}
          <nav className="flex space-x-1 overflow-x-auto border-t border-[#EAE1D2]/60 pt-1 pb-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`px-4 py-2.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                    isActive
                      ? 'bg-[#BF5B33] text-white shadow-sm'
                      : 'text-[#2C2A2A]/80 hover:text-[#2C2A2A] hover:bg-[#EAE1D2]/50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0 print:m-0 print:max-w-full">
        {children}
      </main>

      {/* Staff Footer */}
      <footer className="bg-white border-t border-[#EAE1D2] py-6 text-xs text-[#2C2A2A]/70 text-center font-sans mt-auto no-print print:hidden">
        <div className="max-w-7xl mx-auto px-4">
          <p>© {new Date().getFullYear()} Family Trust Therapy - Administrative & Clinical Access</p>
          <p className="mt-1 text-[11px] text-[#BF5B33]">
            🔒 Confidential Healthcare Application. All access and actions are recorded in immutable audit logs.
          </p>
        </div>
      </footer>
    </div>
  );
};
