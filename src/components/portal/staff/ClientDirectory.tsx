import React, { useState, useEffect } from 'react';
import { getClientsDirectory } from '../../../lib/firebase/clients';
import type { ClientProfileData } from '../../../types/client';

interface ClientDirectoryProps {
  onSelectClient: (clientId: string) => void;
}

export const ClientDirectory: React.FC<ClientDirectoryProps> = ({ onSelectClient }) => {
  const [clients, setClients] = useState<ClientProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [intakeFilter, setIntakeFilter] = useState('');

  useEffect(() => {
    async function loadDirectory() {
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
    }
    loadDirectory();
  }, [searchQuery, statusFilter, intakeFilter]);

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
            className="px-3 py-2 rounded-xl border border-[#EAE1D2] text-xs bg-white text-[#2C2A2A]"
          >
            <option value="">All Account Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
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
                  <th className="py-3.5 px-6">Phone</th>
                  <th className="py-3.5 px-6">Intake Status</th>
                  <th className="py-3.5 px-6">Consent</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE1D2]">
                {clients.map((c) => (
                  <tr key={c.uid} className="hover:bg-[#F7F2E9]/40 transition">
                    <td className="py-4 px-6 font-semibold text-[#2C2A2A]">
                      {c.legalLastName ? `${c.legalLastName}, ${c.legalFirstName}` : c.email}{' '}
                      {c.preferredName ? <span className="text-[#4A5741] font-normal">("{c.preferredName}")</span> : ''}
                    </td>
                    <td className="py-4 px-6 text-[#2C2A2A]/80">{c.email}</td>
                    <td className="py-4 px-6 text-[#2C2A2A]/80">{c.primaryPhone || 'N/A'}</td>
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
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => onSelectClient(c.uid)}
                        className="px-3.5 py-1.5 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-medium text-xs rounded-lg transition"
                      >
                        Open Chart →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
