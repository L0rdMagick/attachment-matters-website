import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getConsentTemplates, getSignedDocuments, signConsentDocument } from '../../../lib/firebase/consent';
import type { ConsentTemplateData, SignedDocumentData } from '../../../types/consent';
import { PrintableSignedConsentDocument } from './PrintableSignedConsentDocument';

export const ConsentSigner: React.FC = () => {
  const { user, profile } = useAuth();
  const [templates, setTemplates] = useState<ConsentTemplateData[]>([]);
  const [signedDocs, setSignedDocs] = useState<SignedDocumentData[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ConsentTemplateData | null>(null);
  const [typedSignature, setTypedSignature] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Canvas ref for optional drawn signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function loadData() {
      try {
        const [temps, signed] = await Promise.all([
          getConsentTemplates(),
          getSignedDocuments(user!.uid)
        ]);
        setTemplates(temps);
        setSignedDocs(signed);
        if (temps.length > 0) setSelectedTemplate(temps[0]);
      } catch (err) {
        console.error("Failed to load consent documents", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
    ctx.strokeStyle = '#2C2A2A';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const isAlreadySigned = (templateId: string) => {
    return signedDocs.some((d) => d.templateId === templateId);
  };

  const getSignedDocForTemplate = (templateId: string) => {
    return signedDocs.find((d) => d.templateId === templateId);
  };

  const handleSignDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedTemplate) return;
    if (!typedSignature.trim()) {
      alert("Please type your full legal name as your signature.");
      return;
    }
    if (!acknowledged) {
      alert("Please check the acknowledgment box before signing.");
      return;
    }

    setSigning(true);
    setMessage(null);

    try {
      let signatureDataUrl: string | undefined = undefined;
      if (canvasRef.current) {
        signatureDataUrl = canvasRef.current.toDataURL();
      }

      const docHash = await signConsentDocument(
        user.uid,
        selectedTemplate,
        typedSignature.trim(),
        signatureDataUrl
      );

      // Refresh signed docs
      const updatedSigned = await getSignedDocuments(user.uid);
      setSignedDocs(updatedSigned);
      setMessage(`Document successfully signed and archived! Unique Audit Hash: ${docHash}`);
      setTypedSignature('');
      setAcknowledged(false);
      clearCanvas();
    } catch (err) {
      console.error(err);
      alert("Failed to record document signature. Please try again.");
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center bg-white border border-[#EAE1D2] rounded-2xl">Loading consent documents...</div>;
  }

  return (
    <div className="space-y-8 font-sans">
      {/* Top Banner */}
      <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm no-print print:hidden">
        <h2 className="text-3xl font-serif text-[#2C2A2A] font-medium">Practice Consent Forms & Agreements</h2>
        <p className="text-xs text-[#2C2A2A]/70 mt-1">
          Review, sign, and download required clinical policies and legal agreements. Signed documents are immutably archived.
        </p>
      </div>

      {message && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-xs font-semibold no-print print:hidden">
          {message}
        </div>
      )}

      {/* Document Selector & Viewer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Template Selector List */}
        <div className="bg-white border border-[#EAE1D2] rounded-2xl p-4 shadow-sm space-y-2 no-print print:hidden">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4A5741] px-2 mb-3">Required Documents</h3>
          {templates.map((t) => {
            const signed = isAlreadySigned(t.id);
            const isSelected = selectedTemplate?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t)}
                className={`w-full text-left p-3 rounded-xl text-xs font-medium transition flex items-center justify-between ${
                  isSelected ? 'bg-[#4A5741] text-white' : 'bg-[#F7F2E9] text-[#2C2A2A] hover:bg-[#EAE1D2]/60'
                }`}
              >
                <div>
                  <p className="font-semibold">{t.title}</p>
                  <p className={`text-[11px] ${isSelected ? 'text-white/80' : 'text-[#2C2A2A]/60'}`}>{t.category} ({t.version})</p>
                </div>
                <span>{signed ? '✅ Signed' : '📝 Pending'}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Document Text & Signing Form / Printable View */}
        <div className="md:col-span-2 space-y-6">
          {selectedTemplate && (
            isAlreadySigned(selectedTemplate.id) && getSignedDocForTemplate(selectedTemplate.id) ? (
              <PrintableSignedConsentDocument
                clientName={profile?.legalFirstName ? `${profile.legalFirstName} ${profile.legalLastName}` : (user?.email || '')}
                clientEmail={user?.email || ''}
                signedDoc={getSignedDocForTemplate(selectedTemplate.id)!}
              />
            ) : (
              <div className="bg-white border border-[#EAE1D2] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex items-center justify-between border-b border-[#EAE1D2] pb-4">
                  <div>
                    <h3 className="text-2xl font-serif text-[#2C2A2A] font-medium">{selectedTemplate.title}</h3>
                    <span className="text-xs text-[#4A5741] font-semibold">{selectedTemplate.category} • Version {selectedTemplate.version}</span>
                  </div>
                </div>

                {/* Exact Document Text Scroll Area */}
                <div className="bg-[#F7F2E9] border border-[#EAE1D2] rounded-xl p-5 text-xs text-[#2C2A2A] leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap font-mono">
                  {selectedTemplate.textContent}
                </div>

                {/* E-Signature Form */}
                <form onSubmit={handleSignDocument} className="space-y-4 border-t border-[#EAE1D2] pt-4">
                  <h4 className="text-sm font-semibold uppercase text-[#2C2A2A] tracking-wider">
                    Electronic Signature Verification
                  </h4>

                  <div>
                    <label htmlFor="sig-typed" className="block text-xs font-semibold uppercase text-[#2C2A2A] mb-1">
                      Type Your Legal Full Name <span className="text-[#BF5B33]">*</span>
                    </label>
                    <input
                      id="sig-typed"
                      type="text"
                      required
                      value={typedSignature}
                      onChange={(e) => setTypedSignature(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-[#EAE1D2] text-sm focus:ring-2 focus:ring-[#BF5B33] outline-none"
                      placeholder="e.g. Jane M. Doe"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-semibold uppercase text-[#2C2A2A]">
                        Draw Signature (Optional)
                      </label>
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="text-xs text-[#BF5B33] hover:underline"
                      >
                        Clear Canvas
                      </button>
                    </div>
                    <canvas
                      ref={canvasRef}
                      width={450}
                      height={120}
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      className="w-full h-28 bg-[#F7F2E9] border border-[#EAE1D2] rounded-xl cursor-crosshair"
                    />
                  </div>

                  <div className="flex items-start gap-3 pt-2">
                    <input
                      id="ack-check"
                      type="checkbox"
                      required
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                      className="w-4 h-4 text-[#BF5B33] rounded mt-0.5"
                    />
                    <label htmlFor="ack-check" className="text-xs text-[#2C2A2A]/90 leading-normal">
                      By checking this box, I acknowledge that I have read, understood, and agree to the document text above. I intent to adopt this electronic signature with the same legal effect as a handwritten signature.
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={signing}
                    className="w-full py-3.5 px-6 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-semibold text-sm rounded-xl shadow-sm transition disabled:opacity-50"
                  >
                    {signing ? 'Signing Document...' : 'Sign & Submit Consent Agreement'}
                  </button>
                </form>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
