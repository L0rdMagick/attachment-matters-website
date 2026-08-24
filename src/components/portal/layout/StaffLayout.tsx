import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase/config';
import { usePortalModal } from '../common/PortalModalContext';

interface StaffLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  canSwitchRole?: boolean;
  effectiveRole?: string;
  onRoleOverrideChange?: (role: 'admin' | 'therapist' | 'client') => void;
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

export const StaffLayout: React.FC<StaffLayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  canSwitchRole,
  effectiveRole,
  onRoleOverrideChange
}) => {
  const { user, profile, role, logout } = useAuth();
  const { showConfirm } = usePortalModal();
  const [activeAlert, setActiveAlert] = useState<PopupNoticeAlert | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadAlertsList, setUnreadAlertsList] = useState<PopupNoticeAlert[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleConfirmSignOut = () => {
    showConfirm({
      title: '🚪 Confirm Sign Out',
      message: 'Are you sure you want to sign out of the Family Trust Therapy portal?',
      icon: '🚪',
      confirmText: 'Yes, Sign Out',
      cancelText: 'Stay Logged In',
      variant: 'warning',
      onConfirm: () => logout()
    });
  };

  useEffect(() => {
    if (!user) return;

    let notifList: PopupNoticeAlert[] = [];
    let cancelList: PopupNoticeAlert[] = [];

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

    const updateCombinedAlerts = () => {
      const combined = [...notifList, ...cancelList];
      combined.sort((a, b) => getNoticeTime(b) - getNoticeTime(a));

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
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'calendar', label: 'Schedule' },
    { id: 'clients', label: 'Directory' },
    { id: 'clinical-notes', label: 'Clinical Notes' },
    { id: 'shared-notes', label: 'Shared Summaries' },
    { id: 'billing', label: 'Billing' },
    { id: 'intake-templates', label: 'Forms' },
    { id: 'settings', label: 'Settings' }
  ];

  const roleTitle = role === 'admin' ? 'Practice Administrator' : 'Licensed Therapist';

  return (
    <div className="min-h-screen bg-[#F7F2E9] text-[#2C2A2A] font-sans flex flex-col print:bg-white print:p-0 relative">
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
                className="w-full py-3 px-6 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-semibold text-xs rounded-xl shadow-md transition min-h-[44px]"
              >
                Acknowledge & Dismiss Notice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-[#EAE1D2] sticky top-0 z-30 no-print print:hidden shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Mobile Menu Hamburger Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-[#2C2A2A] hover:bg-[#F7F2E9] border border-[#EAE1D2] transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? '✕' : '☰'}
              </button>

              <a href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                <img src="/images/family-trust-therapy-logo.png" alt="Family Trust Therapy Logo" className="h-10 sm:h-12 w-10 sm:w-12 object-contain" />
                <div>
                  <span className="block font-serif font-bold text-lg sm:text-xl leading-tight text-[#2C2A2A]">Family Trust</span>
                  <span className="block font-serif text-sm sm:text-base leading-tight text-[#2C2A2A]">Therapy</span>
                </div>
              </a>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (unreadAlertsList.length > 0) {
                      setActiveAlert(unreadAlertsList[0]);
                    }
                  }}
                  className="px-2.5 sm:px-3 py-1.5 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-[11px] sm:text-xs font-semibold rounded-xl animate-bounce flex items-center gap-1 shadow-md transition min-h-[38px]"
                  title="Click to view real-time notice"
                >
                  🔔 <span className="hidden sm:inline">Real-Time Notice</span> ({unreadCount})
                </button>
              )}
              <div className="hidden md:block text-right">
                <p className="text-xs sm:text-sm font-bold text-[#2C2A2A]">
                  {profile?.legalFirstName ? `${profile.legalFirstName} ${profile.legalLastName}` : (user?.email || 'dev@austintarotreader.com')}
                </p>
                <p className="text-[11px] text-[#BF5B33] font-medium">{roleTitle}</p>
              </div>
              <button
                onClick={handleConfirmSignOut}
                className="text-[11px] sm:text-xs font-medium text-[#BF5B33] hover:text-[#a64e2b] border border-[#BF5B33]/40 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full hover:bg-[#BF5B33]/5 transition min-h-[38px] flex items-center"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Desktop & Tablet Nav Bar */}
          <nav className="hidden lg:flex items-center justify-between space-x-1 overflow-x-auto no-scrollbar border-t border-[#EAE1D2]/60 pt-1 pb-1 touch-scroll">
            <div className="flex items-center space-x-1">
              <a
                href="/"
                className="px-3.5 py-2 text-xs font-semibold rounded-lg text-[#4A5741] hover:bg-[#4A5741]/10 transition whitespace-nowrap flex items-center gap-1"
              >
                🌐 Home
              </a>
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                      isActive
                        ? 'bg-[#BF5B33] text-white shadow-xs'
                        : 'text-[#2C2A2A]/80 hover:text-[#2C2A2A] hover:bg-[#EAE1D2]/50'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* View As Dropdown for Owner / Admin */}
            {canSwitchRole && onRoleOverrideChange && (
              <div className="flex items-center gap-1.5 ml-3 pl-3 border-l border-[#EAE1D2] shrink-0">
                <label htmlFor="staff-view-as-select" className="text-xs font-bold text-[#BF5B33] whitespace-nowrap">
                  View As:
                </label>
                <select
                  id="staff-view-as-select"
                  value={effectiveRole || 'admin'}
                  onChange={(e) => onRoleOverrideChange(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-lg border border-[#BF5B33]/40 bg-white text-xs font-semibold text-[#2C2A2A] outline-none focus:ring-2 focus:ring-[#BF5B33]/20 cursor-pointer shadow-xs"
                >
                  <option value="admin">Admin</option>
                  <option value="therapist">Therapist</option>
                  <option value="client">Client</option>
                </select>
              </div>
            )}
          </nav>

          {/* Mobile Collapsible Navigation Menu (Accordion) */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-[#EAE1D2] py-3 bg-[#F7F2E9]/95 backdrop-blur-md rounded-b-2xl animate-fade-in shadow-lg px-2 space-y-2 mb-2">
              <div className="px-3 py-2.5 bg-white rounded-xl border border-[#EAE1D2] flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-bold text-[#2C2A2A]">
                    {profile?.legalFirstName ? `${profile.legalFirstName} ${profile.legalLastName}` : (user?.email || 'dev@austintarotreader.com')}
                  </p>
                  <p className="text-[11px] text-[#BF5B33] font-medium">{roleTitle}</p>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleConfirmSignOut();
                  }}
                  className="text-xs text-[#BF5B33] font-semibold border border-[#BF5B33]/30 px-3 py-1.5 rounded-full hover:bg-[#BF5B33]/10"
                >
                  Sign Out
                </button>
              </div>

              {/* View As Dropdown Selector in Mobile Drawer */}
              {canSwitchRole && onRoleOverrideChange && (
                <div className="px-3 py-2.5 bg-white rounded-xl border border-[#EAE1D2] space-y-1">
                  <label htmlFor="staff-mobile-view-as-select" className="text-[11px] font-bold uppercase tracking-wider text-[#BF5B33] block">
                    View As Experience:
                  </label>
                  <select
                    id="staff-mobile-view-as-select"
                    value={effectiveRole || 'admin'}
                    onChange={(e) => {
                      onRoleOverrideChange(e.target.value as any);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full p-2.5 rounded-xl border border-[#BF5B33]/40 bg-[#F7F2E9] text-xs font-semibold text-[#2C2A2A] outline-none cursor-pointer"
                  >
                    <option value="admin">Admin</option>
                    <option value="therapist">Therapist</option>
                    <option value="client">Client</option>
                  </select>
                </div>
              )}

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (unreadAlertsList.length > 0) {
                      setActiveAlert(unreadAlertsList[0]);
                    }
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-2.5 px-3 bg-[#BF5B33] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                >
                  🔔 Real-Time Notice ({unreadCount})
                </button>
              )}

              <p className="text-[10px] font-bold uppercase tracking-wider text-[#BF5B33] px-3 pt-1">Portal Navigation Views</p>
              <div className="grid grid-cols-1 gap-1">
                <a
                  href="/"
                  className="w-full text-left px-4 py-3 text-xs font-semibold rounded-xl bg-white text-[#4A5741] hover:bg-[#4A5741]/10 border border-[#EAE1D2]/60 flex items-center justify-between min-h-[44px]"
                >
                  <span>🌐 Home</span>
                  <span>↗</span>
                </a>
                {navItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onTabChange(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-xs font-semibold rounded-xl transition flex items-center justify-between min-h-[44px] ${
                        isActive
                          ? 'bg-[#BF5B33] text-white shadow-xs'
                          : 'bg-white text-[#2C2A2A] hover:bg-[#EAE1D2]/50 border border-[#EAE1D2]/60'
                      }`}
                    >
                      <span>{item.label}</span>
                      {isActive && <span className="text-white text-sm">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 print:p-0 print:m-0 print:max-w-full">
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
