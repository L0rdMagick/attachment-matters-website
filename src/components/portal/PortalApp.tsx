import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import { LoginForm } from './auth/LoginForm';
import { RegisterForm } from './auth/RegisterForm';
import { ForgotPasswordForm } from './auth/ForgotPasswordForm';
import { ClientLayout } from './layout/ClientLayout';
import { StaffLayout } from './layout/StaffLayout';

// Dashboards
import { ClientDashboard } from './dashboard/ClientDashboard';
import { TherapistDashboard } from './dashboard/TherapistDashboard';

// Phase 2 Modules
import { ClientProfileView } from './client/ClientProfileView';
import { ClientDirectory } from './staff/ClientDirectory';
import { ClientDetailView } from './staff/ClientDetailView';
import { IntakeFormRunner } from './intake/IntakeFormRunner';
import { ConsentSigner } from './consent/ConsentSigner';

// Phase 3 Modules
import { AppointmentBookingModal } from './scheduling/AppointmentBookingModal';
import { AvailabilityManager } from './scheduling/AvailabilityManager';
import { TherapistCalendar } from './scheduling/TherapistCalendar';

// Phase 4 Modules
import { SharedNotesView } from './notes/SharedNotesView';
import { PrivateClinicalNotesView } from './notes/PrivateClinicalNotesView';
import { LedgerManager } from './billing/LedgerManager';

type AuthScreen = 'login' | 'register' | 'forgot';

const MainPortalContent: React.FC = () => {
  const { user, role: initialRole, loading, isSuspended } = useAuth();
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Allow switching roles during testing/management
  const [activeRoleOverride, setActiveRoleOverride] = useState<'client' | 'admin' | 'therapist' | null>(null);

  // Auto-promote owner/dev email to admin
  const isOwner = user?.email?.toLowerCase() === 'dev@austintarotreader.com';
  const effectiveRole = activeRoleOverride || (isOwner ? 'admin' : initialRole);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F2E9] flex items-center justify-center font-sans">
        <div className="text-center p-8 bg-[#ffffff] border border-[#EAE1D2] rounded-2xl shadow-sm max-w-sm">
          <div className="w-10 h-10 border-4 border-[#BF5B33] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm font-medium text-[#2C2A2A]">Loading secure portal...</p>
        </div>
      </div>
    );
  }

  // Suspended Account Handling
  if (user && isSuspended) {
    return (
      <div className="min-h-screen bg-[#F7F2E9] flex items-center justify-center font-sans px-4">
        <div className="bg-[#ffffff] border border-red-200 rounded-2xl p-8 max-w-md text-center shadow-sm">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-xl">
            🛑
          </div>
          <h2 className="text-2xl font-serif text-[#2C2A2A] mb-2 font-medium">Account Suspended</h2>
          <p className="text-[#2C2A2A]/70 text-sm leading-relaxed mb-6">
            Your portal access has been temporarily suspended by the practice administrator. Please contact our main office for assistance.
          </p>
          <a
            href="/"
            className="inline-block py-2.5 px-6 bg-[#4A5741] text-white font-medium text-sm rounded-xl hover:bg-[#384232] transition"
          >
            Return to Practice Website
          </a>
        </div>
      </div>
    );
  }

  // Unauthenticated user -> Auth forms
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F7F2E9] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
          <h1 className="font-serif text-4xl text-[#2C2A2A] font-semibold tracking-tight">
            Family Trust Therapy
          </h1>
          <p className="text-[#4A5741] text-sm font-medium mt-1">
            Client & Clinical Management Portal
          </p>
        </div>

        {authScreen === 'login' && (
          <LoginForm
            onSwitchToRegister={() => setAuthScreen('register')}
            onSwitchToForgot={() => setAuthScreen('forgot')}
          />
        )}
        {authScreen === 'register' && (
          <RegisterForm onSwitchToLogin={() => setAuthScreen('login')} />
        )}
        {authScreen === 'forgot' && (
          <ForgotPasswordForm onBackToLogin={() => setAuthScreen('login')} />
        )}
      </div>
    );
  }

  // Quick Role Switcher Banner for Owner / Dev
  const RoleSwitcherBanner = () => (
    <div className="bg-[#2C2A2A] text-white px-4 py-2 text-xs font-sans border-b border-[#EAE1D2]/20 no-print print:hidden">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <span className="font-semibold text-[#EAE1D2]">
          ⚙️ Practice Owner / Admin Access ({user.email})
        </span>
        <div className="flex items-center gap-2">
          <span className="opacity-70 text-[11px]">View Experience As:</span>
          <button
            onClick={() => { setActiveRoleOverride('admin'); setActiveTab('dashboard'); }}
            className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition ${
              effectiveRole === 'admin' ? 'bg-[#BF5B33] text-white' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            Practice Admin
          </button>
          <button
            onClick={() => { setActiveRoleOverride('therapist'); setActiveTab('dashboard'); }}
            className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition ${
              effectiveRole === 'therapist' ? 'bg-[#4A5741] text-white' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            Therapist
          </button>
          <button
            onClick={() => { setActiveRoleOverride('client'); setActiveTab('dashboard'); }}
            className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition ${
              effectiveRole === 'client' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            Client Portal View
          </button>
        </div>
      </div>
    </div>
  );

  // Client Portal Experience
  if (effectiveRole === 'client') {
    return (
      <>
        {isOwner && <RoleSwitcherBanner />}
        <ClientLayout activeTab={activeTab} onTabChange={setActiveTab}>
          {activeTab === 'dashboard' && <ClientDashboard onNavigate={setActiveTab} />}
          {activeTab === 'profile' && <ClientProfileView />}
          {activeTab === 'appointments' && <AppointmentBookingModal />}
          {activeTab === 'documents' && (
            <div className="space-y-8">
              <div className="no-print print:hidden">
                <ConsentSigner />
              </div>
              <IntakeFormRunner />
            </div>
          )}
          {activeTab === 'notes' && <SharedNotesView />}
          {activeTab === 'billing' && <LedgerManager />}
        </ClientLayout>
      </>
    );
  }

  // Therapist / Admin Staff Experience
  return (
    <>
      {isOwner && <RoleSwitcherBanner />}
      <StaffLayout
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSelectedClientId(null);
        }}
      >
        {activeTab === 'dashboard' && <TherapistDashboard onNavigate={setActiveTab} />}
        {activeTab === 'calendar' && <TherapistCalendar />}
        {activeTab === 'settings' && <AvailabilityManager />}
        {activeTab === 'clients' && (
          selectedClientId ? (
            <ClientDetailView clientId={selectedClientId} onBack={() => setSelectedClientId(null)} />
          ) : (
            <ClientDirectory onSelectClient={(id) => setSelectedClientId(id)} />
          )
        )}
        {activeTab === 'clinical-notes' && <PrivateClinicalNotesView />}
        {activeTab === 'shared-notes' && <SharedNotesView />}
        {activeTab === 'billing' && <LedgerManager />}
        {activeTab === 'intake-templates' && (
          <div className="space-y-8">
            <ConsentSigner />
          </div>
        )}
      </StaffLayout>
    </>
  );
};

export const PortalApp: React.FC = () => {
  return (
    <AuthProvider>
      <MainPortalContent />
    </AuthProvider>
  );
};

export default PortalApp;
