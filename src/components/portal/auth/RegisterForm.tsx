import React, { useState } from 'react';
import { registerClient } from '../../../lib/firebase/auth';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const validatePassword = (pass: string) => {
    if (pass.length < 8) return "Password must be at least 8 characters long.";
    if (!/[A-Z]/.test(pass)) return "Password must contain at least one uppercase letter.";
    if (!/[a-z]/.test(pass)) return "Password must contain at least one lowercase letter.";
    if (!/[0-9]/.test(pass)) return "Password must contain at least one number.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    try {
      await registerClient(email.trim(), password, firstName.trim(), lastName.trim());
      setSuccess(true);
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError("An account with this email address already exists.");
      } else if (err.code === 'auth/network-request-failed' || err.message?.includes('ERR_CONNECTION_REFUSED') || err.message?.includes('Failed to fetch')) {
        setError("Firebase Authentication service is offline or not connected. If testing locally, start local emulators with JDK 21+ (`npx firebase emulators:start` & set PUBLIC_USE_EMULATORS=true in .env). Otherwise, populate your real Firebase credentials in .env as detailed in SETUP_GUIDE.md.");
      } else {
        setError(err.message || "Unable to complete registration. Please try again or contact our office.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="w-full max-w-md mx-auto bg-white border border-[#EAE1D2] rounded-2xl p-8 shadow-sm text-center font-sans">
        <div className="w-12 h-12 bg-[#4A5741]/10 text-[#4A5741] rounded-full flex items-center justify-center mx-auto mb-4 text-xl">
          ✓
        </div>
        <h2 className="text-2xl font-serif text-[#2C2A2A] font-medium mb-3">Check Your Email</h2>
        <p className="text-[#2C2A2A]/80 text-sm leading-relaxed mb-6">
          We sent a verification link to <strong className="text-[#2C2A2A]">{email}</strong>. Please verify your email address to access your client portal.
        </p>
        <button
          onClick={onSwitchToLogin}
          className="w-full py-3 px-6 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-medium text-sm rounded-xl transition"
        >
          Return to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto bg-white border border-[#EAE1D2] rounded-2xl p-8 shadow-sm">
      <div className="text-center mb-8 font-sans">
        <span className="inline-block px-3 py-1 bg-[#F7F2E9] text-[#4A5741] text-xs font-semibold tracking-wider uppercase rounded-full mb-3">
          New Client Registration
        </span>
        <h2 className="text-3xl font-serif text-[#2C2A2A] font-medium">Create Your Portal Account</h2>
        <p className="text-[#2C2A2A]/70 text-sm mt-2">
          Fill out the information below to set up secure access.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-sans" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 font-sans text-xs uppercase tracking-wider font-semibold text-[#2C2A2A]">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="reg-firstname" className="block mb-1.5">
              Legal First Name <span className="text-[#BF5B33]">*</span>
            </label>
            <input
              id="reg-firstname"
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              placeholder="Jane"
            />
          </div>
          <div>
            <label htmlFor="reg-lastname" className="block mb-1.5">
              Legal Last Name <span className="text-[#BF5B33]">*</span>
            </label>
            <input
              id="reg-lastname"
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
              placeholder="Doe"
            />
          </div>
        </div>

        <div>
          <label htmlFor="reg-email" className="block mb-1.5">
            Email Address <span className="text-[#BF5B33]">*</span>
          </label>
          <input
            id="reg-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
            placeholder="jane.doe@example.com"
          />
        </div>

        <div>
          <label htmlFor="reg-password" className="block mb-1.5">
            Password <span className="text-[#BF5B33]">*</span>
          </label>
          <input
            id="reg-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
            placeholder="Min 8 chars (1 upper, 1 lower, 1 number)"
          />
        </div>

        <div>
          <label htmlFor="reg-confirmpassword" className="block mb-1.5">
            Confirm Password <span className="text-[#BF5B33]">*</span>
          </label>
          <input
            id="reg-confirmpassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE1D2] text-sm normal-case font-normal focus:ring-2 focus:ring-[#BF5B33] outline-none"
            placeholder="Re-enter password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-4 py-3.5 px-6 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-medium text-sm rounded-xl shadow-sm transition disabled:opacity-50 normal-case tracking-normal"
        >
          {loading ? 'Creating Account...' : 'Complete Registration'}
        </button>
      </form>

      <div className="mt-6 pt-4 border-t border-[#EAE1D2] text-center font-sans text-xs text-[#2C2A2A]/70">
        Already have an account?{' '}
        <button onClick={onSwitchToLogin} className="text-[#4A5741] font-semibold hover:underline">
          Sign In
        </button>
      </div>
    </div>
  );
};
