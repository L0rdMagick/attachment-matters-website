import React, { useState } from 'react';

interface PracticeTemplate {
  id: string;
  name: string;
  category: 'intake' | 'consent' | 'financial' | 'telehealth';
  version: string;
  lastUpdated: string;
  status: 'active' | 'draft' | 'archived';
  description: string;
  requiredForIntake: boolean;
  contentPreview: string;
}

export const TemplateManagerView: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<PracticeTemplate | null>(null);

  const templates: PracticeTemplate[] = [
    {
      id: 'intake-v1',
      name: 'Initial Client Clinical Intake Questionnaire',
      category: 'intake',
      version: 'v1.4 (2026)',
      lastUpdated: '2026-08-01',
      status: 'active',
      description: 'Comprehensive initial questionnaire capturing reason for therapy, medical history, social history, and safety screening.',
      requiredForIntake: true,
      contentPreview: `SECTION 1: Reason for Therapy & Goals
• Primary reason for presentation & symptoms
• Treatment goals and desired clinical outcomes

SECTION 2: Medical & Treatment History
• Previous counseling and psychiatric care
• Current prescription & OTC medications
• Primary care providers & relevant medical conditions

SECTION 3: Social History, Safety & Disclosures
• Relationship & employment status
• Family/social background & substance use
• Standard Columbia-SSRS Safety Screening Assessment`
    },
    {
      id: 'consent-psychotherapy-v1',
      name: 'Informed Consent for Psychotherapy & Clinical Services',
      category: 'consent',
      version: 'v1.2 (2026)',
      lastUpdated: '2026-07-15',
      status: 'active',
      description: 'Legal agreement covering therapeutic process, confidentiality parameters, mandatory reporting, and client rights.',
      requiredForIntake: true,
      contentPreview: `1. Nature of Psychotherapy Services
Psychotherapy is a collaborative process between clinician and client designed to address psychological, emotional, and relational concerns.

2. Confidentiality & HIPAA Exceptions
All disclosures are kept strictly confidential except under mandatory legal reporting requirements:
- Imminent risk of self-harm or harm to others
- Suspected child, elder, or vulnerable adult abuse
- Valid court order or judicial subpoena

3. Cancellation & Attendance Policy
Sessions must be canceled at least 24 hours in advance to avoid standard cancellation fees.`
    },
    {
      id: 'consent-telehealth-v1',
      name: 'Telehealth Services Informed Consent Addendum',
      category: 'telehealth',
      version: 'v1.1 (2026)',
      lastUpdated: '2026-07-20',
      status: 'active',
      description: 'Specialized consent for HIPAA-compliant audio/video sessions, emergency protocols, and technical requirements.',
      requiredForIntake: true,
      contentPreview: `1. Telehealth Platform & Security
Sessions take place over encrypted, HIPAA-compliant video technology.

2. Emergency Location Protocol
Client must verify current physical location address and local emergency contact at the start of each session.

3. Disconnection Protocol
If video connection fails, clinician will re-attempt connection via primary telephone line.`
    },
    {
      id: 'financial-agreement-v1',
      name: 'Financial Responsibility & Billing Agreement',
      category: 'financial',
      version: 'v1.3 (2026)',
      lastUpdated: '2026-07-10',
      status: 'active',
      description: 'Fee schedule, payment methods, insurance claim policies, and financial authorization.',
      requiredForIntake: true,
      contentPreview: `1. Practice Fee Schedule
- Initial Intake Assessment (60 min): $175.00
- Individual Therapy Session (50 min): $150.00
- Family / Couples Therapy Session (50 min): $165.00

2. Payment Terms & Card Authorization
Payment is due at the time of service. Payment cards are securely stored via PCI-compliant gateway.`
    }
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-[#2C2A2A] font-medium">Practice Form Templates & Legal Documents</h2>
          <p className="text-xs text-[#2C2A2A]/70 mt-1">
            Master practice templates dispatched to new clients during onboarding.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1.5 rounded-full font-semibold bg-[#4A5741]/10 text-[#4A5741] border border-[#4A5741]/20">
            4 Active Templates
          </span>
        </div>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {templates.map((tmpl) => (
          <div key={tmpl.id} className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#F7F2E9] text-[#BF5B33] border border-[#EAE1D2]">
                  {tmpl.category}
                </span>
                <span className="text-[11px] font-mono text-gray-500">{tmpl.version}</span>
              </div>
              <h3 className="font-serif font-bold text-lg text-[#2C2A2A]">{tmpl.name}</h3>
              <p className="text-xs text-[#2C2A2A]/80 leading-relaxed">{tmpl.description}</p>
            </div>

            <div className="pt-4 border-t border-[#EAE1D2] flex items-center justify-between">
              <div className="text-[11px] text-gray-500">
                <span>Updated: {tmpl.lastUpdated}</span>
              </div>
              <button
                onClick={() => setSelectedTemplate(tmpl)}
                className="px-3.5 py-1.5 bg-[#4A5741] hover:bg-[#384232] text-white text-xs font-semibold rounded-xl shadow-sm transition"
              >
                👁️ Preview Master Template
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Template Preview Modal */}
      {selectedTemplate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#EAE1D2] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#F7F2E9] text-[#BF5B33]">
                  {selectedTemplate.category} • {selectedTemplate.version}
                </span>
                <h3 className="text-xl font-serif text-[#2C2A2A] font-medium mt-1">{selectedTemplate.name}</h3>
              </div>
              <button
                onClick={() => setSelectedTemplate(null)}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#F7F2E9] p-4 rounded-xl border border-[#EAE1D2] font-mono text-xs text-[#2C2A2A] whitespace-pre-wrap leading-relaxed">
              {selectedTemplate.contentPreview}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedTemplate(null)}
                className="px-5 py-2 bg-[#2C2A2A] text-white text-xs font-semibold rounded-xl"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
