import React from 'react';
import type { SignedDocumentData } from '../../../types/consent';

export interface PrintableSignedConsentDocumentProps {
  clientName: string;
  clientEmail?: string;
  signedDoc: SignedDocumentData;
}

export const PrintableSignedConsentDocument: React.FC<PrintableSignedConsentDocumentProps> = ({
  clientName,
  clientEmail,
  signedDoc
}) => {
  if (!signedDoc) {
    return (
      <div className="p-6 bg-white border border-[#EAE1D2] rounded-2xl text-xs text-red-700">
        ⚠️ Unable to load signed document record. Please re-select the document.
      </div>
    );
  }

  const safeFormatDateTime = (iso?: string) => {
    if (!iso) return new Date().toLocaleString('en-US');
    try {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? new Date().toLocaleString('en-US') : d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return new Date().toLocaleString('en-US');
    }
  };

  const safeFormatDate = (iso?: string) => {
    if (!iso) return new Date().toLocaleDateString('en-US');
    try {
      const d = new Date(iso);
      return isNaN(d.getTime()) ? new Date().toLocaleDateString('en-US') : d.toLocaleDateString('en-US');
    } catch {
      return new Date().toLocaleDateString('en-US');
    }
  };

  const formattedDate = safeFormatDateTime(signedDoc.signedAtISO);

  return (
    <div className="official-print-document bg-white border-2 border-gray-900 rounded-none p-6 sm:p-10 shadow-none space-y-6 font-sans text-gray-900 print:border-none print:shadow-none print:p-0 print:m-0 print-card">
      {/* Controls bar - Hidden on print */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-300 pb-3 gap-2 no-print print:hidden">
        <div>
          <h4 className="text-lg font-serif font-medium text-gray-900">{signedDoc.documentTitle}</h4>
          <p className="text-xs text-gray-600">Version {signedDoc.templateVersion} • Legal Agreement</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-3.5 py-1.5 bg-[#4A5741] hover:bg-[#384232] text-white text-xs font-semibold rounded-xl shadow-sm transition w-fit"
        >
          🖨️ Print / Save Legal PDF Copy
        </button>
      </div>

      {/* Official Practice Letterhead Header */}
      <div className="border-b-2 border-gray-900 pb-4 space-y-2">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-serif font-bold tracking-tight text-gray-900 uppercase">
              FAMILY TRUST THERAPY & CLINICAL SERVICES
            </h1>
            <p className="text-xs text-gray-700 font-medium">
              Attachment Matters, LLC • Durango, CO 81301 • Tel: (505) 920-6351 • Email: info@familytrusttherapy.com
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="inline-block px-3 py-1 bg-gray-100 border border-gray-900 text-[11px] font-bold tracking-widest uppercase">
              IMMUTABLE ARCHIVED E-SIGNED DOCUMENT
            </span>
          </div>
        </div>
        <div className="pt-2 text-center border-t border-gray-300">
          <h2 className="text-lg font-serif font-bold tracking-wide uppercase text-gray-900">
            {signedDoc.documentTitle}
          </h2>
          <p className="text-xs text-gray-600 font-medium">Document Template Version: {signedDoc.templateVersion}</p>
        </div>
      </div>

      {/* Official Document Metadata Control Box */}
      <div className="border border-gray-900 p-4 bg-gray-50/50 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-sans">
        <div>
          <span className="block font-bold uppercase tracking-wider text-gray-600 text-[10px]">Signer Legal Name</span>
          <span className="font-semibold text-sm text-gray-900">{signedDoc.clientTypedName || clientName}</span>
        </div>
        <div className="overflow-hidden">
          <span className="block font-bold uppercase tracking-wider text-gray-600 text-[10px]">Client Account Email</span>
          <span className="font-semibold text-gray-900 break-all break-words">{clientEmail || 'N/A'}</span>
        </div>
        <div>
          <span className="block font-bold uppercase tracking-wider text-gray-600 text-[10px]">Signed Date & Time</span>
          <span className="font-semibold text-gray-900">{formattedDate}</span>
        </div>
        <div>
          <span className="block font-bold uppercase tracking-wider text-gray-600 text-[10px]">Document Status</span>
          <span className="font-bold text-emerald-800 uppercase">E-SIGNED & VERIFIED</span>
        </div>
      </div>

      {/* 1. BODY OF AGREEMENT (FROZEN LEGAL TEXT SNAPSHOT - SHOWN FIRST) */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-widest bg-gray-100 p-2 border-l-4 border-gray-900">
          EXECUTED LEGAL AGREEMENT CONTENT
        </h3>
        <div className="p-4 border border-gray-400 text-xs font-mono whitespace-pre-wrap leading-relaxed bg-white text-gray-900 max-h-[500px] print:max-h-none overflow-y-auto">
          {signedDoc.exactTextSnapshot}
        </div>
      </div>

      {/* 2. LEGAL ATTESTATION & SIGNATURE BLOCK (SHOWN BELOW BODY OF TEXT) */}
      <div className="pt-4 border-t-2 border-gray-900 space-y-6 break-inside-avoid page-break-inside-avoid">
        <div className="p-4 border border-gray-900 bg-gray-50 text-xs space-y-2">
          <h4 className="font-bold uppercase tracking-wider text-gray-900">ELECTRONIC SIGNATURE & LEGAL ACKNOWLEDGEMENT</h4>
          <p className="text-gray-800 leading-relaxed italic">
            "By typing my legal name and/or drawing my electronic signature below, I attest under penalty of perjury that I have read, understood, and voluntarily agree to all terms and conditions set forth in this agreement. I acknowledge that this electronic signature carries the full legal weight of a handwritten signature under state and federal e-sign statutes."
          </p>
        </div>

        {/* Dual Signature Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs font-sans">
          {/* Client Signature */}
          <div className="space-y-4">
            <div className="border-b-2 border-gray-900 pb-2 space-y-2">
              <span className="block text-[10px] uppercase font-bold text-gray-600">Client / Guardian Executed Signature</span>
              {signedDoc.signatureDataUrl ? (
                <img
                  src={signedDoc.signatureDataUrl}
                  alt="Client Drawn Signature"
                  className="h-16 object-contain"
                />
              ) : (
                <div className="h-12 flex items-end">
                  <span className="font-serif italic text-lg text-gray-900">{signedDoc.clientTypedName}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="block text-[10px] uppercase text-gray-600">Typed Legal Name</span>
                <span className="font-semibold text-gray-900">{signedDoc.clientTypedName}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-gray-600">Date Signed</span>
                <span className="font-semibold text-gray-900">{safeFormatDate(signedDoc.signedAtISO)}</span>
              </div>
            </div>
            <div>
              <span className="block text-[9px] uppercase font-bold text-gray-500">Cryptographic Audit Hash</span>
              <code className="text-[10px] font-mono break-all text-gray-700 bg-gray-100 px-1 py-0.5 rounded border border-gray-300 block">{signedDoc.documentHash}</code>
            </div>
          </div>

          {/* Practice / Reviewer Signature */}
          <div className="space-y-4">
            <div className="border-b-2 border-gray-900 pb-2">
              <span className="block text-[10px] uppercase font-bold text-gray-600">Practice Representative / Witness Verification</span>
              <div className="h-16"></div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="block text-[10px] uppercase text-gray-600">Reviewer Name</span>
                <span className="text-gray-500 italic">[ Practice Custodian ]</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-gray-600">Archived Date</span>
                <span className="text-gray-500 italic">____/____/20__</span>
              </div>
            </div>
          </div>
        </div>

        {/* HIPAA Footer */}
        <div className="pt-4 border-t border-gray-300 text-[10px] text-gray-600 text-center space-y-0.5 uppercase tracking-wider">
          <p className="font-bold">CONFIDENTIAL HEALTHCARE LEGAL RECORD • SUBJECT TO STATE & FEDERAL HIPAA PRIVACY LAWS</p>
          <p>Family Trust Therapy • Attachment Matters, LLC • Immutable Cryptographic Archive</p>
        </div>
      </div>
    </div>
  );
};
