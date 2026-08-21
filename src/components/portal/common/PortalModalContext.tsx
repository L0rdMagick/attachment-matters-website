import React, { createContext, useContext, useState } from 'react';
import { PortalConfirmModal } from './PortalConfirmModal';

export interface ShowModalOptions {
  title: string;
  message: string;
  details?: string;
  icon?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  isAlertOnly?: boolean;
}

interface PortalModalContextType {
  showConfirm: (options: ShowModalOptions) => void;
  showAlert: (title: string, message: string, variant?: 'danger' | 'warning' | 'info' | 'success', icon?: string) => void;
}

const PortalModalContext = createContext<PortalModalContextType | undefined>(undefined);

export const PortalModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<ShowModalOptions & { isOpen: boolean }>({
    isOpen: false,
    title: '',
    message: ''
  });

  const showConfirm = (options: ShowModalOptions) => {
    setModalState({
      ...options,
      isOpen: true
    });
  };

  const showAlert = (
    title: string,
    message: string,
    variant: 'danger' | 'warning' | 'info' | 'success' = 'info',
    icon?: string
  ) => {
    setModalState({
      title,
      message,
      variant,
      icon,
      isAlertOnly: true,
      confirmText: 'OK',
      isOpen: true
    });
  };

  const handleConfirm = async () => {
    const callback = modalState.onConfirm;
    setModalState((prev) => ({ ...prev, isOpen: false }));
    if (callback) {
      await callback();
    }
  };

  const handleCancel = () => {
    const callback = modalState.onCancel;
    setModalState((prev) => ({ ...prev, isOpen: false }));
    if (callback) {
      callback();
    }
  };

  return (
    <PortalModalContext.Provider value={{ showConfirm, showAlert }}>
      {children}
      <PortalConfirmModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        details={modalState.details}
        icon={modalState.icon}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        variant={modalState.variant}
        isAlertOnly={modalState.isAlertOnly}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </PortalModalContext.Provider>
  );
};

export const usePortalModal = () => {
  const context = useContext(PortalModalContext);
  if (!context) {
    throw new Error('usePortalModal must be used within a PortalModalProvider');
  }
  return context;
};
