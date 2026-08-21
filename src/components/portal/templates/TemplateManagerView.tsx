import React, { useState } from 'react';
import { usePortalModal } from '../common/PortalModalContext';

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

const INITIAL_TEMPLATES: PracticeTemplate[] = [
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

export const TemplateManagerView: React.FC = () => {
  const { showConfirm, showAlert } = usePortalModal();
  const [templates, setTemplates] = useState<PracticeTemplate[]>(INITIAL_TEMPLATES);
  const [activeModal, setActiveModal] = useState<{
    isOpen: boolean;
    template: PracticeTemplate | null;
    isEditing: boolean;
  }>({
    isOpen: false,
    template: null,
    isEditing: false
  });

  const [formData, setFormData] = useState<Partial<PracticeTemplate>>({});

  const handleOpenAddModal = () => {
    const newTemplate: PracticeTemplate = {
      id: `tmpl-${Date.now()}`,
      name: '',
      category: 'consent',
      version: 'v1.0 (2026)',
      lastUpdated: new Date().toISOString().split('T')[0],
      status: 'active',
      description: '',
      requiredForIntake: true,
      contentPreview: ''
    };
    setFormData(newTemplate);
    setActiveModal({ isOpen: true, template: newTemplate, isEditing: true });
  };

  const handleOpenViewModal = (tmpl: PracticeTemplate) => {
    setFormData(tmpl);
    setActiveModal({ isOpen: true, template: tmpl, isEditing: false });
  };

  const handleStartEdit = () => {
    setActiveModal((prev) => ({ ...prev, isEditing: true }));
  };

  const handleDeleteTemplate = (tmpl: PracticeTemplate) => {
    showConfirm({
      title: '⚠️ Delete Practice Form Template',
      message: `Are you sure you want to delete "${tmpl.name}"?`,
      details: 'This template will be removed from the practice library and will no longer be dispatched to new onboarding clients.',
      icon: '🗑️',
      confirmText: 'Delete Template',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: () => {
        setTemplates((prev) => prev.filter((t) => t.id !== tmpl.id));
        setActiveModal({ isOpen: false, template: null, isEditing: false });
        showAlert('✓ Template Deleted', `Practice form template "${tmpl.name}" was removed successfully.`, 'success', '✓');
      }
    });
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.contentPreview) {
      showAlert('⚠️ Missing Information', 'Please fill in both the template title and content body.', 'danger', '⚠️');
      return;
    }

    const savedTemplate: PracticeTemplate = {
      id: formData.id || `tmpl-${Date.now()}`,
      name: formData.name || 'Untitled Template',
      category: formData.category || 'consent',
      version: formData.version || 'v1.0 (2026)',
      lastUpdated: new Date().toISOString().split('T')[0],
      status: 'active',
      description: formData.description || '',
      requiredForIntake: formData.requiredForIntake ?? true,
      contentPreview: formData.contentPreview || ''
    };

    setTemplates((prev) => {
      const exists = prev.some((t) => t.id === savedTemplate.id);
      if (exists) {
        return prev.map((t) => (t.id === savedTemplate.id ? savedTemplate : t));
      }
      return [...prev, savedTemplate];
    });

    setActiveModal({ isOpen: false, template: null, isEditing: false });
    showAlert('✓ Template Saved', `Practice form template "${savedTemplate.name}" updated successfully.`, 'success', '✓');
  };

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
        <div className="flex items-center gap-3">
          <span className="text-xs px-3 py-1.5 rounded-full font-semibold bg-[#4A5741]/10 text-[#4A5741] border border-[#4A5741]/20">
            {templates.length} Active Templates
          </span>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl shadow-xs transition flex items-center gap-1 min-h-[42px]"
          >
            ➕ Add New Form Template
          </button>
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
                onClick={() => handleOpenViewModal(tmpl)}
                className="px-3.5 py-1.5 bg-[#4A5741] hover:bg-[#384232] text-white text-xs font-semibold rounded-xl shadow-sm transition"
              >
                👁️ Preview Master Template
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Template View / Edit / Add Overlay Modal */}
      {activeModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-fade-in">
          <div className="bg-[#F7F2E9] border border-[#EAE1D2] rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#EAE1D2] pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeModal.isEditing ? '📝' : '📄'}</span>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white text-[#BF5B33] border border-[#EAE1D2]">
                    {formData.category || 'Consent'} • {formData.version || 'v1.0'}
                  </span>
                  <h3 className="text-xl font-serif text-[#2C2A2A] font-medium mt-1">
                    {activeModal.isEditing
                      ? (formData.id && templates.some((t) => t.id === formData.id) ? 'Edit Practice Template' : 'Add New Form Template')
                      : formData.name}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setActiveModal({ isOpen: false, template: null, isEditing: false })}
                className="text-gray-400 hover:text-gray-700 text-lg font-bold p-1 rounded-lg hover:bg-[#EAE1D2]/50 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Content / Form Body */}
            {activeModal.isEditing ? (
              <form onSubmit={handleSaveTemplate} className="flex-1 overflow-y-auto space-y-4 pr-1">
                <div>
                  <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Template Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-white text-xs font-semibold outline-none focus:ring-2 focus:ring-[#BF5B33]/20"
                    placeholder="e.g., Telehealth Informed Consent Addendum"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Category</label>
                    <select
                      value={formData.category || 'consent'}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                      className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-white text-xs font-medium"
                    >
                      <option value="intake">Intake</option>
                      <option value="consent">Consent</option>
                      <option value="telehealth">Telehealth</option>
                      <option value="financial">Financial</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Version tag</label>
                    <input
                      type="text"
                      value={formData.version || ''}
                      onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-white text-xs outline-none"
                      placeholder="e.g., v1.5 (2026)"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Description / Onboarding Summary</label>
                  <input
                    type="text"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-white text-xs outline-none"
                    placeholder="Brief description shown to clients during intake..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Master Form Content Body *</label>
                  <textarea
                    required
                    rows={8}
                    value={formData.contentPreview || ''}
                    onChange={(e) => setFormData({ ...formData, contentPreview: e.target.value })}
                    className="w-full p-3 rounded-xl border border-[#EAE1D2] bg-white font-mono text-xs text-[#2C2A2A] outline-none leading-relaxed"
                    placeholder="Type or paste the full legal text for this master template..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-[#EAE1D2]">
                  <button
                    type="button"
                    onClick={() => setActiveModal({ isOpen: false, template: null, isEditing: false })}
                    className="px-4 py-2 bg-[#EAE1D2] hover:bg-[#e0d4c1] text-[#2C2A2A] font-semibold text-xs rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl shadow-xs transition"
                  >
                    ✓ Save Template
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto bg-white p-4 rounded-xl border border-[#EAE1D2] font-mono text-xs text-[#2C2A2A] whitespace-pre-wrap leading-relaxed">
                  {formData.contentPreview}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#EAE1D2] shrink-0">
                  {activeModal.template && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(activeModal.template!)}
                      className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold rounded-xl transition flex items-center gap-1"
                    >
                      🗑️ Delete Template
                    </button>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      className="px-4 py-2 bg-[#BF5B33] hover:bg-[#a64e2b] text-white text-xs font-semibold rounded-xl transition shadow-xs flex items-center gap-1"
                    >
                      ✏️ Edit Template
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModal({ isOpen: false, template: null, isEditing: false })}
                      className="px-4 py-2 bg-[#EAE1D2] hover:bg-[#e0d4c1] text-[#2C2A2A] text-xs font-semibold rounded-xl transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

