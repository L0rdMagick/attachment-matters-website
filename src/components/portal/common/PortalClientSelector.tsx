import React, { useState } from 'react';
import type { ClientProfileData } from '../../../types/client';

interface PortalClientSelectorProps {
  clients: ClientProfileData[];
  selectedClientId: string;
  onSelectClient: (clientId: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  includeAllOption?: boolean;
  allOptionLabel?: string;
}

export const PortalClientSelector: React.FC<PortalClientSelectorProps> = ({
  clients,
  selectedClientId,
  onSelectClient,
  label,
  placeholder = "Select a Client...",
  className = "",
  includeAllOption = false,
  allOptionLabel = "🌐 All Client Accounts (Practice-Wide)"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedClient = clients.find((c) => c.uid === selectedClientId);

  const selectedClientName = !selectedClientId && includeAllOption
    ? allOptionLabel
    : selectedClient
    ? (selectedClient.legalFirstName
        ? `${selectedClient.legalFirstName} ${selectedClient.legalLastName || ''}`.trim()
        : selectedClient.email || 'Client')
    : placeholder;

  const filteredClients = clients.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = `${c.legalFirstName || ''} ${c.legalLastName || ''}`.toLowerCase();
    const email = (c.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  return (
    <div className={`relative inline-block w-full sm:w-auto ${className}`}>
      {label && (
        <span className="block text-[10px] uppercase font-bold text-[#4A5741] mb-1">
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full sm:min-w-[260px] max-w-sm px-3.5 py-2.5 bg-white border border-[#EAE1D2] hover:border-[#BF5B33]/50 rounded-xl text-left text-xs font-semibold text-[#2C2A2A] shadow-xs hover:bg-[#F7F2E9]/50 transition flex items-center justify-between gap-2 min-h-[42px]"
      >
        <div className="flex items-center gap-2 truncate">
          <span className="text-base shrink-0">👤</span>
          <div className="truncate">
            <p className="truncate text-xs font-bold text-[#2C2A2A]">{selectedClientName}</p>
            {selectedClient?.email && (
              <p className="truncate text-[10px] text-[#4A5741] font-normal">{selectedClient.email}</p>
            )}
          </div>
        </div>
        <span className="text-[#4A5741] text-xs font-bold shrink-0">▾</span>
      </button>

      {/* Portal Client Selection Overlay Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-fade-in">
          <div className="bg-[#F7F2E9] border border-[#EAE1D2] rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-[#EAE1D2] pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">👤</span>
                <div>
                  <h3 className="text-lg font-serif font-medium text-[#2C2A2A]">Select Client Medical Chart</h3>
                  <p className="text-[11px] text-[#4A5741] font-medium">Choose a client from practice directory</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setSearchQuery('');
                }}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm p-1 rounded-lg hover:bg-[#EAE1D2]/50 transition"
              >
                ✕
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="shrink-0">
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-gray-400">🔍</span>
                <input
                  type="text"
                  autoFocus
                  placeholder="Search by client name or email address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-[#EAE1D2] bg-white text-xs font-medium text-[#2C2A2A] outline-none focus:ring-2 focus:ring-[#BF5B33]/20 shadow-xs"
                />
              </div>
            </div>

            {/* Client List */}
            <div className="overflow-y-auto space-y-2 pr-1 flex-1 touch-scroll">
              {includeAllOption && !searchQuery.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectClient('');
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between gap-3 ${
                    selectedClientId === ''
                      ? 'bg-[#BF5B33] text-white border-[#BF5B33] shadow-xs'
                      : 'bg-white text-[#2C2A2A] border-[#EAE1D2] hover:bg-[#F7F2E9] hover:border-[#BF5B33]/30'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      selectedClientId === '' ? 'bg-white/20 text-white' : 'bg-[#F7F2E9] text-[#BF5B33]'
                    }`}>
                      🌐
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold truncate">{allOptionLabel}</p>
                      <p className={`text-[10px] truncate ${selectedClientId === '' ? 'text-white/80' : 'text-[#4A5741]'}`}>
                        Show practice-wide combined ledgers & totals
                      </p>
                    </div>
                  </div>

                  {selectedClientId === '' && (
                    <span className="text-xs font-bold px-2.5 py-1 bg-white/20 rounded-full shrink-0">
                      ✓ Active Practice View
                    </span>
                  )}
                </button>
              )}
              {filteredClients.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-500 bg-white rounded-xl border border-[#EAE1D2]">
                  No matching clients found in directory.
                </div>
              ) : (
                filteredClients.map((c) => {
                  const isSelected = c.uid === selectedClientId;
                  const name = c.legalFirstName
                    ? `${c.legalFirstName} ${c.legalLastName || ''}`.trim()
                    : c.email || 'Client';

                  return (
                    <button
                      key={c.uid}
                      type="button"
                      onClick={() => {
                        onSelectClient(c.uid);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-[#4A5741] text-white border-[#4A5741] shadow-xs'
                          : 'bg-white text-[#2C2A2A] border-[#EAE1D2] hover:bg-[#F7F2E9] hover:border-[#BF5B33]/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 truncate">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-[#F7F2E9] text-[#BF5B33]'
                        }`}>
                          {c.legalFirstName ? c.legalFirstName[0].toUpperCase() : '👤'}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold truncate">{name}</p>
                          <p className={`text-[10px] truncate ${isSelected ? 'text-white/80' : 'text-[#4A5741]'}`}>
                            {c.email || 'No email registered'}
                          </p>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="text-xs font-bold px-2.5 py-1 bg-white/20 rounded-full shrink-0">
                          ✓ Active Chart
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
