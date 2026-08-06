import React, { useState } from 'react';
import { requestPasswordReset } from '../../../lib/firebase/auth';

interface ForgotPasswordFormProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({ onBackToLogin }) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await requestPasswordReset(email.trim());
      setSubmitted(true);
    } catch (err: any) {
      // Non-revealing response for security
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="w-full max-w-md mx-auto bg-white border border-[#EAE1D2] rounded-2xl p-8 shadow-sm text-center font-sans">
        <h2 className="text-2xl font-serif text-[#2C2A2A] font-medium mb-3">Reset Email Sent</h2>
        <p className="text-[#2C2A2A]/80 text-sm leading-relaxed mb-6">
          If an account exists for <strong className="text-[#2C2A2A]">{email}</strong>, you will receive password reset instructions shortly.
        </p>
        <button
          onClick={onBackToLogin}
          className="w-full py-3 px-6 bg-[#4A5741] hover:bg-[#384232] text-white font-medium text-sm rounded-xl transition"
        >
          Return to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white border border-[#EAE1D2] rounded-2xl p-8 shadow-sm font-sans">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-serif text-[#2C2A2A] font-medium">Reset Password</h2>
        <p className="text-[#2C2A2A]/70 text-sm mt-2">
          Enter your registered email address to receive password recovery instructions.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-sans" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="reset-email" className="block text-xs font-semibold text-[#2C2A2A] uppercase tracking-wider mb-2">
            Email Address <span className="text-[#BF5B33]">*</span>
          </label>
          <input
            id="reset-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[#EAE1D2] focus:ring-2 focus:ring-[#BF5B33] outline-none text-[#2C2A2A]"
            placeholder="your.email@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-6 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-medium text-sm rounded-xl shadow-sm transition disabled:opacity-50"
        >
          {loading ? 'Sending Request...' : 'Send Reset Link'}
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-[#EAE1D2] text-center">
        <button onClick={onBackToLogin} className="text-[#4A5741] text-xs font-semibold hover:underline">
          ← Back to Sign In
        </button>
      </div>
    </div>
  );
};
