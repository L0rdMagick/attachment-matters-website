import React, { useState, useEffect } from 'react';
import { usePortalModal } from '../common/PortalModalContext';
import { getConsentTemplates, saveConsentTemplate, deleteConsentTemplate } from '../../../lib/firebase/consent';
import type { ConsentTemplateData, FormSection } from '../../../types/consent';

export const TemplateManagerView: React.FC = () => {
  const { showConfirm, showAlert } = usePortalModal();
  const [templates, setTemplates] = useState<ConsentTemplateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<{
    isOpen: boolean;
    template: ConsentTemplateData | null;
    isEditing: boolean;
  }>({
    isOpen: false,
    template: null,
    isEditing: false
  });

  const [formData, setFormData] = useState<Partial<ConsentTemplateData>>({});
  const [sections, setSections] = useState<FormSection[]>([]);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await getConsentTemplates();
      setTemplates(data);
    } catch (err) {
      console.error("Failed to load templates:", err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to convert textContent to sections if sections array is missing
  const parseSectionsFromText = (text: string): FormSection[] => {
    if (!text.trim()) return [];
    const parts = text.split(/\n(?=[0-9]+\.|\bSECTION\b|\b[A-Z0-9\s]{4,}:)/gi);
    return parts.map((part, i) => {
      const lines = part.trim().split('\n');
      const title = lines[0].trim();
      const content = lines.slice(1).join('\n').trim();
      return {
        id: `sec-${Date.now()}-${i}`,
        title: title || `Section ${i + 1}`,
        content: content || (lines[0].trim() ? '' : part.trim())
      };
    });
  };

  const handleOpenAddModal = () => {
    const newTemplate: ConsentTemplateData = {
      id: `tmpl-${Date.now()}`,
      title: '',
      category: 'Clinical Treatment',
      version: 'v1.0 (2026)',
      isActive: true,
      requiredForIntake: true,
      description: '',
      sections: [
        {
          id: `sec-${Date.now()}-1`,
          title: '1. Purpose & Overview',
          content: 'Enter section content here...'
        }
      ],
      textContent: ''
    };
    setFormData(newTemplate);
    setSections(newTemplate.sections || []);
    setActiveModal({ isOpen: true, template: newTemplate, isEditing: true });
  };

  const handleOpenViewModal = (tmpl: ConsentTemplateData) => {
    setFormData(tmpl);
    if (tmpl.sections && tmpl.sections.length > 0) {
      setSections(tmpl.sections);
    } else {
      setSections(parseSectionsFromText(tmpl.textContent || ''));
    }
    setActiveModal({ isOpen: true, template: tmpl, isEditing: false });
  };

  const handleStartEdit = () => {
    setActiveModal((prev) => ({ ...prev, isEditing: true }));
  };

  const handleAddSection = () => {
    const newSec: FormSection = {
      id: `sec-${Date.now()}-${sections.length + 1}`,
      title: `${sections.length + 1}. New Section Title`,
      content: ''
    };
    setSections((prev) => [...prev, newSec]);
  };

  const handleUpdateSection = (id: string, field: 'title' | 'content', val: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: val } : s))
    );
  };

  const handleDeleteSection = (id: string) => {
    if (sections.length <= 1) {
      showAlert('⚠️ Section Required', 'A form template must have at least one section.', 'warning', '⚠️');
      return;
    }
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sections.length) return;
    const copy = [...sections];
    const temp = copy[index];
    copy[index] = copy[newIndex];
    copy[newIndex] = temp;
    setSections(copy);
  };

  const handleDeleteTemplate = (tmpl: ConsentTemplateData) => {
    showConfirm({
      title: '⚠️ Delete Practice Form Template',
      message: `Are you sure you want to delete "${tmpl.title}"?`,
      details: 'This template will be removed from the practice library and will no longer appear in the client portal.',
      icon: '🗑️',
      confirmText: 'Delete Template',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteConsentTemplate(tmpl.id);
          await loadTemplates();
          setActiveModal({ isOpen: false, template: null, isEditing: false });
          showAlert('✓ Template Deleted', `Practice form template "${tmpl.title}" was removed successfully.`, 'success', '✓');
        } catch (err) {
          showAlert('⚠️ Delete Failed', 'Could not delete template.', 'danger', '⚠️');
        }
      }
    });
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) {
      showAlert('⚠️ Missing Information', 'Please provide a title for the form template.', 'danger', '⚠️');
      return;
    }

    // Build formatted textContent from sections
    const formattedText = sections
      .map((s) => `${s.title}\n${s.content}`)
      .join('\n\n')
      .trim();

    const savedTemplate: ConsentTemplateData = {
      id: formData.id || `tmpl-${Date.now()}`,
      title: formData.title.trim(),
      category: formData.category || 'Clinical Treatment',
      version: formData.version || 'v1.0 (2026)',
      isActive: true,
      requiredForIntake: formData.requiredForIntake ?? true,
      description: formData.description || '',
      lastUpdated: new Date().toISOString().split('T')[0],
      sections: sections,
      textContent: formattedText || formData.textContent || ''
    };

    try {
      await saveConsentTemplate(savedTemplate);
      await loadTemplates();
      setActiveModal({ isOpen: false, template: null, isEditing: false });
      showAlert('✓ Template Saved', `Practice form template "${savedTemplate.title}" updated successfully and is now active for clients.`, 'success', '✓');
    } catch (err) {
      console.error("Save template error:", err);
      showAlert('⚠️ Save Error', 'Failed to save template changes.', 'danger', '⚠️');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-serif text-[#2C2A2A] font-medium">Practice Form Templates & Legal Documents</h2>
          <p className="text-xs text-[#2C2A2A]/70 mt-1">
            Master practice templates dispatched to new clients in the Client Portal. Edit sections or create new forms anytime.
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

      {loading ? (
        <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl text-xs text-[#2C2A2A]/70">
          Loading practice templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="p-12 text-center bg-white border border-[#EAE1D2] rounded-2xl space-y-3">
          <span className="text-3xl">📄</span>
          <h3 className="font-serif text-lg font-medium text-[#2C2A2A]">No Practice Templates Found</h3>
          <p className="text-xs text-[#2C2A2A]/70">Click "Add New Form Template" above to create your first practice document.</p>
        </div>
      ) : (
        /* Template Grid */
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
                <h3 className="font-serif font-bold text-lg text-[#2C2A2A]">{tmpl.title}</h3>
                <p className="text-xs text-[#2C2A2A]/80 leading-relaxed">
                  {tmpl.description || (tmpl.sections && tmpl.sections.length > 0 ? `${tmpl.sections.length} Section(s)` : 'Standard Legal Agreement')}
                </p>
              </div>

              <div className="pt-4 border-t border-[#EAE1D2] flex items-center justify-between">
                <div className="text-[11px] text-gray-500">
                  <span>Updated: {tmpl.lastUpdated || '2026-08-01'}</span>
                </div>
                <button
                  onClick={() => handleOpenViewModal(tmpl)}
                  className="px-3.5 py-1.5 bg-[#4A5741] hover:bg-[#384232] text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-1"
                >
                  👁️ Edit / Preview Template
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Template View / Edit / Add Overlay Modal */}
      {activeModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-sans animate-fade-in">
          <div className="bg-[#F7F2E9] border border-[#EAE1D2] rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#EAE1D2] pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeModal.isEditing ? '📝' : '📄'}</span>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white text-[#BF5B33] border border-[#EAE1D2]">
                    {formData.category || 'Clinical Treatment'} • {formData.version || 'v1.0'}
                  </span>
                  <h3 className="text-xl font-serif text-[#2C2A2A] font-medium mt-1">
                    {activeModal.isEditing
                      ? (formData.id && templates.some((t) => t.id === formData.id) ? 'Edit Form Template & Sections' : 'Add New Form Template')
                      : formData.title}
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
              <form onSubmit={handleSaveTemplate} className="flex-1 overflow-y-auto space-y-5 pr-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-[#EAE1D2]">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Form Title *</label>
                    <input
                      type="text"
                      required
                      value={formData.title || ''}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-[#F7F2E9]/40 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#BF5B33]/20"
                      placeholder="e.g., Telehealth Informed Consent Addendum"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Category</label>
                    <input
                      type="text"
                      value={formData.category || ''}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-[#F7F2E9]/40 text-xs font-medium outline-none"
                      placeholder="e.g., Clinical Treatment, Billing Policy"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Version tag</label>
                    <input
                      type="text"
                      value={formData.version || ''}
                      onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-[#F7F2E9]/40 text-xs outline-none"
                      placeholder="e.g., v1.0 (2026)"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">Description / Summary</label>
                    <input
                      type="text"
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full p-2.5 rounded-xl border border-[#EAE1D2] bg-[#F7F2E9]/40 text-xs outline-none"
                      placeholder="Brief description shown in portal view..."
                    />
                  </div>
                </div>

                {/* Section-by-Section Editor */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-serif font-bold text-[#2C2A2A]">Document Sections</h4>
                      <p className="text-[11px] text-[#2C2A2A]/70">Add or edit section titles and text below each section. Changes format automatically for client view.</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddSection}
                      className="px-3 py-1.5 bg-[#4A5741] hover:bg-[#384232] text-white text-xs font-semibold rounded-xl transition shadow-xs flex items-center gap-1"
                    >
                      ➕ Add New Section
                    </button>
                  </div>

                  {sections.map((sec, idx) => (
                    <div key={sec.id || idx} className="bg-white border border-[#EAE1D2] rounded-xl p-4 space-y-3 shadow-xs">
                      <div className="flex items-center justify-between gap-2 border-b border-[#EAE1D2]/60 pb-2">
                        <span className="text-[11px] font-bold uppercase text-[#BF5B33] tracking-wider">
                          Section #{idx + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoveSection(idx, 'up')}
                            disabled={idx === 0}
                            className="p-1 text-xs text-gray-600 hover:text-gray-900 disabled:opacity-30 rounded hover:bg-gray-100"
                            title="Move section up"
                          >
                            ⬆️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveSection(idx, 'down')}
                            disabled={idx === sections.length - 1}
                            className="p-1 text-xs text-gray-600 hover:text-gray-900 disabled:opacity-30 rounded hover:bg-gray-100"
                            title="Move section down"
                          >
                            ⬇️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSection(sec.id)}
                            className="p-1 text-xs text-red-600 hover:text-red-800 rounded hover:bg-red-50 ml-2"
                            title="Delete section"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">Section Title</label>
                        <input
                          type="text"
                          required
                          value={sec.title}
                          onChange={(e) => handleUpdateSection(sec.id, 'title', e.target.value)}
                          className="w-full p-2 rounded-lg border border-[#EAE1D2] text-xs font-bold text-[#2C2A2A] outline-none focus:ring-1 focus:ring-[#BF5B33]"
                          placeholder="e.g., 1. Confidentiality & HIPAA Exceptions"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase text-gray-600 mb-1">Section Text Content</label>
                        <textarea
                          rows={4}
                          value={sec.content}
                          onChange={(e) => handleUpdateSection(sec.id, 'content', e.target.value)}
                          className="w-full p-2.5 rounded-lg border border-[#EAE1D2] text-xs text-[#2C2A2A] leading-relaxed outline-none focus:ring-1 focus:ring-[#BF5B33]"
                          placeholder="Write section text here..."
                        />
                      </div>
                    </div>
                  ))}
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
                    ✓ Save & Publish Form
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  {sections.length > 0 ? (
                    sections.map((sec, i) => (
                      <div key={sec.id || i} className="bg-white p-5 rounded-xl border border-[#EAE1D2] space-y-2 shadow-xs">
                        <h4 className="font-serif font-bold text-sm text-[#2C2A2A] border-b border-[#EAE1D2] pb-1.5">
                          {sec.title}
                        </h4>
                        <div className="text-xs text-[#2C2A2A]/90 whitespace-pre-wrap leading-relaxed">
                          {sec.content || <span className="italic text-gray-400">No content provided for this section.</span>}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="bg-white p-5 rounded-xl border border-[#EAE1D2] font-mono text-xs text-[#2C2A2A] whitespace-pre-wrap leading-relaxed">
                      {formData.textContent}
                    </div>
                  )}
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
                      ✏️ Edit Form & Sections
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
