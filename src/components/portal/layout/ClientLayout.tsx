import React, { useState } from 'react';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      <header className="bg-white border-b border-[#EAE1D2] sticky top-0 z-30 no-print print:hidden shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Practice Branding & Hamburger Toggle */}
            <div className="flex items-center gap-2 sm:gap-3">
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

            {/* User Info & Logout */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-xs sm:text-sm font-bold text-[#2C2A2A]">
                  {profile?.legalFirstName ? `${profile.legalFirstName} ${profile.legalLastName || ''}` : user?.email}
                </p>
                <p className="text-[11px] text-[#4A5741] font-medium">Client Care Account</p>
              </div>
              <button
                onClick={logout}
                className="text-[11px] sm:text-xs font-medium text-[#BF5B33] hover:text-[#a64e2b] border border-[#BF5B33]/40 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full hover:bg-[#BF5B33]/5 transition min-h-[38px] flex items-center"
              >
                Sign Out
              </button>
            </div>
          </div>

          {/* Desktop Navigation Bar */}
          <nav className="hidden lg:flex space-x-1 overflow-x-auto no-scrollbar border-t border-[#EAE1D2]/60 pt-1 pb-1 font-sans touch-scroll">
            <a
              href="/"
              className="px-4 py-2.5 text-xs font-semibold rounded-lg text-[#4A5741] hover:bg-[#4A5741]/10 transition whitespace-nowrap flex items-center gap-1"
            >
              🌐 Home Website
            </a>
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`px-4 py-2.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
                    isActive
                      ? 'bg-[#4A5741] text-white shadow-xs'
                      : 'text-[#2C2A2A]/80 hover:text-[#2C2A2A] hover:bg-[#EAE1D2]/50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Mobile Navigation Drawer Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-[#EAE1D2] py-3 bg-[#F7F2E9]/95 backdrop-blur-md rounded-b-2xl animate-fade-in shadow-lg px-2 space-y-2 mb-2">
              <div className="px-3 py-2.5 bg-white rounded-xl border border-[#EAE1D2] flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-bold text-[#2C2A2A]">
                    {profile?.legalFirstName ? `${profile.legalFirstName} ${profile.legalLastName || ''}` : user?.email}
                  </p>
                  <p className="text-[11px] text-[#4A5741] font-medium">Client Care Account</p>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="text-xs text-[#BF5B33] font-semibold border border-[#BF5B33]/30 px-3 py-1.5 rounded-full hover:bg-[#BF5B33]/10"
                >
                  Sign Out
                </button>
              </div>

              <p className="text-[10px] font-bold uppercase tracking-wider text-[#4A5741] px-3 pt-1">Portal Views</p>
              <div className="grid grid-cols-1 gap-1">
                <a
                  href="/"
                  className="w-full text-left px-4 py-3 text-xs font-semibold rounded-xl bg-white text-[#4A5741] hover:bg-[#4A5741]/10 border border-[#EAE1D2]/60 flex items-center justify-between min-h-[44px]"
                >
                  <span>🌐 Home Website</span>
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
                          ? 'bg-[#4A5741] text-white shadow-xs'
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

      {/* Verification Warning if email not verified */}
      <div className="no-print print:hidden">
        <VerifyEmailBanner />
      </div>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 print:p-0 print:m-0 print:max-w-full">
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
