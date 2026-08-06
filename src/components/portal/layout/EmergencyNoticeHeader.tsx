import React from 'react';

export const EmergencyNoticeHeader: React.FC = () => {
  return (
    <div className="w-full bg-[#2C2A2A] text-white text-xs py-2 px-4 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <p className="opacity-90">
          <strong className="text-[#EAE1D2] font-semibold">Emergency Notice:</strong> This portal is not monitored 24/7. If you are experiencing a mental health emergency or crisis, do not wait for a portal reply.
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <a href="tel:988" className="underline hover:text-[#EAE1D2] font-medium">
            Call or Text 988 (Suicide & Crisis Lifeline)
          </a>
          <span>|</span>
          <a href="tel:911" className="underline hover:text-[#EAE1D2] font-medium">
            Call 911
          </a>
        </div>
      </div>
    </div>
  );
};
