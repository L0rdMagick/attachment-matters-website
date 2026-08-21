import React from 'react';

export interface PortalConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  details?: string;
  icon?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  onConfirm: () => void;
  onCancel?: () => void;
  isAlertOnly?: boolean;
}

export const PortalConfirmModal: React.FC<PortalConfirmModalProps> = ({
  isOpen,
  title,
  message,
  details,
  icon,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  onConfirm,
  onCancel,
  isAlertOnly = false
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          border: 'border-red-500',
          iconBg: 'bg-red-100 text-red-700',
          btnBg: 'bg-red-600 hover:bg-red-700 text-white',
          defaultIcon: '🗑️'
        };
      case 'warning':
        return {
          border: 'border-[#BF5B33]',
          iconBg: 'bg-[#BF5B33]/10 text-[#BF5B33]',
          btnBg: 'bg-[#BF5B33] hover:bg-[#a64e2b] text-white',
          defaultIcon: '⚠️'
        };
      case 'success':
        return {
          border: 'border-emerald-500',
          iconBg: 'bg-emerald-100 text-emerald-800',
          btnBg: 'bg-emerald-700 hover:bg-emerald-800 text-white',
          defaultIcon: '✓'
        };
      default:
        return {
          border: 'border-[#4A5741]',
          iconBg: 'bg-[#4A5741]/10 text-[#4A5741]',
          btnBg: 'bg-[#4A5741] hover:bg-[#384232] text-white',
          defaultIcon: 'ℹ️'
        };
    }
  };

  const style = getVariantStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in no-print font-sans">
      <div className={`bg-white border-2 ${style.border} rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4`}>
        <div className="flex items-start gap-3 border-b border-[#EAE1D2] pb-3">
          <div className={`w-10 h-10 rounded-full ${style.iconBg} flex items-center justify-center font-bold text-xl shrink-0`}>
            {icon || style.defaultIcon}
          </div>
          <div>
            <h3 className="font-serif font-bold text-lg text-[#2C2A2A]">
              {title}
            </h3>
            <p className="text-[11px] text-[#2C2A2A]/70 font-medium uppercase tracking-wider">
              Family Trust Therapy Notice
            </p>
          </div>
        </div>

        <div className="space-y-2 text-xs text-[#2C2A2A]">
          <p className="leading-relaxed font-medium">
            {message}
          </p>
          {details && (
            <div className="mt-2 p-3 bg-[#F7F2E9] rounded-xl border border-[#EAE1D2] text-[#2C2A2A] text-[11px] leading-relaxed break-words">
              <strong className="block text-[#BF5B33] text-[10px] uppercase font-bold mb-0.5">Details:</strong>
              <span className="italic">{details}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2">
          {!isAlertOnly && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-[#F7F2E9] border border-[#EAE1D2] text-[#2C2A2A] font-semibold text-xs rounded-xl transition min-h-[42px]"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`w-full sm:w-auto px-5 py-2.5 ${style.btnBg} font-semibold text-xs rounded-xl shadow-xs transition min-h-[42px] flex items-center justify-center`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
