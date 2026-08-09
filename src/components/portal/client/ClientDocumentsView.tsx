import React, { useState } from 'react';
import { ConsentSigner } from '../consent/ConsentSigner';
import { IntakeFormRunner } from '../intake/IntakeFormRunner';

export const ClientDocumentsView: React.FC = () => {
  const [docTab, setDocTab] = useState<'consent' | 'intake'>('consent');

  return (
    <div className="space-y-6 font-sans">
      {/* Sub-navigation tabs for Client Forms & Documents - Hidden on Print */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-2 shadow-sm flex space-x-1 no-print print:hidden">
        <button
          onClick={() => setDocTab('consent')}
          className={`flex-1 py-3 px-4 text-xs font-semibold rounded-xl transition text-center flex items-center justify-center gap-2 ${
            docTab === 'consent'
              ? 'bg-[#4A5741] text-white shadow-sm'
              : 'text-[#2C2A2A]/80 hover:text-[#2C2A2A] hover:bg-[#EAE1D2]/50'
          }`}
        >
          <span>✍️ Practice Consent Forms & E-Signed Agreements</span>
        </button>
        <button
          onClick={() => setDocTab('intake')}
          className={`flex-1 py-3 px-4 text-xs font-semibold rounded-xl transition text-center flex items-center justify-center gap-2 ${
            docTab === 'intake'
              ? 'bg-[#4A5741] text-white shadow-sm'
              : 'text-[#2C2A2A]/80 hover:text-[#2C2A2A] hover:bg-[#EAE1D2]/50'
          }`}
        >
          <span>📋 Initial Clinical Intake Questionnaire</span>
        </button>
      </div>

      {/* Tab Content */}
      {docTab === 'consent' && <ConsentSigner />}
      {docTab === 'intake' && <IntakeFormRunner />}
    </div>
  );
};
