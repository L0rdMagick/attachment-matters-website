import React, { useState, useEffect } from 'react';
import { getClientsDirectory, deleteClientProfile, archiveClientProfile, unarchiveClientProfile, updateClientProfile } from '../../../lib/firebase/clients';
import { useAuth } from '../../../context/AuthContext';
import type { ClientProfileData } from '../../../types/client';
import { PortalConfirmModal } from '../common/PortalConfirmModal';

interface ClientDirectoryProps {
  onSelectClient: (clientId: string) => void;
}

export const ClientDirectory: React.FC<ClientDirectoryProps> = ({ onSelectClient }) => {
  const { user, role } = useAuth();
  const [clients, setClients] = useState<ClientProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [intakeFilter, setIntakeFilter] = useState('');

  // Portal Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
    icon?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info' | 'success';
    onConfirm: () => void;
    onCancel?: () => void;
    isAlertOnly?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const closeConfirmModal = () => setConfirmModal((prev) => ({ ...prev, isOpen: false }));

  const loadDirectory = async () => {
    setLoading(true);
    try {
      const data = await getClientsDirectory({
        searchQuery,
        accountStatus: statusFilter || undefined,
        intakeStatus: intakeFilter || undefined
      });
      setClients(data);
    } catch (err) {
      console.error("Failed to load client directory", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory();
  }, [searchQuery, statusFilter, intakeFilter]);

  const handleSelfSchedulingOverrideChange = (c: ClientProfileData, overrideVal: 'global' | 'allowed' | 'restricted') => {
    const name = c.legalFirstName ? `${c.legalFirstName} ${c.legalLastName || ''}` : c.email;
    const label = overrideVal === 'allowed' ? 'Allowed' : overrideVal === 'restricted' ? 'Restricted' : 'Practice Global';
    setConfirmModal({
      isOpen: true,
      title: '⚙️ Change Self-Scheduling Access',
      message: `Change self-scheduling permission for ${name} to "${label}"?`,
      details: overrideVal === 'restricted' 
        ? 'Restricting self-scheduling prevents the client from booking sessions independently in their portal.'
        : overrideVal === 'allowed'
        ? 'Allowing override permits the client to self-schedule regardless of global practice restrictions.'
        : 'Reverting to Practice Global aligns the client with global practice availability settings.',
      icon: '⚙️',
      confirmText: 'Confirm Permission Change',
      cancelText: 'Cancel',
      variant: overrideVal === 'restricted' ? 'warning' : 'info',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await updateClientProfile(c.uid, { allowSelfSchedulingOverride: overrideVal }, user?.uid || '', role || '');
          setClients((prev) => prev.map((item) => item.uid === c.uid ? { ...item, allowSelfSchedulingOverride: overrideVal } : item));
        } catch (err) {
          console.error("Failed to update client self-scheduling permission", err);
        }
      },
      onCancel: closeConfirmModal
    });
  };

  const handleArchiveClient = (c: ClientProfileData) => {
    const name = c.legalFirstName ? `${c.legalFirstName} ${c.legalLastName || ''}` : c.email;
    setConfirmModal({
      isOpen: true,
      title: '📁 Archive Client Chart',
      message: `Are you sure you want to archive the client chart for ${name}?`,
      details: 'This will revoke their portal sign-in and hide them from active booking dropdowns, while securely retaining their clinical records for HIPAA retention compliance.',
      icon: '📁',
      confirmText: 'Yes, Archive Chart',
      cancelText: 'Keep Active',
      variant: 'warning',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await archiveClientProfile(c.uid, user?.uid || '', role || '');
          await loadDirectory();
          setConfirmModal({
            isOpen: true,
            title: '✓ Chart Archived',
            message: `Client chart for ${name} has been archived and portal access revoked.`,
            icon: '✓',
            confirmText: 'OK',
            variant: 'success',
            isAlertOnly: true,
            onConfirm: closeConfirmModal
          });
        } catch (err) {
          console.error("Failed to archive client", err);
        }
      },
      onCancel: closeConfirmModal
    });
  };

  const handleRestoreClient = (c: ClientProfileData) => {
    const name = c.legalFirstName ? `${c.legalFirstName} ${c.legalLastName || ''}` : c.email;
    setConfirmModal({
      isOpen: true,
      title: '↩️ Restore Active Client Chart',
      message: `Are you sure you want to restore active status for ${name}?`,
      details: 'This will restore their portal login access and include them in active practice scheduling dropdowns.',
      icon: '↩️',
      confirmText: 'Yes, Restore Access',
      cancelText: 'Keep Archived',
      variant: 'info',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await unarchiveClientProfile(c.uid, user?.uid || '', role || '');
          await loadDirectory();
          setConfirmModal({
            isOpen: true,
            title: '✓ Access Restored',
            message: `Client chart for ${name} has been reactivated successfully.`,
            icon: '✓',
            confirmText: 'OK',
            variant: 'success',
            isAlertOnly: true,
            onConfirm: closeConfirmModal
          });
        } catch (err) {
          console.error("Failed to restore client", err);
        }
      },
      onCancel: closeConfirmModal
    });
  };

  const handleDeleteClient = (c: ClientProfileData) => {
    const name = c.legalFirstName ? `${c.legalFirstName} ${c.legalLastName || ''}` : c.email;
    setConfirmModal({
      isOpen: true,
      title: '⚠️ Permanent Delete Record',
      message: `Permanently delete all database records for ${name} (${c.email})?`,
      details: 'This action cannot be undone and will permanently wipe their profile, intake forms, and appointments from Firebase.',
      icon: '🗑️',
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirmModal();
        try {
          await deleteClientProfile(c.uid, c.email);
          setClients((prev) => prev.filter((item) => item.uid !== c.uid && item.email !== c.email));
          setConfirmModal({
            isOpen: true,
            title: '✓ Record Deleted',
            message: `Client record for ${name} has been permanently deleted.`,
            icon: '✓',
            confirmText: 'OK',
            variant: 'success',
            isAlertOnly: true,
            onConfirm: closeConfirmModal
          });
        } catch (err) {
          console.error("Failed to delete client", err);
        }
      },
    });
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header & Filter Controls */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif text-[#2C2A2A] font-medium">Practice Client Directory</h2>
          <p className="text-xs text-[#2C2A2A]/70 mt-1">
            Search, filter, and manage client medical records and administrative charts.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-xs focus:ring-2 focus:ring-[#BF5B33] outline-none w-full sm:w-[200px] min-h-[42px]"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-[#EAE1D2] text-xs bg-white text-[#2C2A2A] font-medium w-full sm:w-auto min-h-[42px]"
          >
            <option value="">Active Clients Only (Default)</option>
            <option value="archived">📁 Archived Charts (Read-Only)</option>
            <option value="all">All Accounts (Active & Archived)</option>
            <option value="suspended">Suspended Accounts</option>
          </select>

          <select
            value={intakeFilter}
            onChange={(e) => setIntakeFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-[#EAE1D2] text-xs bg-white text-[#2C2A2A] w-full sm:w-auto min-h-[42px]"
          >
            <option value="">All Intake Statuses</option>
            <option value="not_started">Intake Not Started</option>
            <option value="submitted">Submitted (Pending Review)</option>
            <option value="approved">Approved</option>
            <option value="revision_requested">Revision Requested</option>
          </select>
        </div>
      </div>

      {/* Directory List Table / Mobile Cards */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#2C2A2A]/70">Loading client directory...</div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#2C2A2A]/60">
            No clients match the specified search or filter criteria.
          </div>
        ) : (
          <div>
            {/* Mobile Client Cards View (<640px) */}
            <div className="sm:hidden divide-y divide-[#EAE1D2]">
              {clients.map((c) => {
                const isArchived = c.accountStatus === 'archived';
                return (
                  <div key={c.uid} className={`p-4 space-y-3 ${isArchived ? 'bg-gray-50/80' : 'bg-white'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-sm text-[#2C2A2A]">
                          {c.legalLastName ? `${c.legalLastName}, ${c.legalFirstName}` : c.email}{' '}
                          {c.preferredName ? <span className="text-[#4A5741] font-normal">("{c.preferredName}")</span> : ''}
                        </h4>
                        <p className="text-xs text-[#2C2A2A]/70 truncate max-w-[220px]">{c.email}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase whitespace-nowrap ${
                        isArchived ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-green-100 text-green-800'
                      }`}>
                        {isArchived ? '📁 Archived' : (c.accountStatus || 'Active')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-[#F7F2E9] p-2 rounded-xl">
                        <span className="text-[10px] text-gray-500 font-bold uppercase block">Intake</span>
                        <span className="font-medium text-[#2C2A2A] capitalize">
                          {c.intakeStatus ? c.intakeStatus.replace('_', ' ') : 'Not Started'}
                        </span>
                      </div>
                      <div className="bg-[#F7F2E9] p-2 rounded-xl">
                        <span className="text-[10px] text-gray-500 font-bold uppercase block">Consent</span>
                        <span className="font-medium text-[#2C2A2A] capitalize">
                          {c.consentStatus || 'Pending'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-1">
                      <button
                        onClick={() => onSelectClient(c.uid)}
                        className="w-full py-2.5 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-semibold text-xs rounded-xl shadow-xs transition min-h-[42px] flex items-center justify-center"
                      >
                        Open Chart →
                      </button>
                      {isArchived ? (
                        <button
                          onClick={() => handleRestoreClient(c)}
                          className="w-full py-2.5 bg-green-50 hover:bg-green-100 text-green-700 font-semibold text-xs border border-green-200 rounded-xl transition min-h-[42px] flex items-center justify-center"
                        >
                          ↩️ Restore Chart
                        </button>
                      ) : (
                        <button
                          onClick={() => handleArchiveClient(c)}
                          className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs border border-amber-200 rounded-xl transition min-h-[42px] flex items-center justify-center"
                        >
                          📁 Archive Chart
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop & Tablet Table View (>=640px) */}
            <div className="hidden sm:block overflow-x-auto touch-scroll">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#F7F2E9] text-[#2C2A2A] uppercase tracking-wider font-semibold border-b border-[#EAE1D2]">
                  <tr>
                    <th className="py-3.5 px-6">Client Name</th>
                    <th className="py-3.5 px-6">Contact Email</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6">Intake</th>
                    <th className="py-3.5 px-6">Consent</th>
                    <th className="py-3.5 px-6">Self-Scheduling</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE1D2]">
                  {clients.map((c) => {
                    const isArchived = c.accountStatus === 'archived';
                    return (
                      <tr key={c.uid} className={`hover:bg-[#F7F2E9]/40 transition ${isArchived ? 'bg-gray-50/70' : ''}`}>
                        <td className="py-4 px-6 font-semibold text-[#2C2A2A]">
                          {c.legalLastName ? `${c.legalLastName}, ${c.legalFirstName}` : c.email}{' '}
                          {c.preferredName ? <span className="text-[#4A5741] font-normal">("{c.preferredName}")</span> : ''}
                        </td>
                        <td className="py-4 px-6 text-[#2C2A2A]/80 break-all">{c.email}</td>
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium capitalize ${
                            isArchived ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-green-100 text-green-800'
                          }`}>
                            {isArchived ? '📁 Archived' : (c.accountStatus || 'Active')}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium capitalize ${
                            c.intakeStatus === 'approved'
                              ? 'bg-green-100 text-green-800'
                              : c.intakeStatus === 'submitted'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {c.intakeStatus ? c.intakeStatus.replace('_', ' ') : 'Not Started'}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium capitalize ${
                            c.consentStatus === 'completed' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {c.consentStatus || 'Pending'}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <select
                            value={c.allowSelfSchedulingOverride || 'global'}
                            onChange={(e) => handleSelfSchedulingOverrideChange(c, e.target.value as any)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border outline-none cursor-pointer transition ${
                              c.allowSelfSchedulingOverride === 'allowed'
                                ? 'bg-green-50 text-green-800 border-green-300'
                                : c.allowSelfSchedulingOverride === 'restricted'
                                ? 'bg-red-50 text-red-800 border-red-300'
                                : 'bg-gray-50 text-gray-700 border-gray-200'
                            }`}
                          >
                            <option value="global">🌐 Practice Global</option>
                            <option value="allowed">✅ Allowed (Override)</option>
                            <option value="restricted">🚫 Restricted (Override)</option>
                          </select>
                        </td>
                        <td className="py-4 px-6 text-right whitespace-nowrap space-x-2">
                          <button
                            onClick={() => onSelectClient(c.uid)}
                            className="px-3.5 py-1.5 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-medium text-xs rounded-lg transition min-h-[36px]"
                          >
                            Open Chart →
                          </button>
                          {isArchived ? (
                            <button
                              onClick={() => handleRestoreClient(c)}
                              className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 font-medium text-xs border border-green-200 rounded-lg transition min-h-[36px]"
                              title="Reactivate client chart & portal login"
                            >
                              ↩️ Restore
                            </button>
                          ) : (
                            <button
                              onClick={() => handleArchiveClient(c)}
                              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-medium text-xs border border-amber-200 rounded-lg transition min-h-[36px]"
                              title="Archive client chart & revoke portal sign-in (HIPAA Soft Delete)"
                            >
                              📁 Archive
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Portal Confirm Modal */}
      <PortalConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        details={confirmModal.details}
        icon={confirmModal.icon}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={confirmModal.onCancel || closeConfirmModal}
        isAlertOnly={confirmModal.isAlertOnly}
      />
    </div>
  );
};
