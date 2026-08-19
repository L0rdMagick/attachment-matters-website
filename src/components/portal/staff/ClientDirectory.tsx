import React, { useState, useEffect } from 'react';
import { getClientsDirectory, deleteClientProfile, archiveClientProfile, unarchiveClientProfile } from '../../../lib/firebase/clients';
import { useAuth } from '../../../context/AuthContext';
import type { ClientProfileData } from '../../../types/client';

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

  const handleArchiveClient = async (c: ClientProfileData) => {
    const name = c.legalFirstName ? `${c.legalFirstName} ${c.legalLastName || ''}` : c.email;
    if (!window.confirm(`📁 Archive client chart for ${name}?\n\nThis will revoke their portal sign-in and hide them from active booking dropdowns, while securely retaining their clinical records for HIPAA retention compliance.`)) {
      return;
    }

    try {
      await archiveClientProfile(c.uid, user?.uid || '', role || '');
      await loadDirectory();
      alert(`Client chart for ${name} has been archived. Portal access revoked.`);
    } catch (err) {
      console.error("Failed to archive client", err);
      alert("Failed to archive client record.");
    }
  };

  const handleRestoreClient = async (c: ClientProfileData) => {
    const name = c.legalFirstName ? `${c.legalFirstName} ${c.legalLastName || ''}` : c.email;
    if (!window.confirm(`↩️ Restore active status for ${name}?\n\nThis will restore their portal login access and include them in active scheduling dropdowns.`)) {
      return;
    }

    try {
      await unarchiveClientProfile(c.uid, user?.uid || '', role || '');
      await loadDirectory();
      alert(`Client chart for ${name} has been reactivated.`);
    } catch (err) {
      console.error("Failed to restore client", err);
      alert("Failed to restore client record.");
    }
  };

  const handleDeleteClient = async (c: ClientProfileData) => {
    const name = c.legalFirstName ? `${c.legalFirstName} ${c.legalLastName || ''}` : c.email;
    if (!window.confirm(`⚠️ PERMANENT PURGE: Delete all database records for ${name} (${c.email})?\n\nThis will permanently wipe their profile, intake forms, agreements, and appointments from Firebase.`)) {
      return;
    }

    try {
      await deleteClientProfile(c.uid, c.email);
      setClients((prev) => prev.filter((item) => item.uid !== c.uid && item.email !== c.email));
      alert(`Client record for ${name} has been permanently deleted.`);
    } catch (err) {
      console.error("Failed to delete client", err);
      alert("Failed to delete client record. Please try again.");
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header & Filter Controls */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-[#2C2A2A] font-medium">Practice Client Directory</h2>
          <p className="text-xs text-[#2C2A2A]/70 mt-1">
            Search, filter, and manage client medical records and administrative charts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 rounded-xl border border-[#EAE1D2] text-xs focus:ring-2 focus:ring-[#BF5B33] outline-none min-w-[200px]"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#EAE1D2] text-xs bg-white text-[#2C2A2A] font-medium"
          >
            <option value="">Active Clients Only (Default)</option>
            <option value="archived">📁 Archived Charts (Read-Only)</option>
            <option value="all">All Accounts (Active & Archived)</option>
            <option value="suspended">Suspended Accounts</option>
          </select>

          <select
            value={intakeFilter}
            onChange={(e) => setIntakeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#EAE1D2] text-xs bg-white text-[#2C2A2A]"
          >
            <option value="">All Intake Statuses</option>
            <option value="not_started">Intake Not Started</option>
            <option value="submitted">Submitted (Pending Review)</option>
            <option value="approved">Approved</option>
            <option value="revision_requested">Revision Requested</option>
          </select>
        </div>
      </div>

      {/* Directory List Table */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#2C2A2A]/70">Loading client directory...</div>
        ) : clients.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#2C2A2A]/60">
            No clients match the specified search or filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#F7F2E9] text-[#2C2A2A] uppercase tracking-wider font-semibold border-b border-[#EAE1D2]">
                <tr>
                  <th className="py-3.5 px-6">Client Name</th>
                  <th className="py-3.5 px-6">Contact Email</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Intake</th>
                  <th className="py-3.5 px-6">Consent</th>
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
                      <td className="py-4 px-6 text-[#2C2A2A]/80">{c.email}</td>
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
                      <td className="py-4 px-6 text-right whitespace-nowrap space-x-2">
                        <button
                          onClick={() => onSelectClient(c.uid)}
                          className="px-3.5 py-1.5 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-medium text-xs rounded-lg transition"
                        >
                          Open Chart →
                        </button>
                        {isArchived ? (
                          <button
                            onClick={() => handleRestoreClient(c)}
                            className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 font-medium text-xs border border-green-200 rounded-lg transition"
                            title="Reactivate client chart & portal login"
                          >
                            ↩️ Restore
                          </button>
                        ) : (
                          <button
                            onClick={() => handleArchiveClient(c)}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-medium text-xs border border-amber-200 rounded-lg transition"
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
        )}
      </div>
    </div>
  );
};
