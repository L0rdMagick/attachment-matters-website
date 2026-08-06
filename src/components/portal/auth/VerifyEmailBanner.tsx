import React, { useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { useAuth } from '../../../context/AuthContext';

export const VerifyEmailBanner: React.FC = () => {
  const { user, isEmailVerified } = useAuth();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user || isEmailVerified) return null;

  const handleResend = async () => {
    setLoading(true);
    try {
      await sendEmailVerification(user);
      setSent(true);
    } catch (err) {
      console.error("Resend verification error", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-[#BF5B33]/10 border-b border-[#BF5B33]/30 px-6 py-3 font-sans">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-[#2C2A2A]">
        <div className="flex items-center gap-3">
          <span className="text-[#BF5B33] text-lg font-bold">⚠️</span>
          <div>
            <strong className="font-semibold text-[#BF5B33]">Email Verification Required:</strong>{' '}
            <span>Sensitive medical records, appointment booking, and portal features remain locked until you verify your email address.</span>
          </div>
        </div>
        <div>
          {sent ? (
            <span className="text-xs font-semibold text-[#4A5741] bg-white px-3 py-1.5 rounded-lg border border-[#4A5741]/30">
              Verification email resent!
            </span>
          ) : (
            <button
              onClick={handleResend}
              disabled={loading}
              className="text-xs font-semibold text-white bg-[#BF5B33] hover:bg-[#a64e2b] px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Resend Email Verification'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
