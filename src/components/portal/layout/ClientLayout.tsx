import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { EmergencyNoticeHeader } from './EmergencyNoticeHeader';
import { VerifyEmailBanner } from '../auth/VerifyEmailBanner';

interface ClientLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const ClientLayout: React.FC<ClientLayoutProps> = ({ children, activeTab, onTabChange }) => {
  const { user, profile, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'appointments', label: 'Appointments & Booking' },
    { id: 'documents', label: 'Forms & Documents' },
    { id: 'notes', label: 'Shared Session Notes' },
    { id: 'billing', label: 'Billing & Invoices' },
    { id: 'profile', label: 'My Profile' }
  ];

  return (
    <div className="min-h-screen bg-[#F7F2E9] text-[#2C2A2A] font-sans flex flex-col print:bg-white print:p-0">
      {/* Emergency Top Banner */}
      <div className="no-print print:hidden">
        <EmergencyNoticeHeader />
      </div>

      {/* Main Header / Navigation */}
      <header className="bg-white border-b border-[#EAE1D2] sticky top-0 z-30 no-print print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Practice Branding */}
            <div className="flex items-center gap-3">
              <a href="/" className="flex items-center gap-2 group">
                <span className="font-serif text-2xl font-semibold text-[#2C2A2A] tracking-tight group-hover:text-[#BF5B33] transition">
                  Family Trust Therapy
                </span>
                <span className="text-xs bg-[#4A5741]/10 text-[#4A5741] font-sans font-semibold px-2.5 py-0.5 rounded-full">
                  Client Portal
                </span>
              </a>
            </div>

            {/* User Info & Logout */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-semibold text-[#2C2A2A]">
                  {profile?.legalFirstName || user?.email}
                </p>
                <p className="text-[11px] text-[#4A5741]">Client Account</p>
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
          <nav className="flex space-x-1 overflow-x-auto border-t border-[#EAE1D2]/60 pt-1 pb-1 font-sans">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`px-4 py-2.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                    isActive
                      ? 'bg-[#4A5741] text-white shadow-sm'
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

      {/* Verification Warning if email not verified */}
      <div className="no-print print:hidden">
        <VerifyEmailBanner />
      </div>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0 print:m-0 print:max-w-full">
        {children}
      </main>

      {/* Portal Footer */}
      <footer className="bg-white border-t border-[#EAE1D2] py-6 text-xs text-[#2C2A2A]/70 text-center font-sans mt-auto no-print print:hidden">
        <div className="max-w-7xl mx-auto px-4">
          <p>© {new Date().getFullYear()} Family Trust Therapy. All rights reserved.</p>
          <p className="mt-1 text-[11px] text-[#2C2A2A]/50">
            Secure HIPAA-aligned client platform. Authorized access only.
          </p>
        </div>
      </footer>
    </div>
  );
};
