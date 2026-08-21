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
import { ClientDocumentsView } from './client/ClientDocumentsView';
import { ConsentSigner } from './consent/ConsentSigner';
import { TemplateManagerView } from './templates/TemplateManagerView';

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
  const { user, profile, role: initialRole, loading, isSuspended, logout } = useAuth();
  const [authScreen, setAuthScreen] = useState<AuthScreen>('login');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Allow switching roles during testing/management
  const [activeRoleOverride, setActiveRoleOverride] = useState<'client' | 'admin' | 'therapist' | null>(null);

  // Auto-promote owner/dev email to admin
  const isOwner = user?.email?.toLowerCase() === 'dev@austintarotreader.com';
  const effectiveRole = activeRoleOverride || (isOwner ? 'admin' : initialRole);

  // Automatically clear stored browser session for deleted or suspended accounts
  useEffect(() => {
    if (user && isSuspended) {
      logout();
    }
  }, [user, isSuspended, logout]);

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

  // Suspended, Archived, or Deleted Account Handling
  if (user && isSuspended) {
    const isDeletedAccount = profile?.status === 'deleted';
    const isArchivedAccount = profile?.status === 'archived';

    return (
      <div className="min-h-screen bg-[#F7F2E9] flex items-center justify-center font-sans px-4">
        <div className="bg-[#ffffff] border border-amber-200 rounded-2xl p-8 max-w-md text-center shadow-sm space-y-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center mx-auto text-xl">
            {isArchivedAccount ? '📁' : '🛑'}
          </div>
          <h2 className="text-2xl font-serif text-[#2C2A2A] font-medium">
            {isArchivedAccount ? 'Account Archived' : isDeletedAccount ? 'Account Closed' : 'Account Suspended'}
          </h2>
          <p className="text-[#2C2A2A]/70 text-sm leading-relaxed">
            {isArchivedAccount
              ? 'Your account has been archived. Please email the practice administrator to restore account visibility and reactivate your portal access.'
              : isDeletedAccount
              ? 'This account has been deleted by practice administration and is no longer accessible.'
              : 'Your portal access has been temporarily suspended by the practice administrator. Please contact our main office for assistance.'}
          </p>
          <button
            onClick={() => logout()}
            className="w-full py-2.5 px-6 bg-[#BF5B33] text-white font-medium text-xs rounded-xl hover:bg-[#a64e2b] transition shadow-sm"
          >
            Sign Out & Exit
          </button>
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

  const handleRoleOverrideChange = (newRole: 'admin' | 'therapist' | 'client') => {
    setActiveRoleOverride(newRole);
    setActiveTab('dashboard');
  };

  // Client Portal Experience
  if (effectiveRole === 'client') {
    return (
      <ClientLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        canSwitchRole={isOwner}
        effectiveRole={effectiveRole}
        onRoleOverrideChange={handleRoleOverrideChange}
      >
        {activeTab === 'dashboard' && <ClientDashboard onNavigate={setActiveTab} />}
        {activeTab === 'profile' && <ClientProfileView />}
        {activeTab === 'appointments' && <AppointmentBookingModal />}
        {activeTab === 'documents' && <ClientDocumentsView />}
        {activeTab === 'notes' && <SharedNotesView />}
        {activeTab === 'billing' && <LedgerManager />}
      </ClientLayout>
    );
  }

class PortalErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Portal Component Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-lg mx-auto my-12 bg-white border-2 border-red-300 rounded-3xl text-center space-y-4 shadow-xl font-sans">
          <div className="w-12 h-12 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto font-bold text-xl">
            ⚠️
          </div>
          <h2 className="text-xl font-serif text-[#2C2A2A] font-bold">Portal Render Recovered</h2>
          <p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
            {this.state.error?.message || 'A temporary component display issue occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-6 py-2.5 bg-[#BF5B33] text-white text-xs font-semibold rounded-xl hover:bg-[#a64e2b] transition"
          >
            🔄 Reload Portal View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

  // Therapist / Admin Staff Experience
  return (
    <PortalErrorBoundary>
      <StaffLayout
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setSelectedClientId(null);
        }}
        canSwitchRole={isOwner}
        effectiveRole={effectiveRole}
        onRoleOverrideChange={handleRoleOverrideChange}
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
        {activeTab === 'intake-templates' && <TemplateManagerView />}
      </StaffLayout>
    </PortalErrorBoundary>
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
