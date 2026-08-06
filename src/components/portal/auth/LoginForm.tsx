import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../../lib/firebase/config';

interface LoginFormProps {
  onSwitchToRegister: () => void;
  onSwitchToForgot: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSwitchToRegister, onSwitchToForgot }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed' || err.message?.includes('ERR_CONNECTION_REFUSED') || err.message?.includes('Failed to fetch')) {
        setError("Firebase Auth service offline or not connected. Start local emulators (`npx firebase emulators:start` with JDK 21+ and set PUBLIC_USE_EMULATORS=true in .env), or populate real Firebase project keys in .env per SETUP_GUIDE.md.");
      } else {
        // Non-revealing error message for security
        setError("Invalid email address or password. Please verify your credentials and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white border border-[#EAE1D2] rounded-2xl p-8 shadow-sm">
      <div className="text-center mb-8">
        <span className="inline-block px-3 py-1 bg-[#F7F2E9] text-[#4A5741] text-xs font-semibold tracking-wider uppercase rounded-full mb-3">
          Client & Staff Portal
        </span>
        <h2 className="text-3xl font-serif text-[#2C2A2A] font-medium">Welcome Back</h2>
        <p className="text-[#2C2A2A]/70 text-sm mt-2 font-sans">
          Sign in to access your secure portal dashboard.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-sans" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 font-sans">
        <div>
          <label htmlFor="login-email" className="block text-xs font-semibold text-[#2C2A2A] uppercase tracking-wider mb-2">
            Email Address <span className="text-[#BF5B33]">*</span>
          </label>
          <input
            id="login-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[#EAE1D2] focus:ring-2 focus:ring-[#BF5B33] focus:border-transparent outline-none transition text-[#2C2A2A]"
            placeholder="your.email@example.com"
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="login-password" className="block text-xs font-semibold text-[#2C2A2A] uppercase tracking-wider">
              Password <span className="text-[#BF5B33]">*</span>
            </label>
            <button
              type="button"
              onClick={onSwitchToForgot}
              className="text-xs text-[#BF5B33] hover:underline font-medium"
            >
              Forgot password?
            </button>
          </div>
          <input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[#EAE1D2] focus:ring-2 focus:ring-[#BF5B33] focus:border-transparent outline-none transition text-[#2C2A2A]"
            placeholder="••••••••••••"
          />
        </div>

        <div className="flex items-center">
          <input
            id="remember-device"
            type="checkbox"
            checked={rememberDevice}
            onChange={(e) => setRememberDevice(e.target.checked)}
            className="w-4 h-4 text-[#BF5B33] rounded border-[#EAE1D2] focus:ring-[#BF5B33]"
          />
          <label htmlFor="remember-device" className="ml-2 text-xs text-[#2C2A2A]/80">
            Remember this device for 14 days
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-6 bg-[#BF5B33] hover:bg-[#a64e2b] text-white font-medium text-sm rounded-xl shadow-sm transition duration-200 disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-[#EAE1D2] text-center font-sans text-xs text-[#2C2A2A]/70">
        New client?{' '}
        <button onClick={onSwitchToRegister} className="text-[#4A5741] font-semibold hover:underline">
          Create an account
        </button>
      </div>
    </div>
  );
};
