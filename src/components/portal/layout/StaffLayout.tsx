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

interface CancellationNoticeAlert {
  id: string;
  appointmentId: string;
  clientId: string;
  clientName: string;
  appointmentTypeName: string;
  startISO: string;
  reason: string;
  canceledAt: string;
  read: boolean;
}

export const StaffLayout: React.FC<StaffLayoutProps> = ({ children, activeTab, onTabChange }) => {
  const { user, profile, role, logout } = useAuth();
  const [activeAlert, setActiveAlert] = useState<CancellationNoticeAlert | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'cancellationAlerts'),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const docData = snapshot.docs[0];
          setActiveAlert({ id: docData.id, ...docData.data() } as CancellationNoticeAlert);
        } else {
          setActiveAlert(null);
        }
      },
      (err) => {
        console.warn("Cancellation alert listener notice:", err);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleDismissAlert = async () => {
    if (!activeAlert?.id) return;
    try {
      await updateDoc(doc(db, 'cancellationAlerts', activeAlert.id), {
        read: true
      });
      setActiveAlert(null);
    } catch (err) {
      console.error("Failed to dismiss cancellation alert notice", err);
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

      {/* Real-time Client Cancellation Notice Modal */}
      {activeAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white border-2 border-red-500 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between border-b border-red-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold text-xl">
                  🚨
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-red-900">
                    Appointment Canceled by Client
                  </h3>
                  <p className="text-[11px] text-red-700 font-semibold uppercase tracking-wider">
                    Staff Notification Notice
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#F7F2E9] border border-[#EAE1D2] rounded-2xl p-4 space-y-2 text-xs text-[#2C2A2A]">
              <p>
                <strong className="font-bold text-[#4A5741]">Client Name:</strong>{' '}
                <span className="font-semibold text-sm text-[#2C2A2A]">{activeAlert.clientName}</span>
              </p>
              <p>
                <strong className="font-bold text-[#4A5741]">Session Type:</strong>{' '}
                <span>{activeAlert.appointmentTypeName}</span>
              </p>
              <p>
                <strong className="font-bold text-[#4A5741]">Scheduled Date/Time:</strong>{' '}
                <span className="font-semibold">{new Date(activeAlert.startISO).toLocaleString()}</span>
              </p>
              {activeAlert.reason && (
                <div className="mt-2 p-2.5 bg-white rounded-xl border border-red-200 text-[#2C2A2A]">
                  <strong className="text-red-800 text-[11px] uppercase block mb-0.5 font-bold">Cancellation Reason:</strong>
                  <span className="italic text-[#2C2A2A]/90">{activeAlert.reason}</span>
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
